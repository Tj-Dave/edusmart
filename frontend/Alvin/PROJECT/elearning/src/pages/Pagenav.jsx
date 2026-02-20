// Shared top nav for all public info pages
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const BookOpen = ()=>(
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
  </svg>
);
const Menu = ()=>(
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
);
const Close = ()=>(
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
  </svg>
);

export default function PageNav() {
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();

  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>20);
    window.addEventListener('scroll',h);
    return()=>window.removeEventListener('scroll',h);
  },[]);

  const links = [
    {to:'/features',    label:'Features'},
    {to:'/benefits',    label:'Benefits'},
    {to:'/how-it-works',label:'How It Works'},
    {to:'/about',       label:'About'},
  ];

  return (
    <nav className={`pn-nav ${scrolled?'pn-scrolled':''}`}>
      <div className="pn-inner">
        <Link to="/" className="pn-logo">
          <div className="pn-logo-icon"><BookOpen/></div>
          <span className="pn-logo-text">EDUSMART</span>
        </Link>
        <div className="pn-links">
          {links.map(l=>(
            <Link key={l.to} to={l.to} className={`pn-link ${loc.pathname===l.to?'active':''}`}>{l.label}</Link>
          ))}
          <Link to="/login" className="pn-btn-login">Login</Link>
        </div>
        <button className="pn-mobile-btn" onClick={()=>setMobileOpen(p=>!p)}>
          {mobileOpen?<Close/>:<Menu/>}
        </button>
      </div>
      {mobileOpen&&(
        <div className="pn-mobile-menu">
          {links.map(l=>(
            <Link key={l.to} to={l.to} className="pn-link" onClick={()=>setMobileOpen(false)}>{l.label}</Link>
          ))}
          <Link to="/login" className="pn-btn-login" onClick={()=>setMobileOpen(false)}>Login</Link>
        </div>
      )}
    </nav>
  );
}