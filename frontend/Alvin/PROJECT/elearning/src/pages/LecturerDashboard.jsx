// src/pages/LecturerDashboard.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LecturerDashboard.css';

/* ─── Icons ─────────────────────────────────────────────────── */
const Ico = {
  layers:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  plus:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  upload:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  chat:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  logout:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  send:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  file:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  trash:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  book:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  check:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  close:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  brain:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="12" rx="8" ry="6"/><path d="M12 6v6l4 2"/></svg>,
  stats:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  chevron: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ai:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M12 8v4l3 3"/></svg>,
  warn:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  user:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

/* ─── University courses ─────────────────────────────────────── */
const DEPARTMENTS = [
  {
    dept: 'Computer Science',
    short: 'CS',
    courses: [
      { code: 'CS101', name: 'Introduction to Programming' },
      { code: 'CS201', name: 'Data Structures & Algorithms' },
      { code: 'CS301', name: 'Database Systems' },
      { code: 'CS401', name: 'Artificial Intelligence' },
      { code: 'CS402', name: 'Computer Networks' },
      { code: 'CS403', name: 'Operating Systems' },
    ],
  },
  {
    dept: 'Software Engineering',
    short: 'SE',
    courses: [
      { code: 'SE101', name: 'Software Development Fundamentals' },
      { code: 'SE201', name: 'Software Design & Architecture' },
      { code: 'SE301', name: 'Software Testing & QA' },
      { code: 'SE401', name: 'Agile Project Management' },
      { code: 'SE402', name: 'Mobile App Development' },
    ],
  },
  {
    dept: 'Information Technology',
    short: 'IT',
    courses: [
      { code: 'IT101', name: 'IT Fundamentals' },
      { code: 'IT201', name: 'Cybersecurity Essentials' },
      { code: 'IT301', name: 'Cloud Computing' },
      { code: 'IT401', name: 'IT Project Management' },
      { code: 'IT402', name: 'Systems Analysis & Design' },
    ],
  },
  {
    dept: 'Civil Engineering',
    short: 'CE',
    courses: [
      { code: 'CE101', name: 'Engineering Mathematics I' },
      { code: 'CE201', name: 'Structural Analysis' },
      { code: 'CE301', name: 'Geotechnical Engineering' },
      { code: 'CE401', name: 'Transportation Engineering' },
      { code: 'CE402', name: 'Environmental Engineering' },
    ],
  },
  {
    dept: 'Electrical Engineering',
    short: 'EE',
    courses: [
      { code: 'EE101', name: 'Circuit Theory' },
      { code: 'EE201', name: 'Electronics I' },
      { code: 'EE301', name: 'Power Systems' },
      { code: 'EE401', name: 'Control Systems' },
      { code: 'EE402', name: 'Digital Signal Processing' },
    ],
  },
  {
    dept: 'Mechanical Engineering',
    short: 'ME',
    courses: [
      { code: 'ME101', name: 'Engineering Mechanics' },
      { code: 'ME201', name: 'Thermodynamics' },
      { code: 'ME301', name: 'Fluid Mechanics' },
      { code: 'ME401', name: 'Manufacturing Processes' },
      { code: 'ME402', name: 'Machine Design' },
    ],
  },
];

const ALL_COURSES = DEPARTMENTS.flatMap(d => d.courses);

const BLOOM_LEVELS = [
  { label: 'Remember',   color: '#64748b', desc: 'Recall facts and basic concepts' },
  { label: 'Understand', color: '#3b82f6', desc: 'Explain ideas and concepts' },
  { label: 'Apply',      color: '#8b5cf6', desc: 'Use information in new situations' },
  { label: 'Analyze',    color: '#f59e0b', desc: 'Draw connections and identify patterns' },
  { label: 'Evaluate',   color: '#ef4444', desc: 'Justify a decision or course of action' },
  { label: 'Create',     color: '#22c55e', desc: 'Produce new or original work' },
];

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'LT';

const fmtTime = (d) =>
  d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ══════════════════  COMPONENT  ════════════════════════════ */
export default function LecturerDashboard() {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const defaultCourse = ALL_COURSES[0];

  const [selectedCourse,  setSelectedCourse]  = useState(defaultCourse);
  const [bloomLevel,      setBloomLevel]      = useState('Apply');
  const [question,        setQuestion]        = useState('');
  const [messages,        setMessages]        = useState([]);
  const [isThinking,      setIsThinking]      = useState(false);
  const [isOnline,        setIsOnline]        = useState(navigator.onLine);
  const [chats,           setChats]           = useState([
    { id: 1, title: 'New chat', course: defaultCourse.code, active: true },
  ]);
  const [activeChatId,    setActiveChatId]    = useState(1);
  const [uploadModal,     setUploadModal]     = useState(false);
  const [uploadedFiles,   setUploadedFiles]   = useState([]);
  const [dragOver,        setDragOver]        = useState(false);
  const [statsPanel,      setStatsPanel]      = useState(false);
  const [courseDropdown,  setCourseDropdown]  = useState(false);
  const [activeDept,      setActiveDept]      = useState(DEPARTMENTS[0].dept);
  const [toast,           setToast]           = useState(null);
  const [logoutModal,     setLogoutModal]     = useState(false);
  const [activeChat,      setActiveChat]      = useState('New chat');

  const messagesEndRef = useRef(null);
  const fileInputRef   = useRef(null);
  const textareaRef    = useRef(null);
  const dropdownRef    = useRef(null);

  // ── Effects ──────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCourseDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleNewChat = () => {
    const newId = Date.now();
    const newChat = { id: newId, title: 'New chat', course: selectedCourse.code, active: true };
    setChats(prev => [newChat, ...prev.map(c => ({ ...c, active: false }))]);
    setActiveChatId(newId);
    setActiveChat('New chat');
    setMessages([]);
  };

  const handleSelectChat = (id) => {
    const chat = chats.find(c => c.id === id);
    setChats(prev => prev.map(c => ({ ...c, active: c.id === id })));
    setActiveChatId(id);
    setActiveChat(chat?.title || 'New chat');
    setMessages([]);
  };

  const handleDeleteChat = (e, id) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) { setMessages([]); setActiveChat('New chat'); }
  };

  const handleSend = async () => {
    if (!question.trim() || isThinking) return;
    const userMsg = { role: 'user', content: question.trim(), time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const q = question.trim();
    setQuestion('');
    setIsThinking(true);

    await new Promise(r => setTimeout(r, 1600));

    const aiResponse =
      `Here is a response at the **${bloomLevel}** cognitive level for **${selectedCourse.code} — ${selectedCourse.name}**:\n\n` +
      `This is a placeholder AI response. In production, EduSmart connects to the AI backend using your uploaded course materials to generate CBC-aligned answers tailored to the selected Bloom's Taxonomy level.\n\n` +
      `At the **${bloomLevel}** level, students are expected to: ${BLOOM_LEVELS.find(b => b.label === bloomLevel)?.desc.toLowerCase()}.`;

    setMessages(prev => [...prev, { role: 'ai', content: aiResponse, time: new Date(), bloom: bloomLevel }]);
    setIsThinking(false);

    const newTitle = q.slice(0, 32) + (q.length > 32 ? '…' : '');
    setActiveChat(newTitle);
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, title: newTitle } : c));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFiles = (files) => {
    const newFiles = Array.from(files).map(f => ({
      id: Date.now() + Math.random(),
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      type: f.name.split('.').pop().toUpperCase(),
      date: new Date().toLocaleDateString('en-GB'),
      course: selectedCourse.code,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    showToast(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded for ${selectedCourse.code}`);
    setUploadModal(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleLogoutConfirm = async () => {
    setLogoutModal(false);
    await logout();
    navigate('/', { replace: true });
  };

  const handleCourseSelect = (course) => {
    setSelectedCourse(course);
    setCourseDropdown(false);
  };

  const activeBloom      = BLOOM_LEVELS.find(b => b.label === bloomLevel);
  const currentDeptCourses = DEPARTMENTS.find(d => d.dept === activeDept)?.courses || [];
  const userName         = user?.fullName || user?.full_name || 'Lecturer';
  const userEmail        = user?.email || '';
  const userMustId       = user?.mustId || user?.must_id || '';

  return (
    <div className="ld">

      {/* ══ TOAST ══ */}
      {toast && (
        <div className={`ld-toast ld-toast--${toast.type}`}>
          <span className="ld-toast-ico"><Ico.check /></span>
          {toast.msg}
        </div>
      )}

      {/* ══ LOGOUT CONFIRMATION MODAL ══ */}
      {logoutModal && (
        <div className="ld-overlay" onClick={() => setLogoutModal(false)}>
          <div className="ld-modal ld-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="ld-modal-header">
              <div className="ld-logout-warn-ico"><Ico.warn /></div>
              <h2>Confirm Logout</h2>
              <button className="ld-modal-close" onClick={() => setLogoutModal(false)}><Ico.close /></button>
            </div>
            <div className="ld-logout-body">
              <p>Are you sure you want to log out of EduSmart?</p>
              <p className="ld-logout-sub">Any unsaved chat history will be lost.</p>
            </div>
            <div className="ld-modal-footer">
              <button className="ld-modal-cancel" onClick={() => setLogoutModal(false)}>Stay Logged In</button>
              <button className="ld-modal-logout-confirm" onClick={handleLogoutConfirm}>
                <Ico.logout /> Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SIDEBAR ══ */}
      <aside className="ld-sidebar">

        {/* Logo */}
        <div className="ld-logo">
          <div className="ld-logo-icon"><Ico.layers /></div>
          <span className="ld-logo-name">Edu<span>Smart</span></span>
        </div>

        {/* Course Selector */}
        <div className="ld-section-label">Select Course</div>
        <div className="ld-course-wrap" ref={dropdownRef}>
          <button className="ld-course-btn" onClick={() => setCourseDropdown(!courseDropdown)}>
            <div className="ld-course-btn-inner">
              <span className="ld-course-code">{selectedCourse.code}</span>
              <span className="ld-course-fullname">{selectedCourse.name}</span>
            </div>
            <span className={`ld-course-chevron ${courseDropdown ? 'open' : ''}`}><Ico.chevron /></span>
          </button>

          {courseDropdown && (
            <div className="ld-course-dropdown">
              {/* Department tabs */}
              <div className="ld-dept-tabs">
                {DEPARTMENTS.map(d => (
                  <button
                    key={d.dept}
                    className={`ld-dept-tab ${activeDept === d.dept ? 'active' : ''}`}
                    onClick={() => setActiveDept(d.dept)}>
                    {d.short}
                  </button>
                ))}
              </div>
              <div className="ld-dept-name">{activeDept}</div>
              <div className="ld-course-options">
                {currentDeptCourses.map(c => (
                  <button
                    key={c.code}
                    className={`ld-course-option ${c.code === selectedCourse.code ? 'active' : ''}`}
                    onClick={() => handleCourseSelect(c)}>
                    <div className="ld-opt-inner">
                      <span className="ld-opt-code">{c.code}</span>
                      <span className="ld-opt-name">{c.name}</span>
                    </div>
                    {c.code === selectedCourse.code && <span className="ld-tick"><Ico.check /></span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <button className="ld-btn-new" onClick={handleNewChat}>
          <span className="ld-btn-ico"><Ico.plus /></span> New Chat
        </button>
        <button className="ld-btn-upload" onClick={() => setUploadModal(true)}>
          <span className="ld-btn-ico"><Ico.upload /></span> Upload Materials
        </button>
        <button className="ld-btn-stats" onClick={() => setStatsPanel(p => !p)}>
          <span className="ld-btn-ico"><Ico.stats /></span> {statsPanel ? 'Hide Stats' : 'View Stats'}
        </button>

        {/* Recent Chats */}
        <div className="ld-section-label" style={{ marginTop: 12 }}>Recent Chats</div>
        <div className="ld-chats-list">
          {chats.length === 0 && <p className="ld-no-chats">No chats yet</p>}
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`ld-chat-item ${chat.active ? 'active' : ''}`}
              onClick={() => handleSelectChat(chat.id)}>
              <span className="ld-chat-ico"><Ico.chat /></span>
              <div className="ld-chat-info">
                <div className="ld-chat-title">{chat.title}</div>
                <div className="ld-chat-course">{chat.course}</div>
              </div>
              <button className="ld-chat-del" title="Delete chat" onClick={(e) => handleDeleteChat(e, chat.id)}>
                <Ico.trash />
              </button>
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div className="ld-sidebar-spacer" />

        {/* Lecturer Profile Card — bottom of sidebar */}
        <div className="ld-profile-card">
          <div className="ld-profile-avatar">{initials(userName)}</div>
          <div className="ld-profile-info">
            <div className="ld-profile-name">{userName}</div>
            <div className="ld-profile-meta">{userMustId || userEmail}</div>
            <div className="ld-profile-badge">Lecturer</div>
          </div>
        </div>

        {/* Logout */}
        <button className="ld-logout" onClick={() => setLogoutModal(true)}>
          <span className="ld-btn-ico"><Ico.logout /></span> Logout
        </button>
      </aside>

      {/* ══ MAIN ══ */}
      <main className="ld-main">

        {/* ── Header ── */}
        <header className="ld-header">
          <div className="ld-header-left">
            <h1 className="ld-header-title">{activeChat}</h1>
            <span className="ld-header-sub">
              {selectedCourse.code} · {selectedCourse.name} · Lecturer mode
            </span>
          </div>
          <div className="ld-header-right">
            <div className="ld-status">
              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div className="ld-uploaded-count" onClick={() => setUploadModal(true)} title="Manage materials">
              <span className="ld-btn-ico"><Ico.file /></span>
              {uploadedFiles.length} material{uploadedFiles.length !== 1 ? 's' : ''}
            </div>
          </div>
        </header>

        {/* ── Upload Banner (only when no materials) ── */}
        {uploadedFiles.length === 0 && (
          <div className="ld-banner">
            <div className="ld-banner-text">
              <span className="ld-banner-ico"><Ico.book /></span>
              <span>Upload your latest lecture notes for <strong>{selectedCourse.code}</strong> to keep AI responses aligned with CBC competencies.</span>
            </div>
            <button className="ld-banner-btn" onClick={() => setUploadModal(true)}>
              Upload Materials
            </button>
          </div>
        )}

        {/* ── Stats Panel ── */}
        {statsPanel && (
          <div className="ld-stats">
            <div className="ld-stat-card blue">
              <div className="ld-stat-num">{chats.length}</div>
              <div className="ld-stat-lbl">Total Chats</div>
            </div>
            <div className="ld-stat-card green">
              <div className="ld-stat-num">{uploadedFiles.length}</div>
              <div className="ld-stat-lbl">Materials</div>
            </div>
            <div className="ld-stat-card purple">
              <div className="ld-stat-num">{messages.filter(m => m.role === 'user').length}</div>
              <div className="ld-stat-lbl">Questions Asked</div>
            </div>
            <div className="ld-stat-card gold">
              <div className="ld-stat-num">{bloomLevel}</div>
              <div className="ld-stat-lbl">Bloom's Level</div>
            </div>
          </div>
        )}

        {/* ── Materials Strip ── */}
        {uploadedFiles.length > 0 && (
          <div className="ld-materials">
            <div className="ld-materials-header">
              <span><Ico.file /> Materials for {selectedCourse.code} ({uploadedFiles.length})</span>
              <button className="ld-banner-btn" onClick={() => setUploadModal(true)}>+ Add More</button>
            </div>
            <div className="ld-materials-list">
              {uploadedFiles.map(f => (
                <div key={f.id} className="ld-mat-item">
                  <span className="ld-mat-type">{f.type}</span>
                  <div className="ld-mat-info">
                    <span className="ld-mat-name">{f.name}</span>
                    <span className="ld-mat-meta">{f.size} · {f.date}</span>
                  </div>
                  <button className="ld-mat-del" onClick={() => setUploadedFiles(prev => prev.filter(x => x.id !== f.id))}>
                    <Ico.trash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Chat Area ── */}
        <div className="ld-chat-area">
          {messages.length === 0 && !isThinking ? (
            <div className="ld-empty">
              <div className="ld-empty-icon"><Ico.brain /></div>
              <h3>Start the conversation by sending a question.</h3>
              <p>
                You are in <strong>{selectedCourse.code} — {selectedCourse.name}</strong> mode.<br />
                Select a Bloom's Taxonomy level below, then ask anything about your course content.
              </p>
            </div>
          ) : (
            <div className="ld-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`ld-msg ld-msg--${msg.role}`}>
                  {msg.role === 'ai' && <div className="ld-ai-avatar"><Ico.ai /></div>}
                  <div className="ld-msg-bubble">
                    {msg.role === 'ai' && msg.bloom && (
                      <div className="ld-msg-bloom"
                        style={{
                          background: BLOOM_LEVELS.find(b => b.label === msg.bloom)?.color + '1a',
                          color:      BLOOM_LEVELS.find(b => b.label === msg.bloom)?.color,
                          borderColor:BLOOM_LEVELS.find(b => b.label === msg.bloom)?.color + '44',
                        }}>
                        {msg.bloom} level
                      </div>
                    )}
                    <p>{msg.content}</p>
                    <span className="ld-msg-time">{fmtTime(msg.time)}</span>
                  </div>
                  {msg.role === 'user' && (
                    <div className="ld-user-avatar">{initials(userName)}</div>
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="ld-msg ld-msg--ai">
                  <div className="ld-ai-avatar"><Ico.ai /></div>
                  <div className="ld-msg-bubble ld-thinking">
                    <span/><span/><span/>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input Area ── */}
        <div className="ld-input-area">
          <div className="ld-bloom-row">
            <span className="ld-bloom-label">BLOOM'S LEVEL</span>
            <div className="ld-bloom-pills">
              {BLOOM_LEVELS.map(b => (
                <button
                  key={b.label}
                  className={`ld-bloom-pill ${bloomLevel === b.label ? 'active' : ''}`}
                  style={bloomLevel === b.label
                    ? { background: b.color, borderColor: b.color, color: '#fff' }
                    : {}}
                  onClick={() => setBloomLevel(b.label)}
                  title={b.desc}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ld-bloom-hint" style={{ borderLeftColor: activeBloom?.color }}>
            <strong style={{ color: activeBloom?.color }}>{bloomLevel}:</strong> {activeBloom?.desc}
          </div>

          <div className="ld-input-row">
            <textarea
              ref={textareaRef}
              className="ld-textarea"
              placeholder={`Ask about ${selectedCourse.name}, CBC competencies, student assessments…`}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button
              className="ld-send-btn"
              onClick={handleSend}
              disabled={!question.trim() || isThinking}>
              <Ico.send />
            </button>
          </div>
          <p className="ld-input-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</p>
        </div>
      </main>

      {/* ══ UPLOAD MODAL ══ */}
      {uploadModal && (
        <div className="ld-overlay" onClick={() => setUploadModal(false)}>
          <div className="ld-modal" onClick={e => e.stopPropagation()}>
            <div className="ld-modal-header">
              <h2>Upload Course Materials</h2>
              <button className="ld-modal-close" onClick={() => setUploadModal(false)}><Ico.close /></button>
            </div>
            <div className="ld-modal-course">
              Uploading for: <strong>{selectedCourse.code} — {selectedCourse.name}</strong>
            </div>
            <div
              className={`ld-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}>
              <div className="ld-drop-icon"><Ico.upload /></div>
              <p className="ld-drop-title">Drag & drop files here</p>
              <p className="ld-drop-sub">or click to browse · PDF, DOCX, PPTX, TXT supported · Max 20MB</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
            {uploadedFiles.length > 0 && (
              <div className="ld-modal-files">
                <div className="ld-modal-files-header">Already uploaded ({uploadedFiles.length})</div>
                {uploadedFiles.map(f => (
                  <div key={f.id} className="ld-modal-file-item">
                    <span className="ld-mat-type">{f.type}</span>
                    <span className="ld-mat-name" style={{flex:1}}>{f.name}</span>
                    <span className="ld-mat-meta">{f.size}</span>
                    <button className="ld-mat-del" onClick={() => setUploadedFiles(prev => prev.filter(x => x.id !== f.id))}>
                      <Ico.trash />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="ld-modal-footer">
              <button className="ld-modal-cancel" onClick={() => setUploadModal(false)}>Cancel</button>
              <button className="ld-modal-done" onClick={() => { setUploadModal(false); showToast('Materials saved for ' + selectedCourse.code); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}