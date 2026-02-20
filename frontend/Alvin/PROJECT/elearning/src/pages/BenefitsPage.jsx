import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageNav from './PageNav';
import './PageNav.css';
import './InfoPage.css';

export default function BenefitsPage() {
  useEffect(()=>{ window.scrollTo(0,0); },[]);

  const studentBenefits = [
    {icon:'💡',title:'Ask Without Fear',           desc:'No more hesitation to ask a "simple" question. EduSmart AI never judges, never gets impatient, and is available 24 hours a day, 7 days a week.'},
    {icon:'📖',title:'Understand, Not Just Memorise',desc:"Bloom's Taxonomy ensures the AI challenges you at the right cognitive level — pushing beyond rote memorisation toward deep, lasting understanding."},
    {icon:'⚡',title:'Instant Answers Anytime',    desc:'Get clear explanations at midnight before an exam or during a quiet afternoon. No waiting for office hours, no booking appointments.'},
    {icon:'📊',title:'See Your Learning Progress',  desc:'Track how much you have engaged with each course — questions asked, materials read, and overall course completion — all in one visual dashboard.'},
    {icon:'🎮',title:'Stay Motivated with Rewards', desc:'Earn XP for every question and unlock achievement badges as you hit milestones. The streak system rewards daily study habits that lead to long-term success.'},
    {icon:'📚',title:'All Materials in One Place',  desc:'Access every lecture note, slide, and resource your lecturer has uploaded — organised by course, searchable, and always up to date.'},
    {icon:'🔬',title:'Answers from Your Syllabus',  desc:'RAG-powered AI answers come from your actual course materials — not generic internet content. This means answers are always relevant to your specific programme and modules.'},
    {icon:'📶',title:'Study Even Offline',           desc:'Previously loaded materials are accessible without internet — useful in areas with unreliable connectivity. EduSmart syncs automatically when you come back online.'},
  ];

  const lecturerBenefits = [
    {icon:'📤',title:'Upload Materials in Seconds',    desc:'Drag and drop lecture notes, slides, and readings directly from your dashboard. Files are instantly processed and available to your students.'},
    {icon:'🧠',title:'Set Cognitive Learning Objectives',desc:"Manually select Bloom's Taxonomy levels for your course sessions, guiding the AI to pitch responses at the right depth for your learning objectives."},
    {icon:'📈',title:'See Student Engagement Trends',  desc:'View which courses are receiving the most questions, which Bloom\'s levels students are reaching, and how materials are being accessed — all from your stats panel.'},
    {icon:'💬',title:'AI Handles Repetitive Questions', desc:'Common student questions about basic concepts are handled automatically by the AI, freeing your time for deeper academic discussions and complex problem-solving.'},
    {icon:'🔐',title:'Secure Material Management',     desc:'Only lecturers assigned to a course can upload materials for it. All uploads are stored securely and can be removed at any time from the dashboard.'},
    {icon:'🎯',title:'CBC-Aligned Teaching Support',   desc:"EduSmart's AI is configured to frame all answers within Uganda's CBC framework, so student learning through the platform aligns with your official teaching objectives."},
  ];

  const stats = [
    {n:'10,000+',lbl:'Active MUST students enrolled',  color:'blue'},
    {n:'500+',   lbl:'Lecturers using EduSmart',       color:'purple'},
    {n:'98%',    lbl:'Student satisfaction rating',    color:'green'},
    {n:'50,000+',lbl:'Questions answered by AI to date',color:'gold'},
    {n:'6',      lbl:'Engineering & computing departments covered', color:'teal'},
    {n:'24/7',   lbl:'AI availability — every day of the year',    color:'orange'},
  ];

  const testimonials = [
    {name:'Sarah M.',  role:'Year 2, Computer Science',       quote:'I used to be too afraid to ask my lecturer basic questions. EduSmart changed that completely. I ask whatever I need, whenever I need, and actually understand my coursework now.'},
    {name:'James O.',  role:'Lecturer, Electrical Engineering',quote:'The Bloom\'s level selector has been a game-changer for how I set learning objectives. I can see exactly which cognitive levels my students are reaching through their questions.'},
    {name:'Patricia N.',role:'Year 3, Software Engineering',  quote:'The gamification system keeps me consistent. I haven\'t broken my 14-day streak and my grades have genuinely improved this semester.'},
  ];

  return (
    <div className="ip-page">
      <PageNav/>

      <section className="ip-hero ip-hero-green">
        <div className="ip-hero-inner">
          <div className="ip-hero-badge">Why EduSmart</div>
          <h1 className="ip-hero-title">The Real <span className="ip-green">Benefits</span></h1>
          <p className="ip-hero-sub">What EduSmart actually delivers for students and lecturers at Mbarara University of Science and Technology.</p>
        </div>
        <div className="ip-hero-wave">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f0f4fa"/></svg>
        </div>
      </section>

      {/* STATS */}
      <section className="ip-section ip-bg-light">
        <div className="ip-container">
          <div className="ip-stats-grid">
            {stats.map((s,i)=>(
              <div key={i} className={`ip-stat ip-stat-${s.color}`}>
                <div className="ip-stat-n">{s.n}</div>
                <div className="ip-stat-l">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STUDENT BENEFITS */}
      <section className="ip-section">
        <div className="ip-container">
          <div className="ip-section-header">
            <div className="ip-role-badge student-badge">🎓 For Students</div>
            <h2>How Students Benefit</h2>
            <p>Eight ways EduSmart gives MUST students the academic support they need to thrive</p>
          </div>
          <div className="ip-benefits-grid">
            {studentBenefits.map((b,i)=>(
              <div key={i} className="ip-benefit-card">
                <div className="ip-benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LECTURER BENEFITS */}
      <section className="ip-section ip-bg-light">
        <div className="ip-container">
          <div className="ip-section-header">
            <div className="ip-role-badge lecturer-badge">👨‍🏫 For Lecturers</div>
            <h2>How Lecturers Benefit</h2>
            <p>Tools that save time, provide student insight, and align with CBC teaching standards</p>
          </div>
          <div className="ip-benefits-grid">
            {lecturerBenefits.map((b,i)=>(
              <div key={i} className="ip-benefit-card ip-benefit-card-lec">
                <div className="ip-benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="ip-section ip-bg-dark">
        <div className="ip-container">
          <div className="ip-section-header ip-light">
            <h2>What the MUST Community Says</h2>
            <p>Real voices from the students and lecturers already using EduSmart</p>
          </div>
          <div className="ip-testimonials">
            {testimonials.map((t,i)=>(
              <div key={i} className="ip-testimonial">
                <div className="ip-quote">"</div>
                <p className="ip-testimonial-text">{t.quote}</p>
                <div className="ip-testimonial-author">
                  <div className="ip-testimonial-av">{t.name.charAt(0)}</div>
                  <div>
                    <div className="ip-testimonial-name">{t.name}</div>
                    <div className="ip-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ip-cta">
        <div className="ip-container ip-cta-inner">
          <h2>Start benefiting from EduSmart today</h2>
          <p>Join thousands of MUST students and lecturers already on the platform.</p>
          <Link to="/login" className="ip-cta-btn">Login with Your MUST ID →</Link>
        </div>
      </section>

      <footer className="ip-footer">
        <div className="ip-container">
          <p>© 2026 EduSmart · Mbarara University of Science and Technology</p>
          <div className="ip-footer-links">
            <Link to="/">Home</Link><Link to="/features">Features</Link>
            <Link to="/how-it-works">How It Works</Link><Link to="/login">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}