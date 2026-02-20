import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

/* ── Icons ── */
const BookOpen = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
  </svg>
);
const Users = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
  </svg>
);
const TrendingUp = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
  </svg>
);
const Sparkles = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
  </svg>
);
const ArrowRight = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/>
  </svg>
);
const Check = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
  </svg>
);
const Menu = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
);
const X = ({className})=>(
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
  </svg>
);

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [scrollY,      setScrollY]      = useState(0);

  useEffect(()=>{
    const h=()=>setScrollY(window.scrollY);
    window.addEventListener('scroll',h);
    return()=>window.removeEventListener('scroll',h);
  },[]);

  const features = [
    {icon:<BookOpen className="icon-large"/>,  title:"CBC-Aligned Content",         description:"All learning materials are carefully structured to align with the Competence-Based Curriculum, ensuring you learn what actually matters for your academic growth.", color:"blue-cyan"},
    {icon:<Users className="icon-large"/>,     title:"Built for Students & Lecturers",description:"Whether you are a student seeking clarity or a lecturer sharing knowledge, EduSmart gives each user a tailored experience designed for their role.",color:"purple-pink"},
    {icon:<TrendingUp className="icon-large"/>,title:"Track Your Progress",          description:"Go beyond exam scores. Monitor your skill development, see how far you have come, and stay motivated with real-time learning insights.",color:"orange-red"},
    {icon:<Sparkles className="icon-large"/>,  title:"Smart AI Assistant",           description:"Stuck on a concept? Ask EduSmart AI any question at any time and receive clear, friendly explanations that make difficult topics easy to understand.",color:"green-emerald"},
  ];

  useEffect(()=>{
    const t=setInterval(()=>setCurrentSlide(p=>(p+1)%features.length),4000);
    return()=>clearInterval(t);
  },[features.length]);

  const benefits = [
    "Understand concepts clearly with step-by-step AI explanations",
    "Ask any question freely — no judgment, no waiting",
    "Build skills that matter beyond your final exam score",
    "Access CBC-aligned university materials anytime, anywhere",
    "Track your learning journey and celebrate your progress",
    "Study smarter with a platform built for MUST students",
  ];

  return (
    <div className="landing-page">
      <div className="background-shapes">
        <div className="shape shape-1"/><div className="shape shape-2"/><div className="shape shape-3"/>
      </div>

      {/* NAVBAR */}
      <nav className={`navbar ${scrollY>20?'navbar-scrolled':''}`}>
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <div className="logo-icon"><BookOpen className="icon-medium"/></div>
            <span className="logo-text">EDUSMART</span>
          </Link>
          <div className="nav-menu desktop-menu">
            <Link to="/features"   className="nav-link">Features</Link>
            <Link to="/benefits"   className="nav-link">Benefits</Link>
            <Link to="/how-it-works" className="nav-link">How It Works</Link>
            <Link to="/about"      className="nav-link">About</Link>
            <Link to="/login"      className="btn-outline">Login</Link>
          </div>
          <button className="mobile-menu-btn" onClick={()=>setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen?<X className="icon-medium"/>:<Menu className="icon-medium"/>}
          </button>
        </div>
        {isMenuOpen&&(
          <div className="mobile-menu">
            <Link to="/features"     className="nav-link" onClick={()=>setIsMenuOpen(false)}>Features</Link>
            <Link to="/benefits"     className="nav-link" onClick={()=>setIsMenuOpen(false)}>Benefits</Link>
            <Link to="/how-it-works" className="nav-link" onClick={()=>setIsMenuOpen(false)}>How It Works</Link>
            <Link to="/about"        className="nav-link" onClick={()=>setIsMenuOpen(false)}>About</Link>
            <Link to="/login"        className="btn-outline mobile-btn" onClick={()=>setIsMenuOpen(false)}>Login</Link>
          </div>
        )}
      </nav>

      {/* HERO — matches screenshot layout */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge" style={{transform:`translateY(${scrollY*0.08}px)`}}>
            <span>🎓 Mbarara University of Science and Technology</span>
          </div>
          <h1 className="hero-title">
            Your <span className="gradient-text">Learning Journey</span>
            <br/>Starts Here
          </h1>
          <p className="hero-description">
            EduSmart is the AI-powered learning assistant built exclusively for MUST students and lecturers.
            Ask questions freely, access your course materials, and grow skills that go beyond the exam room.
          </p>
          <div className="hero-tip">
            💡 <strong>Tip for new students:</strong> Log in with your MUST ID and start asking the AI questions about your course immediately.
          </div>
          <div className="hero-buttons">
            <Link to="/login" className="btn-hero-primary">
              <span>Get Started Now</span>
              <ArrowRight className="icon-small arrow-icon"/>
            </Link>
            <Link to="/how-it-works" className="btn-hero-secondary">See How It Works</Link>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number blue-gradient">10K+</div>
              <div className="stat-label">Active Learners</div>
            </div>
            <div className="stat-divider"/>
            <div className="stat-item">
              <div className="stat-number purple-gradient">500+</div>
              <div className="stat-label">Lecturers</div>
            </div>
            <div className="stat-divider"/>
            <div className="stat-item">
              <div className="stat-number green-gradient">98%</div>
              <div className="stat-label">Satisfaction</div>
            </div>
          </div>
        </div>

        {/* Hero chat preview card — right side */}
        <div className="hero-visual">
          <div className="hero-card">
            <div className="hero-card-header">
              <div className="hero-card-dots"><span/><span/><span/></div>
              <span className="hero-card-title">EduSmart AI</span>
            </div>
            <div className="hero-card-body">
              <div className="chat-bubble user">
                <span>Can you explain photosynthesis in simple terms?</span>
              </div>
              <div className="chat-bubble ai">
                <div className="ai-avatar"><Sparkles className="icon-tiny"/></div>
                <span>Sure! Photosynthesis is how plants make their own food using sunlight, water, and carbon dioxide. Think of it as a plant's kitchen where light is the energy source…</span>
              </div>
              <div className="chat-bubble user">
                <span>What about the light-dependent reactions?</span>
              </div>
              <div className="chat-typing"><span/><span/><span/></div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS PREVIEW — 3 steps */}
      <section className="how-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">How EduSmart Works</h2>
            <p className="section-description">Three simple steps to smarter learning</p>
          </div>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3>Log In with Your MUST ID</h3>
              <p>Use your university MUST ID and password to securely access your personal dashboard in seconds.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">02</div>
              <h3>Access Your Materials</h3>
              <p>Find all course materials uploaded by your lecturers in one organised place, available anytime.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">03</div>
              <h3>Ask the AI Anything</h3>
              <p>Type any question about your course content and get clear, instant explanations from our AI.</p>
            </div>
          </div>
          <div style={{textAlign:'center',marginTop:'2rem'}}>
            <Link to="/how-it-works" className="btn-hero-secondary" style={{display:'inline-flex',alignItems:'center',gap:'7px'}}>
              Explore Full Guide <ArrowRight className="icon-small"/>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES CAROUSEL */}
      <section className="features-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Why Choose <span className="gradient-text">EduSmart?</span></h2>
            <p className="section-description">Everything you need to succeed at MUST — in one place</p>
          </div>
          <div className="sliding-cards-container">
            {features.map((f,i)=>{
              const offset=(i-currentSlide+features.length)%features.length;
              const isActive=offset===0;
              return(
                <div key={i} className={`feature-card ${f.color} ${isActive?'active':''}`}
                  style={{
                    transform:`translateX(calc(-50% + ${offset*320}px)) scale(${isActive?1:0.85})`,
                    opacity:Math.abs(offset)>2?0:isActive?1:0.5,
                    zIndex:isActive?10:5-Math.abs(offset),
                  }}>
                  <div className="feature-icon">{f.icon}</div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-description">{f.description}</p>
                </div>
              );
            })}
          </div>
          <div className="mobile-features-grid">
            {features.map((f,i)=>(
              <div key={i} className={`feature-card-mobile ${f.color}`}>
                <div className="feature-icon-mobile">{f.icon}</div>
                <h3 className="feature-title-mobile">{f.title}</h3>
                <p className="feature-description-mobile">{f.description}</p>
              </div>
            ))}
          </div>
          <div className="dots-container">
            {features.map((_,i)=>(
              <button key={i} onClick={()=>setCurrentSlide(i)} className={`dot ${currentSlide===i?'active':''}`}/>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:'2rem'}}>
            <Link to="/features" className="btn-hero-secondary" style={{display:'inline-flex',alignItems:'center',gap:'7px'}}>
              See All Features <ArrowRight className="icon-small"/>
            </Link>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="benefits-section">
        <div className="benefits-container">
          <div className="benefits-content">
            <div className="benefits-left">
              <div className="benefits-badge">Built for MUST Students</div>
              <h2 className="benefits-title">Did You <span className="green-gradient-text">Know?</span></h2>
              <p className="benefits-intro">
                Students who actively ask questions and review materials regularly score significantly
                higher and retain knowledge longer. EduSmart makes both effortless.
              </p>
              <div className="benefits-list">
                {benefits.map((b,i)=>(
                  <div key={i} className="benefit-item">
                    <div className="check-icon"><Check className="icon-small"/></div>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <Link to="/benefits" className="benefits-cta">
                Learn About All Benefits <ArrowRight className="icon-small"/>
              </Link>
            </div>
            <div className="benefits-right">
              <div className="signup-card">
                <div className="signup-card-header">
                  <h3>Join EduSmart Today</h3>
                  <p>Choose your role and start your smarter learning journey</p>
                </div>
                <div className="signup-option">
                  <div className="signup-icon student"><Users className="icon-large"/></div>
                  <div>
                    <div className="signup-title">I am a Student</div>
                    <div className="signup-subtitle">Access materials, ask AI questions, track progress</div>
                  </div>
                </div>
                <div className="signup-option">
                  <div className="signup-icon lecturer"><BookOpen className="icon-large"/></div>
                  <div>
                    <div className="signup-title">I am a Lecturer</div>
                    <div className="signup-subtitle">Upload materials and support your students</div>
                  </div>
                </div>
                <Link to="/login" className="btn-signup">Login to Get Started</Link>
                <p className="signup-note">Use your MUST ID to log in — no registration needed.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="cta-card">
            <div className="cta-icon"><Sparkles className="icon-large"/></div>
            <h2 className="cta-title">Ready to Study Smarter at MUST?</h2>
            <p className="cta-description">
              Join thousands of MUST students already using EduSmart to understand their coursework,
              prepare for exams, and build real skills that last beyond university.
            </p>
            <div className="cta-buttons">
              <Link to="/login"   className="btn-cta-primary">Login with Your MUST ID</Link>
              <Link to="/about"   className="btn-cta-secondary">Learn More About Us</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-column footer-brand-col">
              <div className="footer-logo">
                <div className="footer-logo-icon"><BookOpen className="icon-small"/></div>
                <span className="footer-logo-text">EDUSMART</span>
              </div>
              <p className="footer-tagline">AI-powered learning for Mbarara University of Science and Technology students and lecturers.</p>
            </div>
            <div className="footer-column">
              <h4 className="footer-heading">Platform</h4>
              <ul className="footer-links">
                <li><Link to="/features">Features</Link></li>
                <li><Link to="/benefits">Benefits</Link></li>
                <li><Link to="/how-it-works">How It Works</Link></li>
                <li><Link to="/login">Login</Link></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4 className="footer-heading">Learn More</h4>
              <ul className="footer-links">
                <li><Link to="/about">About EduSmart</Link></li>
                <li><a href="https://wa.me/256700000000" target="_blank" rel="noreferrer">WhatsApp Support</a></li>
                <li><a href="https://instagram.com/edusmart_must" target="_blank" rel="noreferrer">Instagram</a></li>
                <li><a href="https://x.com/edusmart_must" target="_blank" rel="noreferrer">X (Twitter)</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4 className="footer-heading">Legal</h4>
              <ul className="footer-links">
                <li><a href="#terms">Terms of Use</a></li>
                <li><a href="#privacy">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 EduSmart · Mbarara University of Science and Technology. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}