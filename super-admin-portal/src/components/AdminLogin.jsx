/**
 * AdminLogin.jsx — Enterprise-Grade SaaS Admin Login Page with Professional Campus Infrastructure Topology
 * Features sculpted glass building nodes, smooth curved fiber-optic laser streams, live telemetry cycling, and clean typography.
 */
import React, { useState, useEffect } from 'react';
import CollegeLogo from './CollegeLogo.jsx';
import {
  Mail, Lock, Eye, EyeOff, Shield, AlertCircle,
  ArrowRight, Sparkles, KeyRound, CheckCircle2, Activity,
  Building, Building2, Landmark, School, Library, Radio, Wifi, Zap, ShieldCheck, MapPin, Cpu
} from 'lucide-react';

const ADMIN_EMAIL    = 'admin@mrf.edu';
const ADMIN_PASSWORD = 'admin@mrf2024';

const CAMPUS_NODES = [
  { id: 'academic', name: 'Academic Block', desc: '24 Lecture Halls', status: 'Optimal', icon: School, color: '#38BDF8', tag: 'Academic' },
  { id: 'library',  name: 'Central Library', desc: 'Archives & Media', status: 'Synced',  icon: Library, color: '#A78BFA', tag: 'Library' },
  { id: 'admin',    name: 'Admin Complex',   desc: 'Master Core Hub',  status: 'Master',  icon: Landmark, color: '#6366F1', tag: 'Gateway' },
  { id: 'labs',     name: 'Research Labs',   desc: 'HVAC & Cleanrooms',status: 'Nominal', icon: Cpu,     color: '#34D399', tag: 'Science' },
  { id: 'hostels',  name: 'Student Hostels', desc: 'Power & Utilities',status: 'Active',  icon: Building,color: '#F472B6', tag: 'Residences' },
];

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [shaking, setShaking]   = useState(false);

  // Cycling active node for dynamic live telemetry highlight
  const [activeIdx, setActiveIdx] = useState(2);
  const [latency, setLatency]     = useState(12);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % CAMPUS_NODES.length);
      setLatency(Math.floor(Math.random() * 4) + 11);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const activeNode = CAMPUS_NODES[activeIdx];

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your admin email address.');
      return;
    }

    if (
      email.trim().toLowerCase() === ADMIN_EMAIL &&
      password === ADMIN_PASSWORD
    ) {
      onLogin();
    } else {
      setError('Invalid email or password. Please try again.');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  };

  const fillDemo = () => {
    setEmail(ADMIN_EMAIL);
    setPassword(ADMIN_PASSWORD);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-3 sm:p-5 md:p-8 selection:bg-indigo-500 selection:text-white font-sans relative overflow-hidden">
      
      {/* Precision Enterprise Keyframes */}
      <style>{`
        @keyframes laser-flow-fast {
          0% { stroke-dashoffset: 320; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes laser-flow-rev {
          0% { stroke-dashoffset: -320; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes beacon-sonar {
          0% { r: 12px; opacity: 0.8; }
          100% { r: 48px; opacity: 0; }
        }
        @keyframes core-glow-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(99, 102, 241, 0.35); }
          50% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.7); }
        }
        .animate-fiber-1 {
          stroke-dasharray: 28 90;
          animation: laser-flow-fast 2.4s linear infinite;
        }
        .animate-fiber-2 {
          stroke-dasharray: 22 80;
          animation: laser-flow-rev 2.8s linear infinite;
        }
        .animate-sonar-beacon {
          animation: beacon-sonar 2.6s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
        }
        .animate-core-pulse {
          animation: core-glow-pulse 3s ease-in-out infinite;
        }
      `}</style>

      {/* Background Soft Ambient Blur Orbs */}
      <div className="absolute -top-20 -left-20 w-[35rem] h-[35rem] bg-indigo-200/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[35rem] h-[35rem] bg-blue-200/40 rounded-full blur-[140px] pointer-events-none" />

      {/* Center Floating Card Modal Container */}
      <div
        className={`w-full max-w-5xl bg-white rounded-3xl sm:rounded-[2.25rem] shadow-[0_25px_80px_-15px_rgba(15,23,42,0.14)] border border-slate-200/90 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 transition-transform ${
          shaking ? 'animate-[shake_0.5s_ease]' : ''
        }`}
      >
        
        {/* ────────────────────────────────────────────────────────────
           LEFT PANEL: Enterprise Campus Infrastructure Command Topology
        ──────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 bg-gradient-to-b from-[#0B1120] via-[#0F172A] to-[#131E38] text-white p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/90 min-h-[520px] lg:min-h-[600px]">
          
          {/* Subtle Cyber Grid Background with Radial Mask */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#38bdf80a_1px,transparent_1px),linear-gradient(to_bottom,#38bdf80a_1px,transparent_1px)] bg-[size:1.75rem_1.75rem] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none" />

          {/* Ambient Lighting Accents */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* 1. TOP BAR: Branding & Live Grid Status */}
          <div className="relative z-10 flex items-center justify-between pb-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-md border border-white/80 shrink-0 flex items-center justify-center">
                <CollegeLogo className="h-10 w-auto" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">
                  MRF Admin Portal
                </h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Campus Facilities Grid
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>100% ONLINE</span>
            </div>
          </div>

          {/* 2. THE VISUAL TOPOLOGY CANVAS (Building Nodes + Precision Fiber Optics) */}
          <div className="relative z-10 my-auto py-2 w-full flex-1 flex flex-col justify-center">
            
            {/* Topology Frame Container */}
            <div className="relative w-full h-[300px] sm:h-[320px] rounded-2xl bg-[#080E1E]/90 border border-slate-800/90 shadow-[inset_0_2px_24px_rgba(0,0,0,0.7)] overflow-hidden p-3.5 flex items-center justify-center">
              
              {/* Fiber Optics Laser Stream Canvas (SVG Layer in Background) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 400 300" preserveAspectRatio="none" fill="none">
                <defs>
                  {/* Laser Gradients */}
                  <linearGradient id="fiberGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#60A5FA" />
                    <stop offset="100%" stopColor="#818CF8" />
                  </linearGradient>

                  <linearGradient id="fiberGradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#C084FC" />
                    <stop offset="50%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#60A5FA" />
                  </linearGradient>

                  <linearGradient id="fiberGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34D399" />
                    <stop offset="50%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#60A5FA" />
                  </linearGradient>

                  <linearGradient id="fiberGradRose" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F472B6" />
                    <stop offset="50%" stopColor="#C084FC" />
                    <stop offset="100%" stopColor="#818CF8" />
                  </linearGradient>

                  <filter id="neonBeamFilter" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* ── Background Dark Circuit Bus Tracks ── */}
                {/* Academic (95, 60) -> Admin Hub (200, 150) */}
                <path d="M 95 60 C 135 60, 155 150, 200 150" stroke="#1E293B" strokeWidth="2.5" />
                {/* Labs (95, 240) -> Admin Hub (200, 150) */}
                <path d="M 95 240 C 135 240, 155 150, 200 150" stroke="#1E293B" strokeWidth="2.5" />
                {/* Library (305, 60) -> Admin Hub (200, 150) */}
                <path d="M 305 60 C 265 60, 245 150, 200 150" stroke="#1E293B" strokeWidth="2.5" />
                {/* Hostels (305, 240) -> Admin Hub (200, 150) */}
                <path d="M 305 240 C 265 240, 245 150, 200 150" stroke="#1E293B" strokeWidth="2.5" />

                {/* Inter-Building Vertical Side Tracks */}
                <line x1="95" y1="60" x2="95" y2="240" stroke="#131C35" strokeWidth="1.8" strokeDasharray="3 3" />
                <line x1="305" y1="60" x2="305" y2="240" stroke="#131C35" strokeWidth="1.8" strokeDasharray="3 3" />

                {/* ── Active Glowing Laser Streams ── */}
                {/* 1. Academic to Admin Core */}
                <path
                  d="M 95 60 C 135 60, 155 150, 200 150"
                  stroke="url(#fiberGradCyan)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-1"
                />

                {/* 2. Labs to Admin Core */}
                <path
                  d="M 95 240 C 135 240, 155 150, 200 150"
                  stroke="url(#fiberGradEmerald)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-2"
                />

                {/* 3. Library to Admin Core */}
                <path
                  d="M 305 60 C 265 60, 245 150, 200 150"
                  stroke="url(#fiberGradPurple)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-1"
                />

                {/* 4. Hostels to Admin Core */}
                <path
                  d="M 305 240 C 265 240, 245 150, 200 150"
                  stroke="url(#fiberGradRose)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-2"
                />

                {/* 5. Central Hub Sonar Radar Wave */}
                <g transform="translate(200, 150)">
                  <circle cx="0" cy="0" r="14" fill="none" stroke="#6366F1" strokeWidth="1.5" className="animate-sonar-beacon" />
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#818CF8" strokeWidth="0.8" opacity="0.35" />
                </g>
              </svg>

              {/* ── Sculpted Professional Building Node Cards (HTML/CSS Overlay) ── */}
              
              {/* Node 1: Academic Block (Top-Left) */}
              <div
                className={`absolute top-3 left-3 w-40 p-2.5 rounded-xl border backdrop-blur-md transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 0
                    ? 'bg-slate-900/90 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.35)] ring-1 ring-sky-400/50'
                    : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
                  <School size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-white block truncate leading-tight">Academic Quad</span>
                  <span className="text-[9px] font-semibold text-slate-400 block truncate">24 Lecture Halls</span>
                </div>
              </div>

              {/* Node 2: Central Library (Top-Right) */}
              <div
                className={`absolute top-3 right-3 w-40 p-2.5 rounded-xl border backdrop-blur-md transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 1
                    ? 'bg-slate-900/90 border-purple-400 shadow-[0_0_20px_rgba(192,132,252,0.35)] ring-1 ring-purple-400/50'
                    : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                  <Library size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-white block truncate leading-tight">Central Library</span>
                  <span className="text-[9px] font-semibold text-slate-400 block truncate">Archives & Media</span>
                </div>
              </div>

              {/* Node 3: MASTER CORE HUB — Central Admin Complex (Center) */}
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 p-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 z-20 flex items-center gap-3 shadow-xl ${
                  activeIdx === 2
                    ? 'bg-slate-900/95 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.5)] ring-2 ring-indigo-400/60 animate-core-pulse'
                    : 'bg-slate-900/85 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.25)]'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/40 shrink-0">
                  <Landmark size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white block truncate leading-tight">Admin Complex</span>
                    <span className="text-[8px] font-black bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 px-1.5 py-0.2 rounded uppercase">
                      HUB
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-indigo-300 block truncate mt-0.5">Master Gateway Online</span>
                </div>
              </div>

              {/* Node 4: Research Labs (Bottom-Left) */}
              <div
                className={`absolute bottom-3 left-3 w-40 p-2.5 rounded-xl border backdrop-blur-md transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 3
                    ? 'bg-slate-900/90 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)] ring-1 ring-emerald-400/50'
                    : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <Cpu size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-white block truncate leading-tight">Research Labs</span>
                  <span className="text-[9px] font-semibold text-slate-400 block truncate">HVAC & Cleanrooms</span>
                </div>
              </div>

              {/* Node 5: Student Hostels (Bottom-Right) */}
              <div
                className={`absolute bottom-3 right-3 w-40 p-2.5 rounded-xl border backdrop-blur-md transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 4
                    ? 'bg-slate-900/90 border-pink-400 shadow-[0_0_20px_rgba(244,114,182,0.35)] ring-1 ring-pink-400/50'
                    : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-300 shrink-0">
                  <Building size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-white block truncate leading-tight">Student Hostels</span>
                  <span className="text-[9px] font-semibold text-slate-400 block truncate">Power & Utilities</span>
                </div>
              </div>

            </div>

            {/* 3. DYNAMIC REAL-TIME TELEMETRY STATUS DOCK */}
            <div className="mt-3 bg-slate-900/80 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-800 shadow-md flex items-center justify-between transition-all duration-300">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: activeNode.color }}>
                  <activeNode.icon size={14} />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white block leading-tight truncate">
                      {activeNode.name}
                    </span>
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded bg-white/15 text-slate-200 shrink-0">
                      {activeNode.tag}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 block leading-tight truncate mt-0.5">
                    {activeNode.desc} • Status: {activeNode.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-lg text-[9px] font-bold">
                  <Zap size={10} className="text-emerald-400" />
                  <span>Synced</span>
                </div>
                <div className="hidden sm:flex items-center gap-1 bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold">
                  <Activity size={10} className="text-cyan-400" />
                  <span>{latency}ms</span>
                </div>
              </div>
            </div>

          </div>

          {/* 4. FOOTER: Campus Governance Verification Tag */}
          <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-semibold text-slate-400">
            <span>© 2026 Campus Facilities Governance</span>
            <span className="flex items-center gap-1.5 text-cyan-300 font-extrabold">
              <ShieldCheck size={13} className="text-cyan-400" />
              <span>SSL-256 Encrypted Grid</span>
            </span>
          </div>

        </div>

        {/* ────────────────────────────────────────────────────────────
           RIGHT PANEL: Elegant White Administrator Sign In Form
        ──────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 p-7 sm:p-9 md:p-11 bg-white flex flex-col justify-center space-y-5">
          
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Admin Sign In</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Official Campus Facilities Management Control</p>
          </div>

          {/* Role Notice Badge */}
          <div className="flex items-center gap-2.5 bg-indigo-50/80 border border-indigo-100 rounded-2xl px-4 py-2.5 text-xs font-medium text-indigo-800">
            <Shield size={15} className="text-indigo-600 shrink-0" />
            <span>This administrative portal is for <strong className="font-extrabold text-indigo-950">Authorized Staff only</strong></span>
          </div>

          {/* Section Divider */}
          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest absolute">
              VERIFY CREDENTIALS
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            
            {/* Email Input */}
            <div>
              <label htmlFor="admin-email" className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. admin@mrf.edu"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-[#F5F7FA] text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 outline-none"
                  autoFocus
                />
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Enter the email address registered with your campus account.</p>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="admin-password" className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter admin password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-[#F5F7FA] text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 outline-none"
                />
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 font-semibold animate-slide-up">
                <AlertCircle size={15} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-[#1E1E38] hover:bg-[#141428] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-900/15 transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-95 cursor-pointer mt-2"
            >
              <span>Verify & Sign In</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Demo Credentials Footer Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 font-medium text-[11px]">
              <KeyRound size={13} className="text-indigo-600" />
              <span>Demo: <strong className="text-slate-800 font-mono">admin@mrf.edu</strong> / <strong className="text-slate-800 font-mono">admin@mrf2024</strong></span>
            </div>
            <button
              type="button"
              onClick={fillDemo}
              className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Sparkles size={11} /> Auto-Fill
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
