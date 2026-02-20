import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageNav from './PageNav';
import './PageNav.css';
import './InfoPage.css';

export default function FeaturesPage() {
  useEffect(()=>{ window.scrollTo(0,0); },[]);

  const mainFeatures = [
    {
      icon:'🤖', color:'blue',
      title:'AI-Powered Question & Answer',
      desc:'Ask any question in plain English and receive a clear, CBC-aligned explanation instantly. The AI draws directly from your uploaded course materials using RAG so every answer is grounded in your actual syllabus.',
      points:['Available 24/7 — ask anytime, anywhere','No judgment — ask the same question multiple times if needed','Instant responses with follow-up question support'],
    },
    {
      icon:'🧠', color:'purple',
      title:"Bloom's Taxonomy Level Detection",
      desc:'EduSmart automatically classifies the cognitive level of every question — from simple recall (Remember) to complex original thinking (Create) — and structures the AI response accordingly.',
      points:['6-level cognitive framework applied to every answer','Students can manually select a Bloom\'s level from the input area','Lecturers can see which cognitive levels students engage with most'],
    },
    {
      icon:'🔍', color:'teal',
      title:'RAG from Vector Database',
      desc:"Retrieval-Augmented Generation searches your course's actual uploaded materials before answering. EduSmart never fabricates from the internet — it retrieves, then generates, keeping responses accurate and relevant.",
      points:['Materials are chunked and embedded into a vector store','Semantic similarity search finds the most relevant content per query','Dramatically reduces AI hallucination by grounding answers in facts'],
    },
    {
      icon:'📤', color:'green',
      title:'Lecturer Material Upload',
      desc:'Lecturers upload PDF, DOCX, PPTX, and TXT files directly from their dashboard. Files are instantly processed, embedded into the vector store, and made available to all students in that course.',
      points:['Drag & drop or click-to-browse upload interface','Materials appear in student dashboards immediately after upload','Supports multiple file types and multi-file batch upload'],
    },
    {
      icon:'🎮', color:'gold',
      title:'Gamification & XP Rewards',
      desc:"Students earn XP and unlock achievement badges as they engage with the platform. The reward system is designed to encourage consistent daily study habits and deeper interaction with course content.",
      points:['5 learner levels: Beginner → Explorer → Scholar → Expert → Master','8 achievement badges tied to real learning milestones','Streak tracking rewards daily study consistency'],
    },
    {
      icon:'📊', color:'orange',
      title:'Progress Tracking Per Course',
      desc:'Every question asked and material accessed contributes to a course-specific progress bar. Students see their completion percentage per course unit, and lecturers gain visibility into student engagement.',
      points:['Course-level progress bars updated automatically','History tab stores all past questions with timestamps','Lecturers can track Bloom\'s level distribution across student questions'],
    },
    {
      icon:'🔐', color:'red',
      title:'Secure Role-Based Authentication',
      desc:'Students and lecturers each have separate secure dashboards. JWT-based authentication using MUST IDs ensures no unauthorised access and no personal data is exposed across accounts.',
      points:['Login with MUST ID — no separate registration needed','Separate student and lecturer dashboards with different permissions','All sessions encrypted with JWT tokens and PostgreSQL-backed records'],
    },
    {
      icon:'📶', color:'indigo',
      title:'Offline & Online Sync',
      desc:'Materials accessed while online are cached locally, allowing students to review downloaded content even when internet connectivity is poor — common in some parts of Uganda.',
      points:['Online status indicator shown in both dashboards','Previously loaded materials accessible offline','Automatic sync when connection is restored'],
    },
  ];

  const comparison = [
    {feature:'CBC-aligned answers',    edusmart:true,  generic:false},
    {feature:'Course-specific RAG',    edusmart:true,  generic:false},
    {feature:"Bloom's level detection",edusmart:true,  generic:false},
    {feature:'MUST ID login',          edusmart:true,  generic:false},
    {feature:'Progress gamification',  edusmart:true,  generic:false},
    {feature:'Lecturer material upload',edusmart:true, generic:false},
    {feature:'Available 24/7',         edusmart:true,  generic:true },
    {feature:'Works offline',          edusmart:true,  generic:false},
  ];

  return (
    <div className="ip-page">
      <PageNav/>

      <section className="ip-hero ip-hero-purple">
        <div className="ip-hero-inner">
          <div className="ip-hero-badge">Platform Features</div>
          <h1 className="ip-hero-title">Everything EduSmart <span className="ip-purple">Can Do</span></h1>
          <p className="ip-hero-sub">A complete breakdown of every feature built into EduSmart — designed specifically for MUST students and lecturers.</p>
        </div>
        <div className="ip-hero-wave">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f0f4fa"/></svg>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="ip-section ip-bg-light">
        <div className="ip-container">
          <div className="ip-section-header">
            <h2>Core Features</h2>
            <p>Eight powerful capabilities working together to transform how MUST students learn</p>
          </div>
          <div className="ip-features-grid">
            {mainFeatures.map((f,i)=>(
              <div key={i} className={`ip-feature-card ip-feature-${f.color}`}>
                <div className="ip-feature-emoji">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <ul>
                  {f.points.map((p,j)=><li key={j}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="ip-section">
        <div className="ip-container">
          <div className="ip-section-header">
            <h2>EduSmart vs Generic AI Tools</h2>
            <p>Why a purpose-built academic platform beats using ChatGPT directly</p>
          </div>
          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="ip-th-edusmart">✅ EduSmart</th>
                  <th className="ip-th-generic">Generic AI</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row,i)=>(
                  <tr key={i}>
                    <td>{row.feature}</td>
                    <td className="ip-td-check">{row.edusmart?'✅':''}</td>
                    <td className="ip-td-cross">{row.generic?'✅':'❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Bloom deep dive */}
      <section className="ip-section ip-bg-dark">
        <div className="ip-container">
          <div className="ip-section-header ip-light">
            <h2>Bloom's Taxonomy in EduSmart</h2>
            <p>Every question is automatically placed on this 6-level cognitive framework</p>
          </div>
          <div className="ip-bloom-grid">
            {[
              {level:'Remember',  color:'#64748b',emoji:'🗂️', desc:'Recall facts, terms and basic concepts from your materials'},
              {level:'Understand',color:'#3b82f6',emoji:'💬', desc:'Explain ideas and concepts in your own words'},
              {level:'Apply',     color:'#8b5cf6',emoji:'🔧', desc:'Use learned information in new and real-world situations'},
              {level:'Analyse',   color:'#f59e0b',emoji:'🔬', desc:'Draw connections, identify patterns, break concepts apart'},
              {level:'Evaluate',  color:'#ef4444',emoji:'⚖️', desc:'Justify a decision, critique an approach, weigh options'},
              {level:'Create',    color:'#22c55e',emoji:'🌟', desc:'Produce original work, design solutions, synthesise ideas'},
            ].map((b,i)=>(
              <div key={i} className="ip-bloom-card" style={{borderTopColor:b.color}}>
                <span className="ip-bloom-emoji">{b.emoji}</span>
                <div className="ip-bloom-level" style={{color:b.color}}>{b.level}</div>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ip-cta">
        <div className="ip-container ip-cta-inner">
          <h2>Experience all these features today</h2>
          <p>Log in with your MUST ID and explore EduSmart's full feature set.</p>
          <Link to="/login" className="ip-cta-btn">Login Now →</Link>
        </div>
      </section>

      <footer className="ip-footer">
        <div className="ip-container">
          <p>© 2026 EduSmart · Mbarara University of Science and Technology</p>
          <div className="ip-footer-links">
            <Link to="/">Home</Link><Link to="/how-it-works">How It Works</Link>
            <Link to="/about">About</Link><Link to="/login">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}