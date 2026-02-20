import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageNav from './PageNav';
import './PageNav.css';
import './InfoPage.css';

/* Social icons */
const XIcon = ()=>(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const WaIcon = ()=>(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.116 1.528 5.845L.057 23.571l5.865-1.539A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.498-5.24-1.371l-.376-.222-3.478.913.927-3.388-.246-.389A10 10 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
);
const IgIcon = ()=>(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

const team = [
  {initials:'AM',name:'Alex M.',        role:'Lead Developer & System Architect',       bio:'Designed and implemented the full-stack EduSmart platform including the RAG pipeline, vector database integration and React frontend.'},
  {initials:'PK',name:'Patricia K.',    role:'AI & NLP Engineer',                       bio:'Built the Bloom\'s Taxonomy classification engine and prompt engineering pipeline that powers the intelligent question-answer system.'},
  {initials:'JO',name:'James O.',       role:'Backend & Database Engineer',             bio:'Architected the PostgreSQL database schema, JWT authentication system, and the file processing pipeline for material ingestion.'},
  {initials:'SN',name:'Sarah N.',       role:'UX Designer & Frontend Developer',        bio:'Designed the student and lecturer dashboard interfaces with a focus on usability, gamification and accessibility for MUST students.'},
];

const timeline = [
  {year:'2024 Q1',event:'Project inception — research into AI tools for Ugandan university students'},
  {year:'2024 Q2',event:'Architecture design: RAG pipeline, vector store, Bloom\'s classification engine'},
  {year:'2024 Q3',event:'MVP development: authentication, material upload, basic AI Q&A'},
  {year:'2024 Q4',event:'Bloom\'s Taxonomy detection integrated into the AI response system'},
  {year:'2025 Q1',event:'Gamification system built: XP, levels, badges and streaks added'},
  {year:'2025 Q2',event:'Pilot testing with 200 MUST students across 3 departments'},
  {year:'2025 Q3',event:'Full deployment — 6 departments, 10,000+ students, 500+ lecturers'},
  {year:'2026',   event:'Continuous improvement — expanding to more MUST courses and departments'},
];

export default function AboutPage() {
  useEffect(()=>{ window.scrollTo(0,0); },[]);

  return (
    <div className="ip-page">
      <PageNav/>

      {/* HERO */}
      <section className="ip-hero ip-hero-gold">
        <div className="ip-hero-inner">
          <div className="ip-hero-badge">About the Project</div>
          <h1 className="ip-hero-title">About <span className="ip-gold">EduSmart</span></h1>
          <p className="ip-hero-sub">
            EduSmart is an AI-powered academic learning support system built specifically for Mbarara University of Science and Technology (MUST), Uganda.
          </p>
        </div>
        <div className="ip-hero-wave">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f0f4fa"/></svg>
        </div>
      </section>

      {/* MISSION */}
      <section className="ip-section ip-bg-light">
        <div className="ip-container">
          <div className="ip-two-col">
            <div>
              <h2 className="ip-sub-title">Our Mission</h2>
              <p className="ip-body-text">
                EduSmart exists to bridge the gap between the vast knowledge available through artificial intelligence and the specific academic needs of students at Mbarara University of Science and Technology.
              </p>
              <p className="ip-body-text">
                We believe that every MUST student deserves access to instant, accurate, and personalised academic support — regardless of the time, their financial situation, or their access to tutors. EduSmart makes this possible.
              </p>
              <p className="ip-body-text">
                By combining Retrieval-Augmented Generation (RAG) with Bloom's Taxonomy cognitive framework and CBC curriculum alignment, EduSmart goes far beyond a generic AI chatbot — it is a purpose-built academic companion for Uganda's university students.
              </p>
            </div>
            <div className="ip-mission-card">
              <div className="ip-mission-icon">🎯</div>
              <h3>Core Principles</h3>
              <ul className="ip-mission-list">
                <li>✓ Accuracy — answers grounded in your actual course materials via RAG</li>
                <li>✓ Depth — Bloom's Taxonomy ensures responses match cognitive needs</li>
                <li>✓ Inclusivity — available to every MUST student, 24 hours a day</li>
                <li>✓ Alignment — every answer respects Uganda's CBC curriculum framework</li>
                <li>✓ Motivation — gamification encourages consistent daily engagement</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IS EDUSMART */}
      <section className="ip-section">
        <div className="ip-container">
          <div className="ip-section-header">
            <h2>What Exactly Is EduSmart?</h2>
            <p>A brief technical and academic overview of the system</p>
          </div>
          <div className="ip-about-cards">
            <div className="ip-about-card">
              <div className="ip-about-num">01</div>
              <h3>An AI Learning Support System</h3>
              <p>EduSmart is a web-based application that allows MUST students to ask questions about their course content and receive intelligent, contextually accurate answers powered by large language models (LLMs).</p>
            </div>
            <div className="ip-about-card">
              <div className="ip-about-num">02</div>
              <h3>Powered by RAG Technology</h3>
              <p>Unlike generic AI tools, EduSmart uses Retrieval-Augmented Generation — a technique that searches uploaded course materials in a vector database before generating any answer. This means every response is grounded in your actual syllabus content.</p>
            </div>
            <div className="ip-about-card">
              <div className="ip-about-num">03</div>
              <h3>Bloom's Taxonomy Integration</h3>
              <p>A custom prompt engineering layer classifies every student question across Benjamin Bloom's six cognitive levels — Remember, Understand, Apply, Analyse, Evaluate, Create — and adjusts the AI's response depth and structure accordingly.</p>
            </div>
            <div className="ip-about-card">
              <div className="ip-about-num">04</div>
              <h3>A Full Learning Ecosystem</h3>
              <p>EduSmart is not just a chatbot — it is a complete platform with role-based dashboards for students and lecturers, material management, gamified progress tracking, course-level analytics, and offline support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="ip-section ip-bg-light">
        <div className="ip-container">
          <div className="ip-section-header">
            <h2>Development Timeline</h2>
            <p>How EduSmart evolved from an idea to a platform serving MUST's university community</p>
          </div>
          <div className="ip-timeline">
            {timeline.map((t,i)=>(
              <div key={i} className="ip-timeline-item">
                <div className="ip-timeline-dot"/>
                <div className="ip-timeline-year">{t.year}</div>
                <div className="ip-timeline-event">{t.event}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="ip-section">
        <div className="ip-container">
          <div className="ip-section-header">
            <h2>The Team Behind EduSmart</h2>
            <p>A multidisciplinary team of MUST students and graduates passionate about educational technology</p>
          </div>
          <div className="ip-team-grid">
            {team.map((m,i)=>(
              <div key={i} className="ip-team-card">
                <div className="ip-team-av">{m.initials}</div>
                <div className="ip-team-name">{m.name}</div>
                <div className="ip-team-role">{m.role}</div>
                <p className="ip-team-bio">{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONNECT / SOCIAL */}
      <section className="ip-section ip-bg-dark">
        <div className="ip-container">
          <div className="ip-section-header ip-light">
            <h2>Connect with EduSmart</h2>
            <p>Follow us on social media, reach us on WhatsApp, or share feedback</p>
          </div>
          <div className="ip-social-grid">
            <a href="https://x.com/edusmart_must" target="_blank" rel="noreferrer" className="ip-social-card ip-social-x">
              <XIcon/>
              <div className="ip-social-name">X (Twitter)</div>
              <div className="ip-social-handle">@edusmart_must</div>
              <p>Latest updates, feature announcements and academic tips</p>
            </a>
            <a href="https://wa.me/256700000000" target="_blank" rel="noreferrer" className="ip-social-card ip-social-wa">
              <WaIcon/>
              <div className="ip-social-name">WhatsApp</div>
              <div className="ip-social-handle">+256 700 000 000</div>
              <p>Direct support for students and lecturers — ask anything</p>
            </a>
            <a href="https://instagram.com/edusmart_must" target="_blank" rel="noreferrer" className="ip-social-card ip-social-ig">
              <IgIcon/>
              <div className="ip-social-name">Instagram</div>
              <div className="ip-social-handle">@edusmart_must</div>
              <p>Behind the scenes, student success stories and platform previews</p>
            </a>
          </div>
          <div className="ip-contact-note">
            <p>For academic partnerships, institutional access or technical enquiries, reach us at <strong>edusmart@must.ac.ug</strong></p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="ip-cta">
        <div className="ip-container ip-cta-inner">
          <h2>Be part of the EduSmart community</h2>
          <p>Join thousands of MUST students already learning smarter with AI.</p>
          <div style={{display:'flex',gap:'14px',justifyContent:'center',flexWrap:'wrap',marginTop:'8px'}}>
            <Link to="/login" className="ip-cta-btn">Login Now →</Link>
            <Link to="/how-it-works" className="ip-cta-btn ip-cta-btn-outline">How It Works</Link>
          </div>
        </div>
      </section>

      <footer className="ip-footer">
        <div className="ip-container">
          <p>© 2026 EduSmart · Mbarara University of Science and Technology</p>
          <div className="ip-footer-links">
            <Link to="/">Home</Link>
            <Link to="/features">Features</Link>
            <Link to="/benefits">Benefits</Link>
            <Link to="/login">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}