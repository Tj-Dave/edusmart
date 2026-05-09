import { useEffect, useMemo, useState } from 'react';
import MarkdownMessage from '../markdownMessage';
import { chatApi } from '../../services/api';
import { useLLMStream } from '../../hooks/useLLMStream';

interface SessionOption {
  id: string;
  title: string;
  createdAt: string;
}

interface MessageView {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface LecturerAssistantPanelProps {
  token: string;
  selectedCourseCode?: string | null;
  selectedOfferingLabel?: string | null;
}

const DEFAULT_CHAT_TITLE = 'New assistant chat';

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const parseSessionRows = (raw: unknown): SessionOption[] => {
  const rows = asArray<any>(raw).length > 0
    ? asArray<any>(raw)
    : asArray<any>((raw as any)?.items || (raw as any)?.results || (raw as any)?.sessions);

  return rows.map((session) => ({
    id: String(session?.id || session?.session_id || session?.chat_id),
    title: session?.title || DEFAULT_CHAT_TITLE,
    createdAt: session?.created_at || new Date().toISOString(),
  }));
};

const parseMessages = (raw: unknown): MessageView[] => {
  const rows = asArray<any>(raw);
  return rows.map((message) => ({
    id: typeof message?.id === 'number' ? message.id : undefined,
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: typeof message?.content === 'string' ? message.content : '',
    timestamp: message?.created_at || message?.timestamp || new Date().toISOString(),
  }));
};

const deriveChatTitle = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) return DEFAULT_CHAT_TITLE;
  return trimmed.length > 40 ? `${trimmed.slice(0, 40).trim()}…` : trimmed;
};

export default function LecturerAssistantPanel({
  token,
  selectedCourseCode,
  selectedOfferingLabel,
}: LecturerAssistantPanelProps) {
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState(DEFAULT_CHAT_TITLE);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);

  const { isStreaming, partialText, startStream, abortStream } = useLLMStream({
    token,
  });
  const hasActiveAssistantPlaceholder = streamingMessageId !== null && isSending;

  const courseContext = useMemo(() => {
    if (!selectedCourseCode) return null;
    return selectedCourseCode === 'GENERAL' ? null : selectedCourseCode;
  }, [selectedCourseCode]);

  const loadSessions = async () => {
    if (!token) return;

    setIsLoadingSessions(true);
    setError(null);

    try {
      const response = await chatApi.listSessions(token, {
        includeArchived: false,
        course_id: courseContext || undefined,
        general_only: !courseContext ? true : undefined,
      });
      const mapped = parseSessionRows(response)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      setSessions(mapped);
      if (mapped.length === 0) {
        setCurrentSessionId(null);
        setCurrentTitle(DEFAULT_CHAT_TITLE);
        setMessages([]);
      }
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to load assistant sessions.');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, courseContext]);

  const openSession = async (sessionId: string) => {
    if (!token) return;
    setCurrentSessionId(sessionId);
    setIsSending(true);
    setError(null);

    try {
      const detail = await chatApi.getSessionDetail(token, sessionId, 500);
      const detailMessages = parseMessages(detail?.messages || []);
      setMessages(detailMessages);
      const resolvedTitle = detail?.session?.title
        || sessions.find((session) => session.id === sessionId)?.title
        || DEFAULT_CHAT_TITLE;
      setCurrentTitle(resolvedTitle);
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to load chat session.');
    } finally {
      setIsSending(false);
    }
  };

  const createDraft = () => {
    setCurrentSessionId(null);
    setCurrentTitle(DEFAULT_CHAT_TITLE);
    setMessages([]);
    setError(null);
  };

  const sendMessage = async () => {
    const content = inputValue.trim();
    if (!token || !content || isSending || isStreaming) return;

    const optimisticMessage: MessageView = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const placeholderId = -(Date.now() + Math.floor(Math.random() * 1000));

    setMessages((prev) => [...prev, optimisticMessage, {
      id: placeholderId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }]);

    setInputValue('');
    setIsSending(true);
    setError(null);
    setStreamingMessageId(placeholderId);

    try {
      await startStream({
        message: content,
        courseId: courseContext || undefined,
        sessionId: currentSessionId,
        onSessionCreated: (newSessionId, title) => {
          setCurrentSessionId(newSessionId);
          const chatTitle = title || deriveChatTitle(content);
          setCurrentTitle(chatTitle);
          setSessions((prev) => [
            { id: newSessionId, title: chatTitle, createdAt: new Date().toISOString() },
            ...prev,
          ]);
        },
        onDone: (fullResponse, sessionId) => {
          setMessages((prev) => prev.map((msg) =>
            msg.id === placeholderId
              ? { ...msg, content: fullResponse, timestamp: new Date().toISOString() }
              : msg
          ));
          setStreamingMessageId(null);
          setCurrentSessionId(sessionId);
          setIsSending(false);
        },
        onError: (errorMsg, partialResponse) => {
          setError(errorMsg);
          if (partialResponse) {
            setMessages((prev) => prev.map((msg) =>
              msg.id === placeholderId
                ? { ...msg, content: partialResponse + '\n\n_[Stream interrupted]_' }
                : msg
            ));
          } else {
            setMessages((prev) => prev.filter((msg) => msg.id !== placeholderId));
            setInputValue(content);
          }
          setStreamingMessageId(null);
          setIsSending(false);
        },
      });
    } catch (requestError: any) {
      setError(requestError?.message || 'Message failed. Please try again.');
      setMessages((prev) => prev.filter((msg) => msg.id !== placeholderId));
      setInputValue(content);
      setStreamingMessageId(null);
      setIsSending(false);
    }
  };

  const handleStopGenerating = () => {
    const activeMessageId = streamingMessageId;
    if (activeMessageId === null) return;

    abortStream();
    setMessages((prev) => {
      if (partialText.trim().length === 0) {
        return prev.filter((msg) => msg.id !== activeMessageId);
      }
      return prev.map((msg) =>
        msg.id === activeMessageId
          ? { ...msg, content: `${partialText}\n\n_[Stream interrupted]_`, timestamp: new Date().toISOString() }
          : msg
      );
    });
    setStreamingMessageId(null);
    setIsSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Context</p>
        <p className="mt-1 text-sm text-gray-700">
          {selectedOfferingLabel || 'General lecturer context'}
          {courseContext ? ` • ${courseContext}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Sessions</h4>
            <button
              type="button"
              onClick={createDraft}
              className="rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              New
            </button>
          </div>

          {isLoadingSessions ? (
            <p className="text-sm text-gray-500">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500">No chats yet.</p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                    currentSessionId === session.id
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <p className="truncate text-sm font-semibold">{session.title}</p>
                  <p className="text-xs text-gray-500">{new Date(session.createdAt).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 border-b border-gray-100 pb-3">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">AI Assistant</p>
            <h4 className="text-lg font-semibold text-gray-900">{currentTitle}</h4>
          </div>

          <div className="h-[360px] space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                <p className="px-6 text-center text-sm text-gray-500">
                  Ask for teaching strategy support, roadmap ideas, or content explanations.
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isStreamingMsg = message.id === streamingMessageId;
                const displayContent = isStreamingMsg ? partialText : message.content;
                const hasStreamingTokens = isStreamingMsg && displayContent.trim().length > 0;
                
                return (
                <div
                  key={`${message.id || index}-${message.timestamp || ''}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm transition-all duration-200 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : hasStreamingTokens
                        ? 'border-l-4 border-blue-500 bg-blue-50 text-gray-800'
                        : 'border border-gray-200 bg-gray-50 text-gray-800'
                    }`}
                  >
                    {isStreamingMsg && !displayContent ? (
                      <div className="flex gap-1 py-1">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    ) : (
                      <MarkdownMessage content={displayContent} />
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
              placeholder="Ask the assistant..."
              className="min-h-[48px] flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {hasActiveAssistantPlaceholder && (
              <button
                type="button"
                onClick={handleStopGenerating}
                className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={sendMessage}
              disabled={isSending || isStreaming || !inputValue.trim()}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending || isStreaming ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
