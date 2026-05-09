import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

// SSE event type definitions
export interface StreamEventStatus {
  status: string;
  session_id: string;
  is_new_session: boolean;
}

export interface StreamEventSessionCreated {
  session_id: string;
  session_title: string;
}

export interface StreamEventToken {
  token: string;
  partial_text: string;
}

export interface StreamEventMetadata {
  tokens_generated: number;
  tokens_per_second: number;
  partial_text: string;
}

export interface StreamEventDone {
  full_response: string;
  session_id: string;
  citations?: any[];
  confidence_score?: number;
}

export interface StreamEventError {
  error: string;
  partial_response?: string;
  session_id: string;
}

export interface StreamMetrics {
  tokensGenerated: number;
  tokensPerSecond: number;
}

export interface StartStreamParams {
  message: string;
  courseId?: string;
  topicId?: string;
  sessionId?: string | null;
  attachments?: any[];
  onSessionCreated?: (sessionId: string, title: string) => void;
  onDone?: (fullResponse: string, sessionId: string, citations?: any[]) => void;
  onError?: (error: string, partialResponse?: string) => void;
}

export interface UseLLMStreamOptions {
  token: string;
}

export interface UseLLMStreamReturn {
  isStreaming: boolean;
  partialText: string;
  error: string | null;
  metrics: StreamMetrics | null;
  sessionId: string | null;
  startStream: (params: StartStreamParams) => Promise<void>;
  abortStream: () => void;
}

/**
 * Custom hook for consuming SSE-based LLM streaming responses from EduScape AI backend.
 * 
 * Unified streaming hook that handles session creation and full AI pipeline streaming.
 * Every message (including first) streams through the complete pipeline.
 * 
 * @example
 * ```typescript
 * const { isStreaming, partialText, sessionId, startStream, abortStream } = useLLMStream({
 *   token: authToken,
 * });
 * 
 * // Start streaming (creates session if sessionId is null)
 * await startStream({
 *   message: 'Explain photosynthesis',
 *   courseId: 'BIO101',
 *   sessionId: null, // null for first message
 *   onSessionCreated: (newSessionId, title) => {
 *     console.log('Session created:', newSessionId);
 *   },
 *   onDone: (fullResponse, sessionId, citations) => {
 *     console.log('Stream complete:', fullResponse);
 *   },
 *   onError: (error, partial) => {
 *     console.error('Stream error:', error);
 *   },
 * });
 * 
 * // Abort mid-stream
 * abortStream();
 * ```
 */
export function useLLMStream({
  token,
}: UseLLMStreamOptions): UseLLMStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingTextRef = useRef<string>('');
  const accumulatedTextRef = useRef<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Apply each token update immediately for smooth typewriter-style streaming
  const applyTextUpdate = useCallback((text: string) => {
    pendingTextRef.current = text;
    setPartialText(text);
  }, []);

  const startStream = useCallback(
    async (params: StartStreamParams) => {
      const {
        message,
        courseId,
        topicId,
        sessionId: providedSessionId,
        attachments,
        onSessionCreated,
        onDone,
        onError: onErrorCallback,
      } = params;

      // Abort any existing stream before resetting state for a new one
      abortStream();

      // Reset state
      setPartialText('');
      setError(null);
      setMetrics(null);
      accumulatedTextRef.current = '';
      pendingTextRef.current = '';
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const payload: any = {
          message,
          course_id: courseId || null,
          topic_id: topicId || null,
          session_id: providedSessionId || null,
          attachments: attachments || null,
        };

        const response = await fetch(`${API_BASE_URL}/chats/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Use ReadableStream to consume SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentSessionId = providedSessionId;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue;

            // Parse SSE format: "data: <json>\n\n"
            if (line.startsWith('data:')) {
              const dataStr = line.substring(5).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);

                // Handle different event types based on data shape
                if (data.session_id && data.session_title) {
                  // SESSION_CREATED event
                  currentSessionId = data.session_id;
                  setSessionId(currentSessionId ?? null);
                  onSessionCreated?.(data.session_id, data.session_title);
                } else if (data.status === 'started') {
                  // STATUS event
                  if (data.session_id) {
                    currentSessionId = data.session_id;
                    setSessionId(currentSessionId ?? null);
                  }
                } else if (data.token !== undefined) {
                  // TOKEN event
                  const tokenText = typeof data.token === 'string' ? data.token : '';
                  const nextText = typeof data.partial_text === 'string'
                    ? data.partial_text
                    : `${accumulatedTextRef.current}${tokenText}`;
                  accumulatedTextRef.current = nextText;
                  applyTextUpdate(nextText);
                } else if (data.full_response !== undefined) {
                  // DONE event
                  const fullResponse = typeof data.full_response === 'string'
                    ? data.full_response
                    : accumulatedTextRef.current;
                  accumulatedTextRef.current = fullResponse;
                  setPartialText(fullResponse);
                  if (data.session_id) {
                    currentSessionId = data.session_id;
                    setSessionId(currentSessionId ?? null);
                  }
                  setIsStreaming(false);
                  onDone?.(fullResponse, currentSessionId || '', data.citations);
                } else if (data.error !== undefined) {
                  // ERROR event
                  setError(data.error);
                  setIsStreaming(false);
                  const fallbackPartial = typeof data.partial_response === 'string'
                    ? data.partial_response
                    : pendingTextRef.current;
                  onErrorCallback?.(data.error, fallbackPartial);
                } else if (data.tokens_per_second !== undefined) {
                  // METADATA event (every 10 tokens)
                  setMetrics({
                    tokensGenerated: data.tokens_generated,
                    tokensPerSecond: data.tokens_per_second,
                  });
                  // Update partial text from metadata too
                  if (typeof data.partial_text === 'string') {
                    accumulatedTextRef.current = data.partial_text;
                    applyTextUpdate(data.partial_text);
                  }
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled
          setError('Stream cancelled');
        } else {
          const errorMessage = err?.message || 'Streaming failed';
          setError(errorMessage);
          onErrorCallback?.(errorMessage, pendingTextRef.current);
        }
        setIsStreaming(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [token, abortStream, applyTextUpdate]
  );

  return {
    isStreaming,
    partialText,
    error,
    metrics,
    sessionId,
    startStream,
    abortStream,
  };
}
