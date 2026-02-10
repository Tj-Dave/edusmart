import { useState } from "react";
import { useAuth } from "../state/AuthContext";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../stores/chatStore";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const chatSessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);
  const renameSession = useChatStore((state) => state.renameSession);
  const toggleArchive = useChatStore((state) => state.toggleArchive);
  const deleteSession = useChatStore((state) => state.deleteSession);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSelectChat = (sessionId: string) => {
    setCurrentSession(sessionId);
    setMenuOpenId(null);
  };

  const handleRename = (sessionId: string, currentTitle?: string) => {
    const nextTitle = window.prompt("Rename chat", currentTitle || "");
    if (nextTitle && nextTitle.trim()) {
      renameSession(sessionId, nextTitle.trim());
    }
    setMenuOpenId(null);
  };

  const handleArchive = (sessionId: string, archived: boolean) => {
    toggleArchive(sessionId, archived);
    setMenuOpenId(null);
  };

  const handleDelete = (sessionId: string) => {
    if (!window.confirm("Delete this chat?")) return;
    deleteSession(sessionId);
    setMenuOpenId(null);
  };

  const activeSessions = chatSessions
    .filter((s) => !s.archived)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  const archivedSessions = chatSessions
    .filter((s) => s.archived)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  return (
    <div className="w-sidebar bg-sidebar border-r border-gray-200 flex flex-col h-screen">
      {/* Header with Logo */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">EduSmart</h1>
        <p className="text-xs text-gray-500">Learning Assistant</p>
      </div>

      {/* User Profile */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-primary-100 text-primary-700 capitalize">
              {user.role}
            </span>
          </div>
        </div>
      )}

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase">Recent Chats</p>

        <div className="space-y-2">
          {activeSessions.length === 0 && archivedSessions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No chats yet. Start one in the chat!</p>
          ) : (
            <>
              {activeSessions.map((session) => (
                <div key={session.id} className="group relative border border-transparent rounded-lg hover:border-gray-200">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectChat(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectChat(session.id);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition truncate ${
                      currentSessionId === session.id
                        ? "bg-blue-100 text-blue-900 font-semibold border border-blue-300"
                        : "text-gray-700 hover:bg-gray-100 border border-transparent"
                    }`}
                    title={session.courseName}
                  >
                    <div className="font-semibold flex items-center justify-between gap-2">
                      <span className="truncate">{session.title || session.courseName}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === session.id ? null : session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-gray-200 text-gray-600"
                        aria-label="Session menu"
                      >
                        ⋮
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {session.messages.length > 0 ? session.messages[session.messages.length - 1].content.substring(0, 48) : "New chat"}
                    </div>
                  </div>

                  {menuOpenId === session.id && (
                    <div className="absolute right-0 mt-1 w-44 rounded-xl border border-gray-200 bg-white shadow-md z-10">
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(session.id, session.title || session.courseName);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(session.id, true);
                        }}
                      >
                        Archive
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {archivedSessions.length > 0 && (
                <div className="pt-3 border-t border-gray-200 mt-3">
                  <p className="text-xs text-gray-500 mb-2 uppercase">Archived</p>
                  <div className="space-y-2">
                    {archivedSessions.map((session) => (
                      <div key={session.id} className="group relative border border-transparent rounded-lg hover:border-gray-200">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectChat(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectChat(session.id);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition truncate ${
                            currentSessionId === session.id
                              ? "bg-blue-100 text-blue-900 font-semibold border border-blue-300"
                              : "text-gray-600 hover:bg-gray-100 border border-transparent"
                          }`}
                          title={session.courseName}
                        >
                          <div className="font-semibold flex items-center justify-between gap-2">
                            <span className="truncate">{session.title || session.courseName}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === session.id ? null : session.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-gray-200 text-gray-600"
                              aria-label="Session menu"
                            >
                              ⋮
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {session.messages.length > 0 ? session.messages[session.messages.length - 1].content.substring(0, 48) : "New chat"}
                          </div>
                        </div>

                        {menuOpenId === session.id && (
                          <div className="absolute right-0 mt-1 w-44 rounded-xl border border-gray-200 bg-white shadow-md z-10">
                            <button
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(session.id, false);
                                handleSelectChat(session.id);
                              }}
                            >
                              Unarchive
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(session.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        {user?.role === "lecturer" && (
          <button
            onClick={() => navigate("/upload")}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm3.5 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            Upload Content
          </button>
        )}

        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Dashboard
          </button>
        )}

        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4.5a2.5 2.5 0 012.5-2.5h7A2.5 2.5 0 0115 4.5v2a.75.75 0 01-1.5 0v-2a1 1 0 00-1-1h-7a1 1 0 00-1 1v11a1 1 0 001 1h7a1 1 0 001-1v-2a.75.75 0 011.5 0v2A2.5 2.5 0 0112.5 17.5h-7A2.5 2.5 0 013 15.5v-11z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.348-1.348a.75.75 0 111.06-1.06l2.5 2.5a.75.75 0 010 1.06l-2.5 2.5a.75.75 0 11-1.06-1.06l1.348-1.348H6.75A.75.75 0 016 10z" clipRule="evenodd" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}
