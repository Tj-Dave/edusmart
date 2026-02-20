// src/pages/StudentDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { studentApi }  from '../utils/api';
import './StudentDashboard.css';

const Ico = {
  layers:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  robot:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="4" r="1"/><path d="M8 14h.01M16 14h.01M9 18h6"/></svg>,
  book:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  history: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  trophy:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4a2 2 0 01-2-2V5h4"/><path d="M18 9h2a2 2 0 002-2V5h-4"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M6 9a6 6 0 0012 0V3H6v6z"/></svg>,
  send:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  file:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  check:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  logout:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  clear:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ai:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
  warn:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  close:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chevron: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  copy:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  zap:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  flame:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>,
  lock:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  brain:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.5 2A2.5 2.5 0 0112 4.5V5a2 2 0 004 0 2.5 2.5 0 015 1c0 3.5-3 5-3 5s3 1.5 3 5a2.5 2.5 0 01-5 1 2 2 0 01-4 0v.5A2.5 2.5 0 019.5 22a2.5 2.5 0 01-2.45-2A2.5 2.5 0 014.5 17.5c0-1.5.5-2.5 1-3.5A4 4 0 014 10a4 4 0 011.5-3.1A2.5 2.5 0 019.5 2z"/></svg>,
};

/* ── Bloom's Taxonomy Levels ─────────────────────────────── */
const BLOOMS_LEVELS = [
  {
    id: 'remember',
    label: 'Remember',
    emoji: '🧠',
    color: '#ef4444',
    desc: 'Recall facts and basic concepts',
    hint: 'Define, list, recall, identify, name',
  },
  {
    id: 'understand',
    label: 'Understand',
    emoji: '💡',
    color: '#f97316',
    desc: 'Explain ideas or concepts',
    hint: 'Summarise, classify, explain, describe',
  },
  {
    id: 'apply',
    label: 'Apply',
    emoji: '⚙️',
    color: '#8b5cf6',
    desc: 'Use information in new situations',
    hint: 'Solve, use, demonstrate, implement',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    emoji: '🔬',
    color: '#3b82f6',
    desc: 'Draw connections and break down info',
    hint: 'Compare, contrast, differentiate, examine',
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    emoji: '⚖️',
    color: '#10b981',
    desc: 'Justify a decision or course of action',
    hint: 'Argue, judge, critique, assess',
  },
  {
    id: 'create',
    label: 'Create',
    emoji: '✨',
    color: '#f59e0b',
    desc: 'Produce something new or original',
    hint: 'Design, build, formulate, develop',
  },
];

const DEPARTMENTS = [
  { dept:'Computer Science', short:'CS', courses:[
    {code:'CS101',name:'Introduction to Programming'},
    {code:'CS201',name:'Data Structures & Algorithms'},
    {code:'CS301',name:'Database Systems'},
    {code:'CS401',name:'Artificial Intelligence'},
    {code:'CS402',name:'Computer Networks'},
    {code:'CS403',name:'Operating Systems'},
  ]},
  { dept:'Software Engineering', short:'SE', courses:[
    {code:'SE101',name:'Software Development Fundamentals'},
    {code:'SE201',name:'Software Design & Architecture'},
    {code:'SE301',name:'Software Testing & QA'},
    {code:'SE401',name:'Agile Project Management'},
    {code:'SE402',name:'Mobile App Development'},
  ]},
  { dept:'Information Technology', short:'IT', courses:[
    {code:'IT101',name:'IT Fundamentals'},
    {code:'IT201',name:'Cybersecurity Essentials'},
    {code:'IT301',name:'Cloud Computing'},
    {code:'IT401',name:'IT Project Management'},
    {code:'IT402',name:'Systems Analysis & Design'},
  ]},
  { dept:'Civil Engineering', short:'CE', courses:[
    {code:'CE101',name:'Engineering Mathematics I'},
    {code:'CE201',name:'Structural Analysis'},
    {code:'CE301',name:'Geotechnical Engineering'},
    {code:'CE401',name:'Transportation Engineering'},
    {code:'CE402',name:'Environmental Engineering'},
  ]},
  { dept:'Electrical Engineering', short:'EE', courses:[
    {code:'EE101',name:'Circuit Theory'},
    {code:'EE201',name:'Electronics I'},
    {code:'EE301',name:'Power Systems'},
    {code:'EE401',name:'Control Systems'},
    {code:'EE402',name:'Digital Signal Processing'},
  ]},
  { dept:'Mechanical Engineering', short:'ME', courses:[
    {code:'ME101',name:'Engineering Mechanics'},
    {code:'ME201',name:'Thermodynamics'},
    {code:'ME301',name:'Fluid Mechanics'},
    {code:'ME401',name:'Manufacturing Processes'},
    {code:'ME402',name:'Machine Design'},
  ]},
];
const ALL_COURSES = DEPARTMENTS.flatMap(d=>d.courses);

const LEVELS = [
  {min:0,   max:99,  label:'Beginner', color:'#64748b',glow:'rgba(100,116,139,0.35)'},
  {min:100, max:249, label:'Explorer', color:'#3b82f6',glow:'rgba(59,130,246,0.35)'},
  {min:250, max:499, label:'Scholar',  color:'#8b5cf6',glow:'rgba(139,92,246,0.35)'},
  {min:500, max:999, label:'Expert',   color:'#f59e0b',glow:'rgba(245,158,11,0.35)'},
  {min:1000,max:Infinity,label:'Master',color:'#22c55e',glow:'rgba(34,197,94,0.35)'},
];

const BADGES = [
  {id:'first_q',    emoji:'🎯',label:'First Question', desc:'Asked your very first question',         req:'Ask your first question',          xp:10},
  {id:'streak_3',   emoji:'🔥',label:'3-Day Streak',   desc:'Studied 3 consecutive days',             req:'Log in 3 days in a row',            xp:25},
  {id:'curious_10', emoji:'💡',label:'Curious Mind',   desc:'Asked 10 or more questions',             req:'Ask 10 total questions',            xp:50},
  {id:'bookworm',   emoji:'📚',label:'Bookworm',       desc:'Opened course materials 5 times',        req:'Access 5 materials',                xp:20},
  {id:'deep_dive',  emoji:'🔬',label:'Deep Diver',     desc:'Asked 5 questions in one session',       req:'5 questions in a single session',   xp:35},
  {id:'multi_course',emoji:'🌐',label:'Multi-Learner', desc:'Studied across 3 or more courses',       req:'Study in 3+ different courses',     xp:40},
  {id:'perfect_week',emoji:'⭐',label:'Perfect Week',  desc:'Studied every day for 7 days straight',  req:'Achieve a 7-day streak',            xp:75},
  {id:'master_lv',  emoji:'👑',label:'Course Master',  desc:'Reached 80% progress in a course',       req:'80% completion in any course',      xp:100},
];

const getLevel = xp => LEVELS.find(l=>xp>=l.min&&xp<=l.max)||LEVELS[0];
const initials  = (n='')=>n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'ST';
const fmtDate   = iso=>new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const fmtTime   = d=>new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab,      setActiveTab]      = useState('ask');
  const [selectedCourse, setSelectedCourse] = useState(ALL_COURSES[0]);
  const [activeDept,     setActiveDept]     = useState(DEPARTMENTS[0].dept);
  const [courseDropdown, setCourseDropdown] = useState(false);
  const [question,       setQuestion]       = useState('');
  const [answer,         setAnswer]         = useState('');
  const [aiLoading,      setAiLoading]      = useState(false);
  const [materials,      setMaterials]      = useState([]);
  const [pageLoading,    setPageLoading]    = useState(true);
  const [isOnline,       setIsOnline]       = useState(navigator.onLine);
  const [logoutModal,    setLogoutModal]    = useState(false);

  // Bloom's level — default to null (none selected) or 'remember'
  const [bloomsLevel,    setBloomsLevel]    = useState(null);

  const [xp,             setXp]             = useState(75);
  const [streak,         setStreak]         = useState(3);
  const [earnedBadges,   setEarnedBadges]   = useState(['first_q','streak_3']);
  const [sessionQ,       setSessionQ]       = useState(0);
  const [totalQ,         setTotalQ]         = useState(4);
  const [newBadge,       setNewBadge]       = useState(null);
  const [xpPopup,        setXpPopup]        = useState(null);

  const [courseProgress, setCourseProgress] = useState({
    CS101:{q:4,mats:2,pct:35},
    CS201:{q:2,mats:1,pct:20},
    IT201:{q:1,mats:0,pct:10},
  });

  const [history, setHistory] = useState([
    {id:1,course:'CS101',cname:'Introduction to Programming',q:'What is a pointer in C?',          bloomsLevel:'remember', time:new Date(Date.now()-3600000),  ans:'A pointer is a variable that stores a memory address of another variable in C programming…'},
    {id:2,course:'CS201',cname:'Data Structures & Algorithms',q:'Explain binary search tree',     bloomsLevel:'understand',time:new Date(Date.now()-86400000), ans:'A BST is a node-based binary tree where each node has a key greater than left child and less than right child…'},
    {id:3,course:'IT201',cname:'Cybersecurity Essentials',    q:'What is SQL injection?',         bloomsLevel:'analyze',  time:new Date(Date.now()-172800000),ans:'SQL injection exploits unsanitised database queries allowing attackers to manipulate or extract data…'},
  ]);

  const dropdownRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(()=>{
    studentApi.getDashboard()
      .then(({data})=>setMaterials(data.materials||[]))
      .catch(()=>setMaterials([]))
      .finally(()=>setPageLoading(false));
  },[]);

  useEffect(()=>{
    const on=()=>setIsOnline(true),off=()=>setIsOnline(false);
    window.addEventListener('online',on);window.addEventListener('offline',off);
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};
  },[]);

  useEffect(()=>{
    const h=e=>{if(dropdownRef.current&&!dropdownRef.current.contains(e.target))setCourseDropdown(false);};
    document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[]);

  const awardXP = (amt,reason='')=>{
    setXp(p=>p+amt);
    setXpPopup({amt,reason});
    setTimeout(()=>setXpPopup(null),2500);
  };

  const awardBadge = id=>{
    if(earnedBadges.includes(id))return;
    const b=BADGES.find(x=>x.id===id);if(!b)return;
    setEarnedBadges(p=>[...p,id]);
    setNewBadge(b);
    awardXP(b.xp,b.label);
    setTimeout(()=>setNewBadge(null),4500);
  };

  const lvl      = getLevel(xp);
  const nextLvl  = LEVELS[LEVELS.indexOf(lvl)+1];
  const xpInLvl  = xp-lvl.min;
  const xpRange  = nextLvl?nextLvl.min-lvl.min:100;
  const lvlPct   = Math.min(100,Math.round((xpInLvl/xpRange)*100));
  const cProg    = courseProgress[selectedCourse.code]||{q:0,mats:0,pct:0};

  const activeBloom = BLOOMS_LEVELS.find(b => b.id === bloomsLevel);

  const handleAsk = async()=>{
    if(!question.trim()||aiLoading)return;
    const q=question.trim();
    setAiLoading(true);setAnswer('');
    try{
      await new Promise(r=>setTimeout(r,1700));
      const bloomTag = activeBloom ? `[${activeBloom.label.toUpperCase()} level — ${activeBloom.hint}] ` : '';
      const ans=
        `${bloomTag}CBC-aligned explanation for "${q}" — ${selectedCourse.code} ${selectedCourse.name}:\n\n`+
        `This is a placeholder AI response. In production EduSmart connects to your uploaded course materials to return precise, competency-based answers tailored to the selected Bloom's level.\n\n`+
        `Key points:\n• This concept is core to ${selectedCourse.name}\n• Review your lecturer's uploaded materials for more detail\n• Ask follow-up questions to explore the topic deeper`;
      setAnswer(ans);
      const entry={id:Date.now(),course:selectedCourse.code,cname:selectedCourse.name,q,bloomsLevel,time:new Date(),ans};
      setHistory(p=>[entry,...p]);
      const prev=courseProgress[selectedCourse.code]||{q:0,mats:0,pct:0};
      const np=Math.min(100,prev.pct+5);
      setCourseProgress(p=>({...p,[selectedCourse.code]:{...prev,q:prev.q+1,pct:np}}));
      const nT=totalQ+1,nS=sessionQ+1;
      setTotalQ(nT);setSessionQ(nS);
      awardXP(10,'Question answered');
      if(nT===1) awardBadge('first_q');
      if(nT===10)awardBadge('curious_10');
      if(nS===5) awardBadge('deep_dive');
      const uCourses=new Set([...history.map(h=>h.course),selectedCourse.code]);
      if(uCourses.size>=3)awardBadge('multi_course');
      if(np>=80)awardBadge('master_lv');
      setQuestion('');
      await studentApi.saveQuery({question:q,answer:ans,bloomsLevel}).catch(()=>{});
    }catch{setAnswer('Sorry, something went wrong. Please try again.');}
    finally{setAiLoading(false);}
  };

  const handleKeyDown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleAsk();}};

  const handleLogoutConfirm=async()=>{
    setLogoutModal(false);await logout();navigate('/',{replace:true});
  };

  const filteredMats=materials.filter(m=>!m.course_code||m.course_code===selectedCourse.code);

  const TABS=[
    {id:'ask',      label:'Ask AI',      icon:<Ico.robot/>},
    {id:'materials',label:'Materials',   icon:<Ico.book/>},
    {id:'progress', label:'My Progress', icon:<Ico.trophy/>},
    {id:'history',  label:'History',     icon:<Ico.history/>},
  ];

  const lvlEmoji={Beginner:'🌱',Explorer:'🧭',Scholar:'📚',Expert:'⭐',Master:'👑'};

  if(pageLoading)return(
    <div className="sd-loading"><div className="sd-spinner"/><p>Loading your dashboard…</p></div>
  );

  return(
    <div className="sd">

      {xpPopup&&<div className="sd-xp-popup">+{xpPopup.amt} XP · {xpPopup.reason}</div>}

      {newBadge&&(
        <div className="sd-badge-toast">
          <div className="sd-bt-glow"/>
          <span className="sd-bt-emoji">{newBadge.emoji}</span>
          <div className="sd-bt-body">
            <div className="sd-bt-ttl">Badge Unlocked!</div>
            <div className="sd-bt-name">{newBadge.label}</div>
          </div>
          <div className="sd-bt-xp">+{newBadge.xp} XP</div>
        </div>
      )}

      {logoutModal&&(
        <div className="sd-overlay" onClick={()=>setLogoutModal(false)}>
          <div className="sd-modal" onClick={e=>e.stopPropagation()}>
            <div className="sd-modal-hdr">
              <div className="sd-modal-warn"><Ico.warn/></div>
              <h2>Confirm Logout</h2>
              <button className="sd-modal-x" onClick={()=>setLogoutModal(false)}><Ico.close/></button>
            </div>
            <div className="sd-modal-body">
              <p>Are you sure you want to log out of EduSmart?</p>
              <p className="sd-modal-sub">Your progress and badges are saved automatically.</p>
            </div>
            <div className="sd-modal-ftr">
              <button className="sd-modal-stay"    onClick={()=>setLogoutModal(false)}>Stay Logged In</button>
              <button className="sd-modal-confirm" onClick={handleLogoutConfirm}><Ico.logout/> Yes, Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="sd-sidebar">
        <div className="sd-logo">
          <div className="sd-logo-icon"><Ico.layers/></div>
          <span className="sd-logo-name">Edu<span>Smart</span></span>
        </div>

        <div className="sd-sec-lbl">Current Course</div>
        <div className="sd-course-wrap" ref={dropdownRef}>
          <button className="sd-course-btn" onClick={()=>setCourseDropdown(!courseDropdown)}>
            <div className="sd-course-inner">
              <span className="sd-course-code">{selectedCourse.code}</span>
              <span className="sd-course-nm">{selectedCourse.name}</span>
            </div>
            <span className={`sd-chevron${courseDropdown?' open':''}`}><Ico.chevron/></span>
          </button>
          {courseDropdown&&(
            <div className="sd-dropdown">
              <div className="sd-dept-tabs">
                {DEPARTMENTS.map(d=>(
                  <button key={d.dept} className={`sd-dept-tab${activeDept===d.dept?' active':''}`}
                    onClick={()=>setActiveDept(d.dept)}>{d.short}</button>
                ))}
              </div>
              <div className="sd-dept-nm">{activeDept}</div>
              <div className="sd-course-opts">
                {DEPARTMENTS.find(d=>d.dept===activeDept)?.courses.map(c=>(
                  <button key={c.code} className={`sd-course-opt${c.code===selectedCourse.code?' active':''}`}
                    onClick={()=>{setSelectedCourse(c);setCourseDropdown(false);setAnswer('');setQuestion('');}}>
                    <div className="sd-opt-wrap">
                      <span className="sd-opt-code">{c.code}</span>
                      <span className="sd-opt-nm">{c.name}</span>
                    </div>
                    {c.code===selectedCourse.code&&<span className="sd-tick"><Ico.check/></span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* XP card */}
        <div className="sd-xp-card">
          <div className="sd-xp-row">
            <span className="sd-lv-pill" style={{background:lvl.color+'22',color:lvl.color,borderColor:lvl.color+'55'}}>
              {lvlEmoji[lvl.label]} {lvl.label}
            </span>
            <span className="sd-xp-val">{xp} XP</span>
          </div>
          <div className="sd-xp-track">
            <div className="sd-xp-fill" style={{width:lvlPct+'%',background:lvl.color,boxShadow:`0 0 10px ${lvl.glow}`}}/>
          </div>
          <div className="sd-xp-note">
            {nextLvl?`${xpRange-xpInLvl} XP to ${nextLvl.label}`:'Max level reached! 👑'}
          </div>
        </div>

        {/* Streak */}
        <div className="sd-streak">
          <span className="sd-streak-ico">🔥</span>
          <div>
            <div className="sd-streak-n">{streak}-day streak</div>
            <div className="sd-streak-s">Keep studying daily!</div>
          </div>
        </div>

        <div className="sd-sec-lbl" style={{marginTop:8}}>Navigation</div>
        <nav className="sd-nav">
          {TABS.map(t=>(
            <button key={t.id} className={`sd-nav-item${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>
              <span className="sd-nav-ico">{t.icon}</span>
              {t.label}
              {t.id==='history'&&history.length>0&&<span className="sd-nav-badge">{history.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sd-spacer"/>

        {/* Mini progress */}
        <div className="sd-mini-prog">
          <div className="sd-mini-lbl">{selectedCourse.code} progress</div>
          <div className="sd-mini-track">
            <div className="sd-mini-fill" style={{width:cProg.pct+'%'}}/>
          </div>
          <div className="sd-mini-pct">{cProg.pct}% complete</div>
        </div>

        {/* Profile */}
        <div className="sd-profile">
          <div className="sd-profile-av" style={{background:`linear-gradient(135deg,${lvl.color},${lvl.color}88)`}}>
            {initials(user?.fullName||user?.full_name)}
          </div>
          <div className="sd-profile-info">
            <div className="sd-profile-name">{user?.fullName||user?.full_name||'Student'}</div>
            <div className="sd-profile-id">{user?.mustId||user?.must_id||''}</div>
            <div className="sd-profile-lv" style={{color:lvl.color}}>⚡ {lvl.label}</div>
          </div>
        </div>

        <button className="sd-logout" onClick={()=>setLogoutModal(true)}>
          <span className="sd-ico-wrap"><Ico.logout/></span> Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="sd-main">
        <header className="sd-header">
          <div className="sd-hdr-l">
            <h1 className="sd-hdr-title">{TABS.find(t=>t.id===activeTab)?.label}</h1>
            <span className="sd-hdr-sub">{selectedCourse.code} · {selectedCourse.name}</span>
          </div>
          <div className="sd-hdr-r">
            {/* Show active Bloom's level in header when on Ask tab */}
            {activeTab==='ask'&&activeBloom&&(
              <div className="sd-hdr-bloom" style={{borderColor:activeBloom.color+'44',background:activeBloom.color+'11',color:activeBloom.color}}>
                <span>{activeBloom.emoji}</span>
                <span style={{fontWeight:700,fontSize:'0.77rem'}}>{activeBloom.label}</span>
              </div>
            )}
            <div className="sd-online-pill">
              <span className={`sd-dot ${isOnline?'on':'off'}`}/>
              {isOnline?'Online':'Offline'}
            </div>
            <div className="sd-hdr-xp">
              <span style={{color:lvl.color,fontWeight:700,fontSize:'0.78rem'}}>{lvl.label}</span>
              <span className="sd-hdr-xv">⚡ {xp} XP</span>
            </div>
          </div>
        </header>

        <div className="sd-content">

          {/* ── ASK AI ── */}
          {activeTab==='ask'&&(
            <div className="sd-ask-wrap">
              <div className="sd-ask-col">
                <div className="sd-ask-card">
                  <div className="sd-ask-badge"><Ico.robot/> Asking about <strong>{selectedCourse.code}</strong></div>

                  {/* ── BLOOM'S TAXONOMY SELECTOR ── */}
                  <div className="sd-blooms-section">
                    <div className="sd-blooms-header">
                      <span className="sd-blooms-label">
                        <Ico.brain/> BLOOM'S LEVEL
                      </span>
                      {activeBloom && (
                        <span className="sd-blooms-desc" style={{color: activeBloom.color}}>
                          {activeBloom.emoji} {activeBloom.desc}
                        </span>
                      )}
                      {bloomsLevel && (
                        <button className="sd-blooms-clear" onClick={() => setBloomsLevel(null)}>
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="sd-blooms-pills" role="group" aria-label="Select Bloom's Taxonomy level">
                      {BLOOMS_LEVELS.map(bl => (
                        <button
                          key={bl.id}
                          className={`sd-bloom-pill${bloomsLevel === bl.id ? ' active' : ''}`}
                          style={bloomsLevel === bl.id ? {
                            background: bl.color,
                            borderColor: bl.color,
                            color: '#fff',
                            boxShadow: `0 3px 12px ${bl.color}55`,
                          } : {}}
                          onClick={() => setBloomsLevel(prev => prev === bl.id ? null : bl.id)}
                          title={bl.desc}
                        >
                          <span className="sd-bloom-emoji">{bl.emoji}</span>
                          {bl.label}
                        </button>
                      ))}
                    </div>
                    {activeBloom && (
                      <div className="sd-blooms-hint" style={{borderLeftColor: activeBloom.color}}>
                        <strong>Cognitive verbs for {activeBloom.label}:</strong> {activeBloom.hint}
                      </div>
                    )}
                  </div>

                  {/* Textarea — made more prominent */}
                  <div className="sd-textarea-wrap">
                    <textarea
                      ref={textareaRef}
                      className="sd-textarea"
                      style={activeBloom ? {borderColor: activeBloom.color + '66'} : {}}
                      placeholder={
                        activeBloom
                          ? `Ask a "${activeBloom.label}" level question about ${selectedCourse.name}…\ne.g. ${activeBloom.hint.split(',')[0].trim()} [concept]`
                          : `Ask anything about ${selectedCourse.name}…`
                      }
                      value={question}
                      onChange={e=>setQuestion(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={6}
                    />
                  </div>

                  <p className="sd-ask-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</p>
                  <div className="sd-ask-btns">
                    {question&&<button className="sd-btn-ghost" onClick={()=>{setQuestion('');setAnswer('');}}><Ico.clear/> Clear</button>}
                    <button className="sd-btn-primary" onClick={handleAsk} disabled={aiLoading||!question.trim()}>
                      {aiLoading?<><span className="sd-spin-sm"/> Thinking…</>:<><Ico.send/> Ask EduSmart</>}
                    </button>
                  </div>
                  <div className="sd-quick">
                    <span className="sd-quick-lbl">Quick prompts:</span>
                    {(activeBloom ? [
                      `${activeBloom.hint.split(',')[0].trim()} the core concepts of ${selectedCourse.name}`,
                      `${activeBloom.hint.split(',')[1]?.trim() || 'Explain'} a key topic in ${selectedCourse.code}`,
                      `What does "${activeBloom.label}" mean in ${selectedCourse.name}?`,
                      `Give me a ${activeBloom.label}-level question for ${selectedCourse.code} exam prep`,
                    ] : [
                      `Explain the core concepts of ${selectedCourse.name}`,
                      `Summarise ${selectedCourse.code} for exam revision`,
                      `What are the CBC competencies for ${selectedCourse.code}?`,
                      `What should I focus on in ${selectedCourse.name}?`,
                    ]).map((p,i)=>(
                      <button key={i} className="sd-quick-chip" onClick={()=>setQuestion(p)}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sd-ans-col">
                <div className="sd-ans-card">
                  <div className="sd-ans-hdr">
                    <span className="sd-ans-lbl"><Ico.ai/> EduSmart Response</span>
                    {answer&&(
                      <button className="sd-btn-ghost" style={{padding:'5px 12px',fontSize:'0.78rem'}}
                        onClick={()=>navigator.clipboard?.writeText(answer)}>
                        <Ico.copy/> Copy
                      </button>
                    )}
                  </div>
                  <div className="sd-ans-body">
                    {aiLoading?(
                      <div className="sd-thinking"><span/><span/><span/></div>
                    ):answer?(
                      <p className="sd-ans-txt">{answer}</p>
                    ):(
                      <div className="sd-ans-empty">
                        <div className="sd-empty-ai-ico"><Ico.ai/></div>
                        <h3>Your answer will appear here</h3>
                        <p>
                          {activeBloom
                            ? <>Select a Bloom's level and type a question about <strong>{selectedCourse.name}</strong></>
                            : <>Type a question about <strong>{selectedCourse.name}</strong> and press Ask EduSmart</>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MATERIALS ── */}
          {activeTab==='materials'&&(
            <div className="sd-tab-pg">
              <div className="sd-tab-hdr">
                <div>
                  <h2 className="sd-tab-title">Materials for {selectedCourse.code}</h2>
                  <p className="sd-tab-sub">Resources uploaded by your lecturers</p>
                </div>
                <span className="sd-count-chip">{filteredMats.length} items</span>
              </div>
              {Object.keys(courseProgress).length>0&&(
                <div className="sd-history-strip">
                  <span className="sd-strip-lbl">📂 Courses you've studied:</span>
                  {Object.keys(courseProgress).map(code=>{
                    const c=ALL_COURSES.find(x=>x.code===code);
                    return(
                      <button key={code}
                        className={`sd-strip-chip${code===selectedCourse.code?' active':''}`}
                        onClick={()=>{if(c)setSelectedCourse(c);}}>
                        {code}
                      </button>
                    );
                  })}
                </div>
              )}
              {filteredMats.length===0?(
                <div className="sd-empty-state">
                  <div className="sd-empty-ico"><Ico.book/></div>
                  <h3>No materials yet for {selectedCourse.code}</h3>
                  <p>Your lecturer will upload resources here. Switch to a different course above.</p>
                </div>
              ):(
                <div className="sd-mats-grid">
                  {filteredMats.map(m=>(
                    <div className="sd-mat-card" key={m.id}>
                      <div className="sd-mat-top">
                        <div className="sd-mat-fi"><Ico.file/></div>
                        <div className="sd-mat-info">
                          <div className="sd-mat-ttl">{m.title}</div>
                          <div className="sd-mat-course">{m.course_code||selectedCourse.code}</div>
                        </div>
                        {m.synced&&<div className="sd-synced"><Ico.check/> Synced</div>}
                      </div>
                      <div className="sd-mat-ftr">
                        <span>By {m.lecturer_name||'Lecturer'}</span>
                        <span>{m.created_at?fmtDate(m.created_at):'Recent'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MY PROGRESS ── */}
          {activeTab==='progress'&&(
            <div className="sd-tab-pg">
              <div className="sd-tab-hdr">
                <div>
                  <h2 className="sd-tab-title">My Learning Progress</h2>
                  <p className="sd-tab-sub">Your XP, levels, course progress and achievements</p>
                </div>
              </div>

              <div className="sd-prog-hero">
                <div className="sd-prog-lv-card" style={{borderColor:lvl.color+'44',background:`linear-gradient(135deg,${lvl.color}0d,transparent)`}}>
                  <div className="sd-prog-lv-emoji">{lvlEmoji[lvl.label]}</div>
                  <div className="sd-prog-lv-info">
                    <div className="sd-prog-lv-name" style={{color:lvl.color}}>{lvl.label}</div>
                    <div className="sd-prog-lv-xp">{xp} XP earned</div>
                    <div className="sd-prog-bar-wrap">
                      <div className="sd-prog-bar-fill" style={{width:lvlPct+'%',background:lvl.color,boxShadow:`0 0 10px ${lvl.glow}`}}/>
                      <span className="sd-prog-bar-pct">{lvlPct}%</span>
                    </div>
                    <div className="sd-prog-lv-nxt">
                      {nextLvl?`${xpRange-xpInLvl} XP until ${nextLvl.label}`:'Maximum level achieved! 🎉'}
                    </div>
                  </div>
                </div>
                <div className="sd-pstats">
                  <div className="sd-pstat blue"><div className="sd-pstat-ico"><Ico.robot/></div><div className="sd-pstat-num">{totalQ}</div><div className="sd-pstat-lbl">Questions</div></div>
                  <div className="sd-pstat orange"><div className="sd-pstat-ico">🔥</div><div className="sd-pstat-num">{streak}</div><div className="sd-pstat-lbl">Day Streak</div></div>
                  <div className="sd-pstat green"><div className="sd-pstat-ico"><Ico.trophy/></div><div className="sd-pstat-num">{earnedBadges.length}</div><div className="sd-pstat-lbl">Badges</div></div>
                  <div className="sd-pstat purple"><div className="sd-pstat-ico"><Ico.book/></div><div className="sd-pstat-num">{Object.keys(courseProgress).length}</div><div className="sd-pstat-lbl">Courses</div></div>
                </div>
              </div>

              <div className="sd-course-list-sec">
                <h3 className="sd-sec-ttl">📊 Course Progress</h3>
                <div className="sd-cpi-list">
                  {ALL_COURSES.filter(c=>courseProgress[c.code]).map(c=>{
                    const p=courseProgress[c.code];
                    const barColor=p.pct>=80?'#22c55e':p.pct>=50?'#f59e0b':'#3b82f6';
                    return(
                      <div key={c.code} className="sd-cpi">
                        <div className="sd-cpi-top">
                          <div><span className="sd-cpi-code">{c.code}</span><span className="sd-cpi-name">{c.name}</span></div>
                          <span className="sd-cpi-pct" style={{color:barColor}}>{p.pct}%</span>
                        </div>
                        <div className="sd-cpi-track">
                          <div className="sd-cpi-fill" style={{width:p.pct+'%',background:barColor}}/>
                        </div>
                        <div className="sd-cpi-meta">
                          {p.q} questions · {p.mats} materials read
                          {p.pct>=80&&<span className="sd-mastered">🏆 Mastered</span>}
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(courseProgress).length===0&&<p style={{color:'#8a98a8',fontSize:'0.88rem',padding:'16px 0'}}>Start asking questions to track your progress here.</p>}
                </div>
              </div>

              <div className="sd-badges-sec">
                <h3 className="sd-sec-ttl">🏅 Badges & Achievements</h3>
                <div className="sd-badges-grid">
                  {BADGES.map(b=>{
                    const earned=earnedBadges.includes(b.id);
                    return(
                      <div key={b.id} className={`sd-badge-card${earned?' earned':' locked'}`}>
                        {!earned&&<div className="sd-badge-lock-ico"><Ico.lock/></div>}
                        <div className="sd-badge-emoji">{b.emoji}</div>
                        <div className="sd-badge-name">{b.label}</div>
                        <div className="sd-badge-desc">{earned?b.desc:b.req}</div>
                        <div className={`sd-badge-xp${earned?' earned':''}`}>{earned?`+${b.xp} XP ✓`:`+${b.xp} XP`}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── HISTORY ── */}
          {activeTab==='history'&&(
            <div className="sd-tab-pg">
              <div className="sd-tab-hdr">
                <div>
                  <h2 className="sd-tab-title">Question History</h2>
                  <p className="sd-tab-sub">All past questions across all your courses</p>
                </div>
                <span className="sd-count-chip">{history.length} questions</span>
              </div>
              {history.length===0?(
                <div className="sd-empty-state">
                  <div className="sd-empty-ico"><Ico.history/></div>
                  <h3>No history yet</h3>
                  <p>Questions you ask appear here automatically for future reference.</p>
                </div>
              ):(
                <div className="sd-history-list">
                  {history.map(item=>{
                    const bl = BLOOMS_LEVELS.find(b => b.id === item.bloomsLevel);
                    return(
                      <div key={item.id} className="sd-history-card">
                        <div className="sd-history-top">
                          <span className="sd-history-course">{item.course}</span>
                          <span className="sd-history-cname">{item.cname}</span>
                          {bl && (
                            <span className="sd-history-bloom" style={{background: bl.color + '18', color: bl.color, borderColor: bl.color + '44'}}>
                              {bl.emoji} {bl.label}
                            </span>
                          )}
                          <span className="sd-history-time">{fmtTime(item.time)}</span>
                        </div>
                        <div className="sd-history-q">{item.q}</div>
                        <div className="sd-history-a">{item.ans.slice(0,140)}…</div>
                        <button className="sd-history-reask" onClick={()=>{
                          const c=ALL_COURSES.find(c=>c.code===item.course);
                          if(c)setSelectedCourse(c);
                          setQuestion(item.q);
                          if(item.bloomsLevel) setBloomsLevel(item.bloomsLevel);
                          setActiveTab('ask');
                        }}>Ask again →</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="sd-footer">
          <span><span className={`sd-dot ${isOnline?'on':'off'}`}/> {isOnline?'Online':'Offline'}</span>
          <span>© 2026 EduSmart · MUST</span>
          <span>{selectedCourse.code} · {lvl.label} learner</span>
        </footer>
      </main>
      
    </div>
  );
}