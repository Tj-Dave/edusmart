import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildLocalDemoAssistantReply,
  DEFAULT_CHAT_TITLE,
  NO_COURSE_LABEL,
  PUBLIC_PREVIEW_COURSE,
} from '../constants';
import { Citation, StudentChatHistory, StudentChatSession, StudentMessage } from '../types';
import { studentWorkspaceApi } from '../services/studentWorkspaceApi';

const getCitationRole = (citation: any): string => {
  const roleCandidate = citation?.role || citation?.uploader_role || citation?.source_role || citation?.metadata?.uploader_role;
  return typeof roleCandidate === 'string' ? roleCandidate.toLowerCase() : '';
};

const mapCitation = (citation: any): Citation => ({
  id: citation?.id?.toString() || citation?.document_id?.toString() || undefined,
  title: citation?.title || citation?.file_name || citation?.source || 'Reference material',
  snippet: citation?.snippet || citation?.summary || citation?.text || '',
  source: citation?.source || citation?.file_name || citation?.document_id,
  role: getCitationRole(citation),
  url: citation?.url || citation?.link,
});

const normalizeHistory = (sessions: any): StudentChatHistory[] =>
  (sessions || [])
    .map((row: any) => ({
      session_id: (row?.id || row?.session_id || row?.chat_id).toString(),
      title: row?.title || DEFAULT_CHAT_TITLE,
      created_at: row?.created_at || new Date().toISOString(),
      message_preview: row?.message_preview || undefined,
    }))
    .sort(
      (left: StudentChatHistory, right: StudentChatHistory) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );

const normalizeSession = (session: any, fallbackId?: string, fallbackCourseName?: string): StudentChatSession => ({
  id: (session?.id || fallbackId).toString(),
  course_code: session?.course_code || session?.course_id || '',
  course_name:
    session?.course_name ||
    (session?.course_code || session?.course_id
      ? session?.course_name || session?.course_code || session?.course_id
      : fallbackCourseName || NO_COURSE_LABEL),
  created_at: session?.created_at || new Date().toISOString(),
  message_count: typeof session?.message_count === 'number' ? session.message_count : 0,
});

const normalizeStoredMessages = (rows: any[]): StudentMessage[] =>
  rows.map((row: any) => ({
    id: typeof row?.id === 'number' ? row.id : undefined,
    role: row?.role === 'assistant' ? 'assistant' : 'user',
    content: typeof row?.content === 'string' ? row.content : '',
    timestamp: row?.created_at ? new Date(row.created_at).toISOString() : undefined,
  }));

const applyResponseCitations = (
  messages: StudentMessage[],
  rawCitations: any[],
  assistantMessageId?: number | null
) => {
  const lecturerCitations = rawCitations
    .filter((citation: any) => getCitationRole(citation) === 'lecturer')
    .map(mapCitation);

  const hiddenCitationCount = rawCitations.length - lecturerCitations.length;
  if (lecturerCitations.length === 0 && hiddenCitationCount <= 0) {
    return messages;
  }

  const nextMessages = [...messages];
  const targetIndex = typeof assistantMessageId === 'number'
    ? nextMessages.findIndex((message) => message.id === assistantMessageId)
    : -1;
  const resolvedIndex = targetIndex >= 0
    ? targetIndex
    : [...nextMessages].reverse().findIndex((message) => message.role === 'assistant');

  if (resolvedIndex < 0) {
    return nextMessages;
  }

  const messageIndex = targetIndex >= 0 ? targetIndex : nextMessages.length - 1 - resolvedIndex;
  nextMessages[messageIndex] = {
    ...nextMessages[messageIndex],
    citations: lecturerCitations,
    hiddenCitationCount: hiddenCitationCount > 0 ? hiddenCitationCount : undefined,
  };
  return nextMessages;
};

interface UseStudentChatArgs {
  authToken?: string | null;
  courseCode?: string | null;
  courseName?: string | null;
  isPublicPreview: boolean;
}

export function useStudentChat({
  authToken,
  courseCode,
  courseName,
  isPublicPreview,
}: UseStudentChatArgs) {
  const [currentSession, setCurrentSession] = useState<StudentChatSession | null>(null);
  const [chatHistory, setChatHistory] = useState<StudentChatHistory[]>([]);
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSession, setIsFetchingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChatTitle, setCurrentChatTitle] = useState(DEFAULT_CHAT_TITLE);
  const [publicQueryCount, setPublicQueryCount] = useState(0);
  const [showPublicLimitModal, setShowPublicLimitModal] = useState(false);
  const useLocalDemo = isPublicPreview && !authToken;

  const activeChatCourseName = useMemo(() => {
    if (isPublicPreview) return PUBLIC_PREVIEW_COURSE.name;
    return courseName || courseCode || NO_COURSE_LABEL;
  }, [courseCode, courseName, isPublicPreview]);

  const deriveChatTitle = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return DEFAULT_CHAT_TITLE;
    }
    return trimmed.length > 40 ? `${trimmed.slice(0, 40).trim()}…` : trimmed;
  }, []);

  const bumpPublicUsage = useCallback(() => {
    setPublicQueryCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setShowPublicLimitModal(true);
      }
      return next;
    });
  }, []);

  const loadSessions = useCallback(async (selectedCourseCode?: string | null) => {
    if (useLocalDemo) {
      const timestamp = new Date();
      const chatId = `demo-local-${Date.now()}`;

      setCurrentSession({
        id: chatId,
        course_code: PUBLIC_PREVIEW_COURSE.code,
        course_name: PUBLIC_PREVIEW_COURSE.name,
        created_at: timestamp.toISOString(),
        message_count: 0,
      });
      setChatHistory([{ session_id: chatId, title: DEFAULT_CHAT_TITLE, created_at: timestamp.toISOString() }]);
      setMessages([]);
      setCurrentChatTitle(DEFAULT_CHAT_TITLE);
      setError(null);
      return;
    }

    if (isPublicPreview) {
      setCurrentSession(null);
      setMessages([]);
      setCurrentChatTitle(DEFAULT_CHAT_TITLE);
      return;
    }

    if (!authToken) {
      setError('Your session expired. Please log in again.');
      return;
    }

    try {
      setIsFetchingSession(true);
      setError(null);
      const sessions = await studentWorkspaceApi.listChatSessions(authToken, {
        includeArchived: false,
        course_id: selectedCourseCode && selectedCourseCode !== 'GENERAL' ? selectedCourseCode : undefined,
        general_only: selectedCourseCode === 'GENERAL' ? true : undefined,
      });
      setChatHistory(normalizeHistory(sessions));
      setCurrentSession(null);
      setMessages([]);
      setCurrentChatTitle(DEFAULT_CHAT_TITLE);
    } catch (loadError: any) {
      console.error('Failed to load chat sessions:', loadError);
      setError(loadError?.message || 'Failed to load chats.');
    } finally {
      setIsFetchingSession(false);
    }
  }, [authToken, isPublicPreview, useLocalDemo]);

  useEffect(() => {
    loadSessions(courseCode || null).catch(() => {
      /* loadSessions already updates error state */
    });
  }, [courseCode, loadSessions]);

  const handleNewChat = useCallback(() => {
    if (useLocalDemo) {
      const timestamp = new Date();
      const chatId = `demo-local-${Date.now()}`;

      setChatHistory((prev) => [
        { session_id: chatId, title: DEFAULT_CHAT_TITLE, created_at: timestamp.toISOString() },
        ...prev,
      ]);
      setCurrentSession({
        id: chatId,
        course_code: PUBLIC_PREVIEW_COURSE.code,
        course_name: PUBLIC_PREVIEW_COURSE.name,
        created_at: timestamp.toISOString(),
        message_count: 0,
      });
      setMessages([]);
      setCurrentChatTitle(DEFAULT_CHAT_TITLE);
      setError(null);
      setPublicQueryCount(0);
      setShowPublicLimitModal(false);
      return;
    }

    setCurrentSession(null);
    setMessages([]);
    setCurrentChatTitle(DEFAULT_CHAT_TITLE);
    setError(null);
    setPublicQueryCount(0);
    setShowPublicLimitModal(false);
  }, [useLocalDemo]);

  const handleSelectChat = useCallback(async (sessionId: string) => {
    if (currentSession?.id === sessionId || isPublicPreview) return;
    if (!authToken) {
      setError('Your session expired. Please log in again.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const detail = await studentWorkspaceApi.getChatSessionDetail(authToken, sessionId, 500);
      const session = detail?.session;
      const normalizedMessages = normalizeStoredMessages(Array.isArray(detail?.messages) ? detail.messages : []);
      const normalizedSession = normalizeSession(session, sessionId, courseName || undefined);
      const resolvedTitle =
        session?.title ||
        chatHistory.find((chat) => chat.session_id === sessionId)?.title ||
        DEFAULT_CHAT_TITLE;

      setCurrentSession(normalizedSession);
      setMessages(normalizedMessages);
      setCurrentChatTitle(resolvedTitle);
      setChatHistory((prev) =>
        prev.map((chat) => (chat.session_id === sessionId ? { ...chat, title: resolvedTitle } : chat))
      );
    } catch (loadError: any) {
      console.error('Failed to load chat:', loadError);
      setError(loadError?.message || 'Failed to load chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [authToken, chatHistory, courseName, currentSession?.id, isPublicPreview]);

  const sendMessage = useCallback(async (inputValue: string) => {
    if (!inputValue.trim() || isLoading) return;
    if (isPublicPreview && publicQueryCount >= 3) {
      setShowPublicLimitModal(true);
      setError(null);
      return;
    }

    const trimmedMessage = inputValue.trim();
    const optimisticUserMessage: StudentMessage = {
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setIsLoading(true);
    setError(null);

    try {
      if (useLocalDemo) {
        const aiMessage = buildLocalDemoAssistantReply(trimmedMessage);
        setMessages((prev) => [...prev, aiMessage]);

        if (messages.length === 0) {
          const chatTitle = deriveChatTitle(trimmedMessage);
          setChatHistory((prev) =>
            prev.map((chat) => (chat.session_id === currentSession?.id ? { ...chat, title: chatTitle } : chat))
          );
          setCurrentChatTitle(chatTitle);
        }

        setCurrentSession((prev) => (prev ? { ...prev, message_count: prev.message_count + 2 } : prev));
        if (isPublicPreview) bumpPublicUsage();
        return;
      }

      if (!authToken) {
        setError('Your session expired. Please log in again.');
        return;
      }

      if (!currentSession?.id) {
        const detail = await studentWorkspaceApi.queryChatAtomic(
          authToken,
          trimmedMessage,
          courseCode?.trim() || null,
          500
        );

        const session = detail?.session;
        const sessionId = (session?.id || session?.session_id)?.toString();
        if (!sessionId) throw new Error('Backend did not return session id.');

        const normalizedMessages = applyResponseCitations(
          normalizeStoredMessages(Array.isArray(detail?.messages) ? detail.messages : []),
          Array.isArray(detail?.citations) ? detail.citations : [],
          detail?.message_id
        );

        const normalizedSession = {
          ...normalizeSession(session, sessionId, courseName || undefined),
          message_count: typeof session?.message_count === 'number' ? session.message_count : normalizedMessages.length,
        };

        const resolvedTitle = session?.title || deriveChatTitle(trimmedMessage);
        setCurrentSession(normalizedSession);
        setMessages(normalizedMessages);
        setCurrentChatTitle(resolvedTitle);
        setChatHistory((prev) => {
          const filtered = prev.filter((chat) => chat.session_id !== sessionId);
          return [{ session_id: sessionId, title: resolvedTitle, created_at: normalizedSession.created_at }, ...filtered];
        });
        return;
      }

      const response = await studentWorkspaceApi.sendChatMessage(authToken, currentSession.id, trimmedMessage);
      const rawCitations = Array.isArray(response?.citations)
        ? response.citations
        : Array.isArray(response?.references)
        ? response.references
        : [];
      const lecturerCitations = rawCitations
        .filter((citation: any) => getCitationRole(citation) === 'lecturer')
        .map(mapCitation);
      const hiddenCitationCount = rawCitations.length - lecturerCitations.length;

      const aiMessage: StudentMessage = {
        id: response.message_id,
        role: 'assistant',
        content: response.response || 'I apologize, but I could not generate a response. Please try again.',
        timestamp: new Date().toISOString(),
        citations: lecturerCitations,
        hiddenCitationCount: hiddenCitationCount > 0 ? hiddenCitationCount : undefined,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setCurrentSession((prev) => (prev ? { ...prev, message_count: prev.message_count + 2 } : prev));

      if (isPublicPreview) bumpPublicUsage();
    } catch (sendError: any) {
      console.error('Failed to send message:', sendError);
      setError(sendError?.message || 'Failed to send message. Please try again.');
      setMessages((prev) => prev.slice(0, -1));
      throw sendError;
    } finally {
      setIsLoading(false);
    }
  }, [
    authToken,
    bumpPublicUsage,
    courseCode,
    courseName,
    currentSession,
    deriveChatTitle,
    isLoading,
    isPublicPreview,
    messages.length,
    publicQueryCount,
    useLocalDemo,
  ]);

  const deleteChat = useCallback(async (sessionId: string) => {
    if (isPublicPreview || !authToken) return;
    await studentWorkspaceApi.deleteChatSession(authToken, sessionId);
    setChatHistory((prev) => prev.filter((chat) => chat.session_id !== sessionId));
    if (currentSession?.id === sessionId) {
      handleNewChat();
    }
  }, [authToken, currentSession?.id, handleNewChat, isPublicPreview]);

  const archiveChat = useCallback(async (sessionId: string) => {
    if (isPublicPreview || !authToken) return;
    await studentWorkspaceApi.archiveChatSession(authToken, sessionId, true);
    setChatHistory((prev) => prev.filter((chat) => chat.session_id !== sessionId));
    if (currentSession?.id === sessionId) {
      handleNewChat();
    }
  }, [authToken, currentSession?.id, handleNewChat, isPublicPreview]);

  return {
    currentSession,
    chatHistory,
    messages,
    isLoading,
    isFetchingSession,
    error,
    setError,
    currentChatTitle,
    activeChatCourseName,
    showPublicLimitModal,
    setShowPublicLimitModal,
    publicQueryCount,
    setPublicQueryCount,
    handleNewChat,
    handleSelectChat,
    sendMessage,
    deleteChat,
    archiveChat,
    reloadSessions: loadSessions,
  };
}
