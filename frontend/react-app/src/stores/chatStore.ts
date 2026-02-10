import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sourceFile?: {
    filename: string;
    uploader: string;
    uploadDate: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  campus: string;
  year: string;
  semester: string;
  messages: Message[];
  createdAt: number;
  lastMessageAt: number;
  archived: boolean;
}

interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string | null;
  
  createSession: (campus: string, year: string, semester: string, courseCode: string, courseName: string) => string;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  renameSession: (sessionId: string, title: string) => void;
  toggleArchive: (sessionId: string, archived: boolean) => void;
  getCurrentSession: () => ChatSession | null;
  getSessionHistory: () => ChatSession[];
  getArchivedSessions: () => ChatSession[];
  deleteSession: (sessionId: string) => void;
  clearAllSessions: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,

  createSession: (campus, year, semester, courseCode, courseName) => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: courseName || courseCode || "New chat",
      courseCode,
      courseName,
      campus,
      year,
      semester,
      messages: [],
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      archived: false,
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id,
    }));

    return newSession.id;
  },

  setCurrentSession: (sessionId) => {
    set({ currentSessionId: sessionId });
  },

  addMessage: (sessionId, message) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: [...session.messages, message],
              lastMessageAt: Date.now(),
            }
          : session
      ),
    }));
  },

  renameSession: (sessionId, title) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId ? { ...session, title: title.trim() || session.title } : session
      ),
    }));
  },

  toggleArchive: (sessionId, archived) => {
    set((state) => {
      const sessions = state.sessions.map((session) =>
        session.id === sessionId ? { ...session, archived } : session
      );

      const currentSessionId =
        state.currentSessionId === sessionId && archived
          ? sessions.find((s) => !s.archived)?.id || null
          : state.currentSessionId;

      return { sessions, currentSessionId };
    });
  },

  getCurrentSession: () => {
    const state = get();
    return state.sessions.find((s) => s.id === state.currentSessionId) || null;
  },

  getSessionHistory: () => {
    return get()
      .sessions
      .filter((s) => !s.archived)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },

  getArchivedSessions: () => {
    return get()
      .sessions
      .filter((s) => s.archived)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },

  deleteSession: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== sessionId);
      const nextSessionId =
        state.currentSessionId === sessionId ? sessions.find((s) => !s.archived)?.id || null : state.currentSessionId;
      return { sessions, currentSessionId: nextSessionId };
    });
  },

  clearAllSessions: () => {
    set({ sessions: [], currentSessionId: null });
  },
}));
