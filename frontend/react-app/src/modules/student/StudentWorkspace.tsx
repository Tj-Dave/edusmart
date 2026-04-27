// src/modules/student/StudentWorkspace.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import { chatApi, ingestionApi, enrollmentApi, courseApi } from '../../services/api';
import MarkdownMessage from '../../components/markdownMessage';
import TopToolsDrawer from '../../components/tools/TopToolsDrawer';
import {
  DEFAULT_CHAT_TITLE,
  DEMO_AUTH_TOKEN,
  NO_COURSE_LABEL,
  PUBLIC_PREVIEW_COURSE,
  buildLocalDemoAssistantReply,
} from './constants';
import { useStudentEnrollment } from './hooks/useStudentEnrollment';
import type {
  Citation,
  StudentChatHistory as ChatHistory,
  StudentChatSession as ChatSession,
  StudentMessage as Message,
  StudentWorkspaceProps,
} from './types';

export default function StudentWorkspace({ publicMode = false }: StudentWorkspaceProps = {}) {
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const isPublicPreview = publicMode;
  const {
    courseCode,
    courseName,
    activeCourseName: selectedCourseName,
    enrolledCourses,
    enrollmentContextByCourse,
    activeEnrollmentContext,
    refreshEnrolledCourseData,
    selectCourse,
  } = useStudentEnrollment({
    isPublicPreview,
    token,
    userId: user?.id,
  });
  const activeCourseName = isPublicPreview ? PUBLIC_PREVIEW_COURSE.name : selectedCourseName;
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSession, setIsFetchingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);
  const [showSwitchCourseConfirm, setShowSwitchCourseConfirm] = useState(false);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showComposerExtras, setShowComposerExtras] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [referenceUploadFeedback, setReferenceUploadFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [publicQueryCount, setPublicQueryCount] = useState(0);
  const [showPublicLimitModal, setShowPublicLimitModal] = useState(false);
  const [currentChatTitle, setCurrentChatTitle] = useState(DEFAULT_CHAT_TITLE);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [searchCourseCode, setSearchCourseCode] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [showEnrollSuccess, setShowEnrollSuccess] = useState(false);
  const [enrolledCourseInfo, setEnrolledCourseInfo] = useState<any>(null);
  const [pendingCourseSelection, setPendingCourseSelection] = useState<{ code: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement | null>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const demoToken = DEMO_AUTH_TOKEN;
  const isDemoBackendAvailable = Boolean(demoToken);
  const useLocalDemo = isPublicPreview && !isDemoBackendAvailable;
  const authToken = isPublicPreview ? (isDemoBackendAvailable ? demoToken : null) : token;
  const canOpenStudentTools = !isPublicPreview && user?.role === 'student';
  const toolsButtonLabel = 'Tools';

  useEffect(() => {
    if (isPublicPreview) return;
    if (user?.role === 'lecturer') {
      navigate('/lecturer', { replace: true });
    }
  }, [isPublicPreview, navigate, user?.role]);

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

  const bumpPublicUsage = () => {
    setPublicQueryCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        setShowPublicLimitModal(true);
      }
      return next;
    });
  };

  const deriveChatTitle = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return DEFAULT_CHAT_TITLE;
    }
    return trimmed.length > 40 ? `${trimmed.slice(0, 40).trim()}…` : trimmed;
  };

  // ==================== Load sessions on mount (NO POST on page load) ====================
  useEffect(() => {
    // Demo-local still can create a local-only session
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

    // Public preview: no session creation here
    if (isPublicPreview) {
      setCurrentSession(null);
      setMessages([]);
      setCurrentChatTitle(DEFAULT_CHAT_TITLE);
      return;
    }

    // Real mode: just list sessions for sidebar (DB-only)
    const load = async () => {
      try {
        setIsFetchingSession(true);
        setError(null);

        if (!token) {
          setError("Your session expired. Please log in again.");
          return;
        }

        const sessions = await chatApi.listSessions(token, {
          includeArchived: false,
          course_id: courseCode && courseCode !== 'GENERAL' ? courseCode : undefined,
          general_only: courseCode === 'GENERAL' ? true : undefined,
        });

        const normalized: ChatHistory[] = (sessions || [])
          .map((s: any) => ({
            session_id: (s?.id || s?.session_id || s?.chat_id).toString(),
            title: s?.title || DEFAULT_CHAT_TITLE,
            created_at: s?.created_at || new Date().toISOString(),
            message_preview: s?.message_preview || undefined,
          }))
          .sort((a: ChatHistory, b: ChatHistory) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setChatHistory(normalized);

        // ✅ Do NOT auto-select any chat unless you want it.
        // If you want auto-load the latest chat, uncomment:
        // if (normalized.length > 0) await handleSelectChat(normalized[0].session_id);

        // Default to draft mode on load:
        setCurrentSession(null);
        setMessages([]);
        setCurrentChatTitle(DEFAULT_CHAT_TITLE);
      } catch (err: any) {
        console.error("Failed to load chat sessions:", err);
        setError(err?.message || "Failed to load chats.");
      } finally {
        setIsFetchingSession(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseCode, isPublicPreview, token, useLocalDemo]);


  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
        setShowCourseDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sidebar resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // ==================== HANDLERS ====================

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (isPublicPreview && publicQueryCount >= 3) {
      setShowPublicLimitModal(true);
      setError(null);
      return;
    }

    const trimmedMessage = inputValue.trim();

    // optimistic UI
    const userMessage: Message = {
      role: "user",
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setShowComposerExtras(false);
    setIsLoading(true);
    setError(null);

    try {
      // Demo-local flow unchanged
      if (useLocalDemo) {
        const aiMessage = buildLocalDemoAssistantReply(trimmedMessage);
        setMessages(prev => [...prev, aiMessage]);

        // set title on first message (local)
        if ((messages?.length || 0) === 0) {
          const chatTitle = deriveChatTitle(trimmedMessage);
          setChatHistory(prev =>
            prev.map(chat =>
              chat.session_id === currentSession?.id ? { ...chat, title: chatTitle } : chat
            )
          );
          setCurrentChatTitle(chatTitle);
        }

        setCurrentSession(prev => (prev ? { ...prev, message_count: prev.message_count + 2 } : prev));
        if (isPublicPreview) bumpPublicUsage();
        return;
      }

      // Auth check
      if (!authToken) {
        setError("Your session expired. Please log in again.");
        return;
      }

      // ✅ If NO active session => use atomic query endpoint (creates session + stores msgs)
      if (!currentSession?.id) {
        const detail = await chatApi.queryAtomic(
          authToken,
          trimmedMessage,
          courseCode?.trim() || null,
          500
        );

        const session = detail?.session;
        const msgs = Array.isArray(detail?.messages) ? detail.messages : [];
        const rawCitations = Array.isArray(detail?.citations)
          ? detail.citations
          : Array.isArray(detail?.references)
          ? detail.references
          : [];

        const normalizedMessages: Message[] = msgs.map((m: any) => ({
          id: typeof m?.id === "number" ? m.id : undefined,
          role: m?.role === "assistant" ? "assistant" : "user",
          content: typeof m?.content === "string" ? m.content : "",
          timestamp: m?.created_at ? new Date(m.created_at).toISOString() : undefined,
        }));
        const lecturerCitations = rawCitations
          .filter((citation: any) => getCitationRole(citation) === "lecturer")
          .map(mapCitation);
        const hiddenCitationCount = rawCitations.length - lecturerCitations.length;
        const latestAssistantIndex = typeof detail?.message_id === 'number'
          ? normalizedMessages.findIndex((message) => message.id === detail.message_id)
          : normalizedMessages.map((message) => message.role).lastIndexOf('assistant');
        if (latestAssistantIndex >= 0) {
          normalizedMessages[latestAssistantIndex] = {
            ...normalizedMessages[latestAssistantIndex],
            citations: lecturerCitations,
            hiddenCitationCount: hiddenCitationCount > 0 ? hiddenCitationCount : undefined,
          };
        }

        const sessionId = (session?.id || session?.session_id)?.toString();
        if (!sessionId) throw new Error("Backend did not return session id.");

        const normalizedSession: ChatSession = {
          id: sessionId,
          course_code: session?.course_id || "",
          course_name: (session?.course_id || "").trim()
            ? (courseName || session?.course_id)
            : NO_COURSE_LABEL,
          created_at: session?.created_at || new Date().toISOString(),
          message_count: typeof session?.message_count === "number"
            ? session.message_count
            : normalizedMessages.length,
        };

        setCurrentSession(normalizedSession);
        setMessages(normalizedMessages);

        const resolvedTitle = session?.title || deriveChatTitle(trimmedMessage);
        setCurrentChatTitle(resolvedTitle);

        // Sidebar: DB-only list, but we can refresh + ensure it appears instantly
        setChatHistory(prev => {
          const filtered = prev.filter(c => c.session_id !== sessionId);
          return [{ session_id: sessionId, title: resolvedTitle, created_at: normalizedSession.created_at }, ...filtered];
        });

        // Optional: refresh from backend to guarantee DB truth
        // await refreshSessions();

        return;
      }

      // ✅ If session exists, you can keep using /chats/{id}/messages
      const response = await chatApi.sendMessage(authToken, currentSession.id, trimmedMessage);

      const rawCitations = Array.isArray(response?.citations)
        ? response.citations
        : Array.isArray(response?.references)
        ? response.references
        : [];

      const lecturerCitations = rawCitations
        .filter((citation: any) => getCitationRole(citation) === "lecturer")
        .map(mapCitation);

      const hiddenCitationCount = rawCitations.length - lecturerCitations.length;

      const aiMessage: Message = {
        id: response.message_id,
        role: "assistant",
        content: response.response || "I apologize, but I could not generate a response. Please try again.",
        timestamp: new Date().toISOString(),
        citations: lecturerCitations,
        hiddenCitationCount: hiddenCitationCount > 0 ? hiddenCitationCount : undefined,
      };

      setMessages(prev => [...prev, aiMessage]);

      setCurrentSession(prev =>
        prev ? { ...prev, message_count: prev.message_count + 2 } : prev
      );

      if (isPublicPreview) bumpPublicUsage();
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setError(err?.message || "Failed to send message. Please try again.");

      // rollback optimistic user msg
      setMessages(prev => prev.slice(0, -1));
      setInputValue(trimmedMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage();
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReferenceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setReferenceFile(file);
    setReferenceUploadFeedback(null);
  };

  const handleClearReferenceFile = () => {
    setReferenceFile(null);
    setReferenceUploadFeedback(null);
    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.value = '';
    }
  };

  const handleReferenceUpload = async () => {
    if (isPublicPreview) {
      setReferenceUploadFeedback({ kind: 'error', text: 'Sign in to sync your lecturer packs into the knowledge base.' });
      return;
    }
    if (!token) {
      setReferenceUploadFeedback({ kind: 'error', text: 'Your session expired. Please log in again.' });
      return;
    }
    if (!referenceFile) {
      setReferenceUploadFeedback({ kind: 'error', text: 'Select a document before uploading.' });
      return;
    }

    try {
      setIsUploadingReference(true);
      setReferenceUploadFeedback(null);
      const result = await ingestionApi.uploadDocument(token, referenceFile);
      const filename = result?.filename || referenceFile.name;
      const chunkSummary = typeof result?.total_chunks === 'number'
        ? `${result.total_chunks} sections indexed`
        : 'Document ingested';
      setReferenceUploadFeedback({
        kind: 'success',
        text: `${filename} uploaded • ${chunkSummary}. Backend syncing to the RAG store now.`,
      });
      setReferenceFile(null);
      if (referenceFileInputRef.current) {
        referenceFileInputRef.current.value = '';
      }
    } catch (err: any) {
      setReferenceUploadFeedback({
        kind: 'error',
        text: err?.message || 'Upload failed. Please try again.',
      });
    } finally {
      setIsUploadingReference(false);
    }
  };

  const handleNewChat = async () => {
    // Demo-local keeps its behavior (optional)
    if (useLocalDemo) {
      const timestamp = new Date();
      const chatId = `demo-local-${Date.now()}`;

      setChatHistory(prev => [
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

    // Public preview: just clear to draft mode
    if (isPublicPreview) {
      setCurrentSession(null);
      setMessages([]);
      setCurrentChatTitle(DEFAULT_CHAT_TITLE);
      setError(null);
      setPublicQueryCount(0);
      setShowPublicLimitModal(false);
      return;
    }

    // ✅ Real mode: draft-only (NO session creation)
    setCurrentSession(null);
    setMessages([]);
    setCurrentChatTitle(DEFAULT_CHAT_TITLE);
    setError(null);
    setOpenMenuSessionId(null);
  };

  const handleSelectChat = async (sessionId: string) => {
    if (currentSession?.id === sessionId) return;
    if (isPublicPreview) return;

    if (!token) {
      setError("Your session expired. Please log in again.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // ✅ backend: GET /chats/{session_id}?limit=...
      const detail = await chatApi.getSessionDetail(token, sessionId, 500);
      console.log("chat detail payload", detail);
      console.log("chat detail messages[0]", detail?.messages?.[0]);

      const session = detail?.session;
      const msgs = Array.isArray(detail?.messages) ? detail.messages : [];

      // ✅ map backend ChatMessage -> UI Message
      const normalizedMessages: Message[] = msgs.map((m: any) => ({
        id: typeof m?.id === "number" ? m.id : undefined,
        role: (m?.role === "assistant" ? "assistant" : "user"),
        content: typeof m?.content === "string" ? m.content : "",
        timestamp: m?.created_at ? new Date(m.created_at).toISOString() : undefined,
        // citations are not in your ChatMessage model by default
      }));

      // ✅ normalize current session from backend response_model
      // Your ChatSessionOut probably has: id, course_id/course_code, title, created_at, message_count
      const normalizedSession: ChatSession = {
        id: (session?.id || sessionId).toString(),
        course_code: (session?.course_code || session?.course_id || ""), // depends on what ChatSessionOut exposes
        course_name:
          session?.course_name ||
          (session?.course_code || session?.course_id ? (session?.course_name || session?.course_code || session?.course_id) : NO_COURSE_LABEL),
        created_at: session?.created_at || new Date().toISOString(),
        message_count:
          typeof session?.message_count === "number" ? session.message_count : normalizedMessages.length,
      };

      setCurrentSession(normalizedSession);
      setMessages(normalizedMessages);

      // ✅ Update title in header + sidebar
      // If backend includes session.title use it; otherwise keep sidebar title
      const resolvedTitle =
        session?.title ||
        chatHistory.find((c) => c.session_id === sessionId)?.title ||
        DEFAULT_CHAT_TITLE;

      setCurrentChatTitle(resolvedTitle);

      setChatHistory((prev) =>
        prev.map((c) => (c.session_id === sessionId ? { ...c, title: resolvedTitle } : c))
      );

      setOpenMenuSessionId(null);
    } catch (err: any) {
      console.error("Failed to load chat:", err);
      setError(err?.message || "Failed to load chat. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const applyCourseSelection = async (course: { code: string; name: string }) => {
    selectCourse(course.code, course.name);
    setShowCourseDropdown(false);

    if (!token) return;
    try {
      const sessions = await chatApi.listSessions(token, {
        includeArchived: false,
        course_id: course.code === 'GENERAL' ? undefined : course.code,
        general_only: course.code === 'GENERAL' ? true : undefined,
      });
      const normalized: ChatHistory[] = (sessions || [])
        .map((session: any) => ({
          session_id: (session?.id || session?.session_id || session?.chat_id).toString(),
          title: session?.title || DEFAULT_CHAT_TITLE,
          created_at: session?.created_at || new Date().toISOString(),
          message_preview: session?.message_preview || undefined,
        }))
        .sort((left: ChatHistory, right: ChatHistory) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
      setChatHistory(normalized);
    } catch (err) {
      console.error('Failed to load course chats:', err);
    }

    handleNewChat();
  };

  const confirmSwitchCourse = async () => {
    setShowSwitchCourseConfirm(false);
    if (!pendingCourseSelection) {
      navigate('/course-selection');
      return;
    }

    const nextCourse = pendingCourseSelection;
    setPendingCourseSelection(null);
    await applyCourseSelection(nextCourse);
  };

  const handleLogout = () => {
    logout();
    setShowSettingsMenu(false);
    setShowToolsDrawer(false);
    navigate('/login');
  };

  const handleAccountSettings = () => {
    setShowSettingsMenu(false);
    navigate('/account-settings');
  };

  const handleGeneralSettings = () => {
    setShowSettingsMenu(false);
    navigate('/general-settings');
  };

  const handleDeleteChat = async (sessionId: string) => {
    if (isPublicPreview) return;
    if (!token) {
      setError('Your session expired. Please log in again.');
      return;
    }
    try {
      await chatApi.deleteSession(token, sessionId);
      setChatHistory(prev => prev.filter(chat => chat.session_id !== sessionId));
      setOpenMenuSessionId(null);
      if (currentSession?.id === sessionId) {
        handleNewChat();
      }
    } catch (err: any) {
      console.error('Failed to delete chat:', err);
      setError(err?.message || 'Failed to delete chat');
    }
  };

  const handleArchiveChat = async (sessionId: string) => {
    if (isPublicPreview) return;
    if (!token) {
      setError('Your session expired. Please log in again.');
      return;
    }
    try {
      await chatApi.archiveSession(token, sessionId, true);
      setChatHistory(prev => prev.filter(chat => chat.session_id !== sessionId));
      setOpenMenuSessionId(null);
      if (currentSession?.id === sessionId) {
        handleNewChat();
      }
    } catch (err: any) {
      console.error('Failed to archive chat:', err);
      setError(err?.message || 'Failed to archive chat');
    }
  };

  const handleSelectCourse = async (course: any) => {
    if (course.code === courseCode) {
      setShowCourseDropdown(false);
      return;
    }

    const hasActiveConversation = Boolean(currentSession?.id || messages.length > 0);
    if (hasActiveConversation) {
      setPendingCourseSelection(course);
      setShowCourseDropdown(false);
      setShowSwitchCourseConfirm(true);
      return;
    }

    await applyCourseSelection(course);
  };

  const handleSearchOfferings = async () => {
    if (!searchCourseCode.trim()) return;
    if (!token) {
      setEnrollError('Your session expired. Please log in again.');
      return;
    }
    setEnrollError(null);
    try {
      const results = await enrollmentApi.searchOfferings(token, { course_code: searchCourseCode.trim() });
      setSearchResults(results);
    } catch (err: any) {
      setEnrollError(err?.message || 'Failed to search courses');
    }
  };

  const handleEnrollByKey = async () => {
    if (!enrollmentKey.trim()) return;
    if (!token) {
      setEnrollError('Your session expired. Please log in again.');
      return;
    }
    setIsEnrolling(true);
    setEnrollError(null);
    try {
      const enrollment = await enrollmentApi.enrollByKey(token, { enrollment_key: enrollmentKey.trim() });
      const courseCode = enrollment.offering?.course_code;
      if (!courseCode) {
        throw new Error('Enrollment did not return a course code.');
      }
      let courseName = courseCode;
      try {
        const courseDetails = await courseApi.get(token, courseCode);
        courseName = courseDetails.course_name || courseCode;
      } catch (err) {
        console.log('Could not fetch course details');
      }
      setEnrolledCourseInfo({ code: courseCode, name: courseName });
      setShowEnrollModal(false);
      setShowEnrollSuccess(true);
      setEnrollmentKey('');
      await refreshEnrolledCourseData();
      if (courseCode) {
        await applyCourseSelection({ code: courseCode, name: courseName || courseCode });
      }
    } catch (err: any) {
      setEnrollError(err?.message || 'Failed to enroll');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleEnrollInOffering = async (offeringId: string, courseCode: string) => {
    if (!token) {
      setEnrollError('Your session expired. Please log in again.');
      return;
    }
    setIsEnrolling(true);
    setEnrollError(null);
    try {
      await enrollmentApi.enroll(token, { offering_id: offeringId });
      let courseName = courseCode;
      try {
        const courseDetails = await courseApi.get(token, courseCode);
        courseName = courseDetails.course_name || courseCode;
      } catch (err) {
        console.log('Could not fetch course details');
      }
      setEnrolledCourseInfo({ code: courseCode, name: courseName });
      setShowEnrollModal(false);
      setShowEnrollSuccess(true);
      setSearchCourseCode('');
      setSearchResults([]);
      await refreshEnrolledCourseData();
      if (courseCode) {
        await applyCourseSelection({ code: courseCode, name: courseName || courseCode });
      }
    } catch (err: any) {
      setEnrollError(err?.message || 'Failed to enroll');
    } finally {
      setIsEnrolling(false);
    }
  };

  // if (!courseCode && !isPublicPreview) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  //       <div className="text-center">
  //         <p className="text-xl text-gray-700 mb-4">No course selected</p>
  //         <button
  //           onClick={() => navigate('/course-selection')}
  //           className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
  //         >
  //           Select a Course
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  if (isFetchingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">Starting chat session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50 text-gray-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{ width: sidebarOpen && window.innerWidth >= 1024 ? `${sidebarWidth}px` : undefined }}
        className={`${
          sidebarOpen ? 'w-full max-h-[70vh] lg:max-h-none' : 'w-full max-h-0 lg:w-0'
        } transition-all duration-300 overflow-hidden bg-white border-b border-gray-200 lg:border-b-0 lg:border-r text-gray-900 flex flex-col shadow-sm relative`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            disabled={isFetchingSession || (isPublicPreview && isLoading)}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm transition flex items-center justify-center gap-2"
          >
            <span>+</span> {isPublicPreview ? 'New Demo Chat' : 'New Chat'}
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-hidden p-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-400 text-xs py-8">
              <p>No chats yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chatHistory.map((chat) => (
                <div
                  key={chat.session_id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition group ${
                    currentSession?.id === chat.session_id
                      ? 'bg-blue-50 text-blue-900 border border-blue-200'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <button
                    onClick={() => handleSelectChat(chat.session_id)}
                    className="flex-1 text-left"
                    title={chat.title}
                  >
                    <div className="truncate font-medium text-sm">{chat.title}</div>
                    <div className={`text-xs truncate ${
                      currentSession?.id === chat.session_id ? 'text-blue-500' : 'text-gray-400'
                    }`}>
                      {new Date(chat.created_at).toLocaleDateString()}
                    </div>
                  </button>
                  {!isPublicPreview && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuSessionId(openMenuSessionId === chat.session_id ? null : chat.session_id)}
                        className={`p-1.5 rounded transition ${
                          currentSession?.id === chat.session_id
                            ? 'hover:bg-blue-100 text-blue-600'
                            : 'hover:bg-gray-200 text-gray-500'
                        }`}
                        title="Chat options"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {openMenuSessionId === chat.session_id && (
                        <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => handleArchiveChat(chat.session_id)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                              <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            Archive
                          </button>
                          <button
                            onClick={() => handleDeleteChat(chat.session_id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-gray-200 p-4">
          {isPublicPreview ? (
            <div className="text-center text-xs text-gray-500 space-y-2">
              <p>Bring EduSmart into your actual modules by signing in.</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition"
              >
                Sign in to unlock courses
              </button>
            </div>
          ) : (
            <div className="relative" ref={courseDropdownRef}>
              <button
                onClick={() => setShowCourseDropdown(!showCourseDropdown)}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl font-medium text-xs tracking-wide hover:bg-gray-50 transition flex items-center justify-between"
              >
                <span>{courseCode || 'Select Course'}</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {showCourseDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => handleSelectCourse({ code: 'GENERAL', name: 'General Chat' })}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition"
                    >
                      <div className="font-medium text-gray-900">General Chat</div>
                      <div className="text-xs text-gray-500">No course context</div>
                    </button>
                  </div>
                  {enrolledCourses.length > 0 && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <div className="py-1">
                        {enrolledCourses.map((course) => (
                          <button
                            key={course.code}
                            onClick={() => handleSelectCourse(course)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition"
                          >
                            <div className="font-medium text-gray-900">{course.code}</div>
                            <div className="text-xs text-gray-500">{course.name}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="border-t border-gray-200">
                    <button
                      onClick={() => { setShowEnrollModal(true); setShowCourseDropdown(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Course
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resize Handle */}
        {sidebarOpen && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="hidden lg:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors group"
          >
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 bg-gray-300 group-hover:bg-blue-500 rounded-l transition-colors" />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
                title={sidebarOpen ? 'Collapse chat history' : 'Expand chat history'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                  />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-md uppercase tracking-[0.3em] text-gray-400">{`${activeCourseName}`}</p>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">{currentChatTitle}</h1>
                <p className="text-sm text-gray-500">
                  {!isPublicPreview && (!courseCode || courseCode === 'GENERAL') && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <span>⚠️</span>
                      <span>
                        No course context selected. Answers may be less accurate. Select a course for better results.
                      </span>
                    </div>
                  )}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {!isPublicPreview && canOpenStudentTools && (
                <button
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setShowToolsDrawer(true);
                  }}
                  className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition"
                  title="Open learning tools"
                >
                  {toolsButtonLabel}
                </button>
              )}

              {/* Settings Menu */}
              <div className="relative">
              {isPublicPreview ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/login')}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition"
                  >
                    Create account
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
                    title="Account & Settings"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {showSettingsMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">{user?.full_name || user?.username}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                        <p className="text-xs text-gray-400 mt-1 capitalize">Role: {user?.role}</p>
                      </div>

                      <div className="py-2">
                        <button
                          onClick={handleAccountSettings}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.5 1.5H3.75A2.25 2.25 0 001.5 3.75v12.5A2.25 2.25 0 003.75 18.5h12.5a2.25 2.25 0 002.25-2.25V9.5m-15-4h12m-12 4v8m12-8v3m0-3l4.5-4.5m0 0L20 1.5" />
                          </svg>
                          Account Settings
                        </button>

                        <button
                          onClick={handleGeneralSettings}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM11 13a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
                          </svg>
                          Settings
                        </button>
                      </div>

                      <div className="border-t border-gray-200 py-2">
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          </div>
        </div>

        {!isPublicPreview && canOpenStudentTools && (
          <TopToolsDrawer
            open={showToolsDrawer}
            onClose={() => setShowToolsDrawer(false)}
            token={token || ''}
            role={user?.role}
            userId={user?.id}
            selectedCourseCode={courseCode}
            selectedCourseName={courseName}
            activeEnrollmentContext={activeEnrollmentContext}
            enrollmentContextByCourse={enrollmentContextByCourse}
            enrolledCourses={enrolledCourses}
          />
        )}

        {/* Messages Container */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-8 py-8">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-lg bg-white border border-gray-200 rounded-3xl px-8 py-10 shadow-lg">
                <div className="text-5xl mb-4">💡</div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">Drop your first prompt</h2>
                <p className="text-gray-500">
                  {isPublicPreview
                    ? 'This preview uses our demo corpus so you can feel the real chat flow. Sign in when you are ready to bring in your lecturers and uploads.'
                    : `You’re currently exploring ${activeCourseName}. Ask EduSmart a question to get started. I’m here to help you master the material.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-2xl ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-3xl rounded-tr-none px-5 py-3 shadow-lg shadow-blue-200'
                        : 'bg-white text-gray-900 rounded-3xl rounded-tl-none px-5 py-3 border border-gray-100 shadow'
                    }`}
                  >
                    {/* <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p> */}
                    <MarkdownMessage content={msg.content} />
                    {msg.timestamp && (
                      <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-2">Lecturer citations</p>
                        <div className="space-y-2">
                          {msg.citations.map((citation, citationIdx) => (
                            <div key={citation.id || `citation-${citationIdx}`} className="text-xs text-gray-600">
                              <p className="font-semibold text-gray-800">{citation.title}</p>
                              {citation.snippet && <p className="text-gray-500 mt-1">{citation.snippet}</p>}
                              <p className="text-[11px] text-gray-400 mt-1">{citation.source ? `Source: ${citation.source}` : 'Lecturer upload'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.hiddenCitationCount && (
                      <p className="text-[11px] text-amber-600 mt-2">
                        Hidden {msg.hiddenCitationCount} reference{msg.hiddenCitationCount > 1 ? 's' : ''} because they were not uploaded by verified lecturers.
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-500 rounded-3xl rounded-tl-none px-5 py-3 border border-gray-100 shadow">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-4 sm:px-8 py-3 bg-red-50 border-l-4 border-red-400">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white px-4 sm:px-8 py-6">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto w-full">
            <div className="bg-white border border-gray-200 rounded-3xl px-4 sm:px-6 py-4 shadow-xl space-y-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setShowComposerExtras(prev => !prev)}
                  disabled={isPublicPreview}
                  className={`p-2 rounded-2xl border ${showComposerExtras ? 'border-blue-500 text-blue-600' : 'border-gray-200 text-gray-500'} bg-white hover:border-blue-500 hover:text-blue-600 transition ${isPublicPreview ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-pressed={showComposerExtras}
                  title={isPublicPreview ? 'Sign in to attach lecturer uploads' : 'Composer options'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={`Ask EduSmart anything about ${activeCourseName || 'this course'}...`}
                  className="flex-1 bg-transparent border-none text-base text-gray-900 placeholder:text-gray-400 focus:ring-0 focus:outline-none resize-none min-h-[56px] max-h-48"
                  rows={1}
                  disabled={isLoading}
                  maxLength={2000}
                />

                <div className="flex items-center">
                  <button
                    type="submit"
                    disabled={isLoading || !inputValue.trim()}
                    className="p-2.5 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-blue-200"
                    title="Send"
                  >
                    {isLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {!isPublicPreview && showComposerExtras && (
                <div className="border border-dashed border-gray-300 rounded-2xl px-4 py-4 text-sm text-gray-600 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-800">Attach supporting material</p>
                      <p className="text-xs text-gray-500">PDF, DOCX, or PPTX files are accepted and will sync straight into the RAG folders.</p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition cursor-pointer">
                      <input
                        ref={referenceFileInputRef}
                        type="file"
                        accept=".pdf,.docx,.pptx"
                        className="hidden"
                        onChange={handleReferenceFileChange}
                        disabled={isUploadingReference}
                      />
                      <span>{referenceFile ? 'Change file' : 'Choose file'}</span>
                    </label>
                  </div>

                  {referenceFile && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{referenceFile.name}</p>
                        <p className="text-xs text-gray-500">{(referenceFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearReferenceFile}
                        className="text-sm text-gray-500 hover:text-red-500 transition"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleReferenceUpload}
                      disabled={!referenceFile || isUploadingReference}
                      className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {isUploadingReference ? 'Uploading...' : 'Upload to knowledge base'}
                    </button>
                    {isUploadingReference && <span className="text-xs text-gray-500">Processing and syncing to RAG...</span>}
                  </div>

                  {referenceUploadFeedback && (
                    <div className={`text-sm ${referenceUploadFeedback.kind === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {referenceUploadFeedback.text}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                    </svg>
                    Press Enter to send
                  </span>
                  <span className="hidden sm:inline">• Shift + Enter for new line</span>
                  {isPublicPreview && (
                    <span className="flex items-center gap-1 text-blue-700 font-medium">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.166 12.334L8.5 3.5l5.053 4.79 2.167-.98L11.5 1.5l-9 12.5h5l-1 4.5 5.834-6.166L11 10l-4.334 2.334h-4.5z" />
                      </svg>
                      Demo mode uses {PUBLIC_PREVIEW_COURSE.name} references
                    </span>
                  )}
                </div>
                <span>{inputValue.length}/2000</span>
              </div>

              {isPublicPreview && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900 space-y-3">
                  <p className="font-semibold">Flip this into your real LMS: sign in and EduSmart will cite your lecturers, rubrics, and uploader docs.</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition"
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="px-4 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100 transition"
                    >
                      Create account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Switch Course Confirmation Modal */}
        {!isPublicPreview && showSwitchCourseConfirm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl shadow-blue-100/80 p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
                  ⚠️
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Switch course?</h2>
                  <p className="text-sm text-gray-500">You will start fresh, but {activeCourseName} chats stay in the sidebar.</p>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-6">
                We will automatically keep your existing chats organized, so you can switch courses without losing anything.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={confirmSwitchCourse}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 font-medium transition"
                >
                  Continue
                </button>
                <button
                  onClick={() => {
                    setPendingCourseSelection(null);
                    setShowSwitchCourseConfirm(false);
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 font-medium transition"
                >
                  Stay here
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enrollment Modal */}
        {!isPublicPreview && showEnrollModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">Enroll in Course</h2>
                <button onClick={() => { setShowEnrollModal(false); setEnrollError(null); setSearchResults([]); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {enrollError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{enrollError}</div>
              )}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enrollment Key</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={enrollmentKey}
                      onChange={(e) => setEnrollmentKey(e.target.value)}
                      placeholder="Enter enrollment key"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleEnrollByKey}
                      disabled={!enrollmentKey.trim() || isEnrolling}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {isEnrolling ? 'Enrolling...' : 'Enroll'}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Open Courses</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchCourseCode}
                      onChange={(e) => setSearchCourseCode(e.target.value)}
                      placeholder="Enter course code"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSearchOfferings}
                      disabled={!searchCourseCode.trim()}
                      className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Search
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                      {searchResults.map((offering) => (
                        <div key={offering.id} className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{offering.course_code}</div>
                              <div className="text-xs text-gray-500">
                                {offering.term} {offering.year} {offering.section && `• Section ${offering.section}`}
                              </div>
                            </div>
                            <button
                              onClick={() => handleEnrollInOffering(offering.id, offering.course_code)}
                              disabled={isEnrolling}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
                            >
                              Enroll
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enrollment Success Modal */}
        {!isPublicPreview && showEnrollSuccess && enrolledCourseInfo && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl p-6 max-w-md w-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Successfully Enrolled!</h2>
                <p className="text-gray-600 mb-6">You've been enrolled in:</p>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                  <div className="text-lg font-semibold text-blue-900">{enrolledCourseInfo.code}</div>
                  <div className="text-sm text-blue-700">{enrolledCourseInfo.name}</div>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  You can now access course materials and start chatting with EduSmart in the context of this course.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      handleSelectCourse(enrolledCourseInfo);
                      setShowEnrollSuccess(false);
                    }}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition"
                  >
                    Start Chatting in {enrolledCourseInfo.code}
                  </button>
                  <button
                    onClick={() => setShowEnrollSuccess(false)}
                    className="w-full px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition"
                  >
                    Continue Browsing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Public Preview Limit Modal */}
        {isPublicPreview && showPublicLimitModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-blue-100 rounded-3xl shadow-2xl shadow-blue-200/60 p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">✨</div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Ready for the real thing?</h2>
                  <p className="text-sm text-gray-500">Sign in to keep the chat going with your own lecturers, rubrics, and course packs.</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                The public preview gives you three prompts. Unlock unlimited chats, uploads, and course selection by logging in or creating an account.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 font-semibold transition"
                >
                  Log in to continue
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="flex-1 px-4 py-2.5 border border-blue-200 text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition"
                >
                  Create account
                </button>
              </div>
              <button
                onClick={() => setShowPublicLimitModal(false)}
                className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
