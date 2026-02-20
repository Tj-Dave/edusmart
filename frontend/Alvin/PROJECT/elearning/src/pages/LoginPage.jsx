// client/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

/* ─── Icons ─────────────────────────────────────────────── */
const IcoLayers = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
);
const IcoUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IcoLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IcoEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IcoEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const IcoGrad = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const IcoBoard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>
);
const IcoArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IcoAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IcoInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

/* ─── Component ─────────────────────────────────────────── */
export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [mustId,   setMustId]   = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('student');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Already logged in → go straight to dashboard
  if (isAuthenticated && user) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!mustId.trim()) return setError('Please enter your MUST ID.');
    if (!password)      return setError('Please enter your password.');

    setLoading(true);
    try {
      const loggedInUser = await login(mustId.trim(), password, role);
      navigate(`/${loggedInUser.role}/dashboard`, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.message;
      setError(
        status === 429
          ? 'Too many attempts. Please wait 15 minutes.'
          : msg || 'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp">
      <div className="lp-bg" aria-hidden="true" />
      <div className="lp-grid" aria-hidden="true" />

      <div className="lp-card" role="main">
        <div className="lp-stripe" aria-hidden="true" />

        <div className="lp-inner">
          {/* Brand */}
          <div className="lp-brand">
            <div className="lp-logo-wrap" aria-hidden="true"><IcoLayers /></div>
            <h1 className="lp-title">Edu<span>Smart</span></h1>
            <p className="lp-sub">AI assistant for MUST students and lecturers</p>
          </div>

          {/* Form */}
          <form className="lp-form" onSubmit={handleSubmit} noValidate>

            {/* Username Instructions Info Box */}
            <div className="lp-info" role="note" aria-label="Account creation instructions">
              <IcoInfo />
              <div>
                <strong>How to create your username</strong>
                Use your registration number — remove all forward slashes{' '}
                (<code>/</code>) and the <code>PS</code> suffix.
                <br />
                e.g. <code>2025/MBR/110/PS</code> → <code>2025mbr110</code>
              </div>
            </div>

            {/* MUST ID */}
            <div className="lp-field">
              <label htmlFor="mustId" className="lp-label">MUST ID / Username</label>
              <div className="lp-input-wrap">
                <span className="lp-icon"><IcoUser /></span>
                <input
                  id="mustId"
                  className="lp-input"
                  type="text"
                  placeholder="e.g. 2025mbr110"
                  value={mustId}
                  onChange={(e) => setMustId(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="lp-field">
              <label htmlFor="password" className="lp-label">Password</label>
              <div className="lp-input-wrap">
                <span className="lp-icon"><IcoLock /></span>
                <input
                  id="password"
                  className="lp-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button type="button" className="lp-eye"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <IcoEyeOff /> : <IcoEye />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div className="lp-forgot-row">
              <a href="/forgot-password" className="lp-forgot">Forgot password?</a>
            </div>

            {/* Role */}
            <div className="lp-role-group">
              <span className="lp-label">I am a</span>
              <div className="lp-role-toggle" role="group">
                <button type="button"
                  className={`lp-role-btn${role === 'student' ? ' active' : ''}`}
                  onClick={() => setRole('student')} disabled={loading}>
                  <IcoGrad /> Student
                </button>
                <button type="button"
                  className={`lp-role-btn${role === 'lecturer' ? ' active' : ''}`}
                  onClick={() => setRole('lecturer')} disabled={loading}>
                  <IcoBoard /> Lecturer
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="lp-error" role="alert">
                <IcoAlert /><span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="lp-btn" disabled={loading}>
              {loading
                ? <><span className="lp-spin" /> Signing in…</>
                : <>Login <IcoArrow /></>}
            </button>
          </form>
        </div>

        {/* Footer */}
        <footer className="lp-footer">
          <p>© EduSmart · <strong>Mbarara University of Science and Technology</strong></p>
        </footer>
      </div>
    </div>
  );
}