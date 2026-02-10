import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import MessageBubble from "../components/MessageBubble";
import { sendMessage } from "../services/apiService";
import { useAuth } from "../state/AuthContext";
import { useChatStore } from "../stores/chatStore";
import { useCourseStore } from "../stores/courseStore";
import { useOfflineStore } from "../stores/offlineStore";

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const offlineStore = useOfflineStore();

  // Store selectors
  const selection = useCourseStore((state) => state.selection);
  const resetCourse = useCourseStore((state) => state.resetCourse);

  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const currentSession = useChatStore((state) =>
    state.sessions.find((s) => s.id === currentSessionId) || null
  );
  const createSession = useChatStore((state) => state.createSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const toggleArchive = useChatStore((state) => state.toggleArchive);

  // Local state
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize online listener
  useEffect(() => {
    const cleanup = offlineStore.initializeOnlineListener();
    return cleanup;
  }, [offlineStore]);

  // ⚠️ CRITICAL: Only check auth, don't redirect (PrivateRoute handles that)
  useEffect(() => {
    if (status === "checking") return;
    if (!user) {
      navigate("/login");
    }
  }, [status, user, navigate]);

  // ✅ ONLY ONE SESSION CREATION EFFECT - no other redirects
  // This creates a session when:
  // 1. Auth is finished checking AND
  // 2. User is authenticated AND
  // 3. Course selection is populated AND
  // 4. No session exists yet
  useEffect(() => {
    if (status === "checking") return; // Not ready yet
    if (status === "unauthenticated") return; // Not logged in
    if (!selection.courseCode) return; // Course not selected (shouldn't happen due to PrivateRoute)
    if (currentSessionId) return; // Session already exists

    // Create session with course context from courseStore
    createSession(
      selection.campus!,
      selection.year!,
      selection.semester!,
      selection.courseCode!,
      selection.courseName || selection.courseCode || "New chat"
    );
  }, [status, selection.courseCode, selection.campus, selection.year, selection.semester, currentSessionId, createSession]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession?.messages.length]);

  // Handlers
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSession || !query.trim()) return;

    const trimmed = query.trim();
    const userMessage = {
      id: uuidv4(),
      role: "user" as const,
      content: trimmed,
      timestamp: Date.now(),
    };

    addMessage(currentSession.id, userMessage);
    setSending(true);
    setQuery("");

    try {
      const response = await sendMessage(
        currentSession.id,
        trimmed,
        undefined,
        selection.courseCode || undefined,
        selection.semester || undefined,
        selection.year || undefined
      );

      const assistantMessage = {
        id: uuidv4(),
        role: "assistant" as const,
        content: response.answer || "",
        timestamp: Date.now(),
        sourceFile: response.source_file,
      };

      addMessage(currentSession.id, assistantMessage);
    } catch (error: any) {
      const errorMessage = {
        id: uuidv4(),
        role: "assistant" as const,
        content: error?.message || "Something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      addMessage(currentSession.id, errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = () => {
    // Create another session (user wants to start fresh)
    createSession(
      selection.campus!,
      selection.year!,
      selection.semester!,
      selection.courseCode!,
      selection.courseName || selection.courseCode || "New chat"
    );
    setQuery("");
  };

  const handleSwitchCourse = () => {
    // Archive current session and go back to course selection
    if (currentSession) {
      toggleArchive(currentSession.id, true);
    }
    localStorage.removeItem("selected_course");
    // Keep campus/year/semester filled, only reset course field
    resetCourse();
    setShowSwitchConfirm(false);
    navigate("/course-selection");
  };

  // ✅ Three mutually exclusive loading states (in strict order)
  
  // 1. Auth is still checking
  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
        <p className="text-sm text-slate-500">Loading your session...</p>
      </div>
    );
  }

  // 2. Auth is done, but session not created yet
  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
        <p className="text-sm text-slate-500">Creating your learning session...</p>
      </div>
    );
  }

  // 3. Session exists - render full chat UI
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-6xl mx-auto h-screen px-4 py-6 flex flex-col gap-5">
        {/* Top bar */}
        <header className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                offlineStore.isOnline
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  offlineStore.isOnline ? "bg-blue-500" : "bg-red-500"
                }`}
              ></span>
              <span>{offlineStore.isOnline ? "Online" : "Offline"}</span>
            </div>
            <div className="text-sm text-slate-600">
              {currentSession?.courseName || "Chat"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
            >
              + New Chat
            </button>

            <button
              onClick={() => setShowSwitchConfirm(true)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Switch Course
            </button>
          </div>
        </header>

        {/* Main Chat Area */}
        <section className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
            <div>
              <p className="text-xs text-slate-500">{currentSession?.courseCode}</p>
              <p className="text-lg font-semibold text-slate-900">{currentSession?.courseName}</p>
              <p className="text-xs text-slate-500">{currentSession?.campus}</p>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 px-6 py-6 overflow-y-auto space-y-4">
            {currentSession?.messages && currentSession.messages.length > 0 ? (
              <>
                {currentSession.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Start a conversation by asking a question
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                  placeholder="Ask anything about this course..."
                  disabled={sending || !offlineStore.isOnline || !currentSession}
                  rows={3}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                />
                <div className="absolute right-3 bottom-3 text-[11px] text-slate-400">Enter to send</div>
              </div>
              <button
                type="submit"
                disabled={!query.trim() || sending || !offlineStore.isOnline || !currentSession}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-semibold flex items-center gap-2 shadow-sm"
              >
                {sending ? (
                  <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <>
                    <span>Send</span>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.94 2.94a1.5 1.5 0 012.12 0L17.06 14.94a1.5 1.5 0 01-2.12 2.12L2.94 5.06a1.5 1.5 0 010-2.12z" />
                      <path d="M2.94 17.06a1.5 1.5 0 002.12 0L17.06 5.06a1.5 1.5 0 10-2.12-2.12L2.94 14.94a1.5 1.5 0 000 2.12z" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Switch Course Confirmation Modal */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Switch Course?</h3>
            <p className="text-gray-600 mb-6">
              Switching courses will start a new chat session. Your current conversation will be archived.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSwitchConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchCourse}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
              >
                Switch Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
