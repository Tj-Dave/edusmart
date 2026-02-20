import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageNav from './PageNav';
import './PageNav.css';
import './InfoPage.css';

export default function HowItWorksPage() {
  useEffect(()=>{ window.scrollTo(0,0); },[]);

  const steps = [
    {
      n:'01', icon:'🔐', title:'Log In with Your MUST ID',
      desc:'Access EduSmart securely using your university MUST student or staff ID. No separate account creation is needed — your university credentials are your passport into the platform.',
      detail:['Your MUST ID is linked directly to your academic profile','Role-based login: students and lecturers get different personalised dashboards','Session is encrypted end-to-end for full privacy and security'],
    },
    {
      n:'02', icon:'📚', title:'Select Your Course',
      desc:'From your personalised dashboard, choose the specific course unit you are currently studying. EduSmart organises everything by course — from CS101 to ME402 — covering all university departments.',
      detail:['6 departments: Computer Science, Software Engineering, IT, Civil, Electrical & Mechanical Engineering','Course-specific AI context so every answer is relevant to your syllabus','Lecturers upload materials per course so nothing is mismatched'],
    },
    {
      n:'03', icon:'📄', title:'Access Course Materials',
      desc:'All lecture notes, slides, and documents uploaded by your lecturer appear instantly in My Materials. Files are organised, searchable, and available whenever you need them.',
      detail:['Supports PDF, DOCX, PPTX and TXT formats','Materials are stored securely in a vector database for AI-powered retrieval','Synced automatically so you always have the latest uploads'],
    },
    {
      n:'04', icon:'🤖', title:'Ask the AI — Powered by RAG',
      desc:'Type any question in plain English. EduSmart\'s AI uses Retrieval-Augmented Generation (RAG) — it searches your actual uploaded course materials before answering, so responses are grounded in your real syllabus content, not generic internet knowledge.',
      detail:['RAG searches your course\'s vector database first before generating any answer','Responses are contextual, CBC-aligned and course-specific','No hallucinations — if the material doesn\'t cover it, the AI says so honestly'],
      highlight:true,
    },
    {
      n:'05', icon:'🧠', title:'Bloom\'s Taxonomy Level Detection',
      desc:'EduSmart automatically detects the cognitive level of your question using Bloom\'s Taxonomy framework — from simple recall (Remember) up to complex synthesis (Create). The AI then tailors the depth and structure of its answer to match your cognitive need.',
      detail:['6 levels: Remember → Understand → Apply → Analyse → Evaluate → Create','Questions are classified automatically — no setup needed from the student','Lecturers can also manually select Bloom\'s level to set learning objectives'],
      highlight:true,
    },
    {
      n:'06', icon:'🎯', title:'Track Progress & Earn Rewards',
      desc:'Every question you ask, every material you read, and every day you study earns you XP and unlocks achievement badges. Your learning progress is tracked per course so lecturers can see engagement trends.',
      detail:['XP system with 5 levels: Beginner → Explorer → Scholar → Expert → Master','8 achievement badges earned by hitting real learning milestones','Course progress bars help you see how far you\'ve come in each unit'],
    },
  ];

  const techStack = [
    {icon:'🔍', name:'RAG (Retrieval-Augmented Generation)', desc:'The AI retrieves relevant excerpts from your actual course materials stored in a vector database before generating each answer. This grounds every response in your syllabus.'},
    {icon:'📐', name:'Bloom\'s Taxonomy Engine',              desc:'A prompt engineering layer classifies the cognitive level of each student question and adjusts the AI\'s response style, depth and structure accordingly.'},
    {icon:'🗄️', name:'Vector Database',                       desc:'Course materials are chunked and embedded into a vector store. Semantic similarity search finds the most relevant content for each query in milliseconds.'},
    {icon:'🔒', name:'Secure JWT Authentication',              desc:'Role-based access control separates student and lecturer views. All sessions are authenticated using JSON Web Tokens and PostgreSQL-backed user records.'},
    {icon:'📊', name:'CBC-Aligned Curriculum Mapping',         desc:'All AI responses are evaluated against Uganda\'s Competence-Based Curriculum objectives to ensure academic relevance and standard alignment.'},
    {icon:'⚡', name:'Real-Time Sync & Offline Support',       desc:'Course materials sync automatically when online. Students can access previously loaded content offline, making EduSmart reliable even with poor internet.'},
  ];

  return (
    <div className="ip-page">
      <PageNav/>

      {/* HERO */}
      <section className="ip-hero">
        <div className="ip-hero-inner">
          <div className="ip-hero-badge">System Architecture</div>
          <h1 className="ip-hero-title">How EduSmart <span className="ip-blue">Works</span></h1>
          <p className="ip-hero-sub">
            A step-by-step walkthrough of EduSmart's core functionalities — from login to AI-powered, Bloom's-aligned, RAG-driven learning support.
          </p>
        </div>
        <div className="ip-hero-wave">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f0f4fa"/></svg>
        </div>
      </section>

      {/* STEPS */}
      <section className="ip-section ip-bg-light">
        <div className="ip-container">
          <div className="ip-section-header">
            <h2>The 6-Step Journey</h2>
            <p>From first login to mastery — here is exactly what happens at each stage</p>
          </div>
          <div className="ip-steps">
            {steps.map((s,i)=>(
              <div key={i} className={`ip-step ${s.highlight?'ip-step-highlight':''}`}>
                <div className="ip-step-left">
                  <div className="ip-step-num">{s.n}</div>
                  <div className="ip-step-icon">{s.icon}</div>
                </div>
                <div className="ip-step-body">
                  <h3 className="ip-step-title">{s.title}</h3>
                  <p  className="ip-step-desc">{s.desc}</p>
                  <ul className="ip-step-details">
                    {s.detail.map((d,j)=><li key={j}>✓ {d}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TECH STACK */}
      <section className="ip-section">
        <div className="ip-container">
          <div className="ip-section-header">
            <h2>Under the Hood — The Technology</h2>
            <p>The key systems that power EduSmart's intelligent learning engine</p>
          </div>
          <div className="ip-tech-grid">
            {techStack.map((t,i)=>(
              <div key={i} className="ip-tech-card">
                <div className="ip-tech-icon">{t.icon}</div>
                <h3>{t.name}</h3>
                <p>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAG EXPLAINER */}
      <section className="ip-section ip-bg-dark">
        <div className="ip-container">
          <div className="ip-section-header ip-light">
            <h2>What is RAG and Why Does It Matter?</h2>
            <p>Retrieval-Augmented Generation is what makes EduSmart's AI answer from your course, not the internet</p>
          </div>
          <div className="ip-rag-flow">
            {['Student asks a question','Question is embedded into a vector','Vector database searches course materials','Top matching chunks are retrieved','AI generates answer using retrieved context','Answer is delivered with Bloom\'s alignment'].map((step,i)=>(
              <div key={i} className="ip-rag-step">
                <div className="ip-rag-step-num">{i+1}</div>
                <div className="ip-rag-step-text">{step}</div>
                {i<5&&<div className="ip-rag-arrow">↓</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="ip-cta">
        <div className="ip-container ip-cta-inner">
          <h2>Ready to experience it yourself?</h2>
          <p>Log in with your MUST ID and start asking questions powered by RAG and Bloom's Taxonomy.</p>
          <Link to="/login" className="ip-cta-btn">Get Started Now →</Link>
        </div>
      </section>

      <footer className="ip-footer">
        <div className="ip-container">
          <p>© 2026 EduSmart · Mbarara University of Science and Technology</p>
          <div className="ip-footer-links">
            <Link to="/">Home</Link>
            <Link to="/features">Features</Link>
            <Link to="/about">About</Link>
            <Link to="/login">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}