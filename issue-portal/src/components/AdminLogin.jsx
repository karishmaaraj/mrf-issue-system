/**
 * AdminLogin.jsx — MCC Institutional Admin Portal Login Page
 * 100% Theme Integration (Primary MCC Maroon #800000, White #FFFFFF, Light Background #F7F7F7, Dark Text #171717, Border #E5E5E5)
 * Pure Color-Theme Replacement preserving exact layout, structure, and login logic.
 */
import React, { useState, useEffect } from 'react';
import CollegeLogo from './CollegeLogo.jsx';
import {
  Mail, Lock, Eye, EyeOff, Shield, AlertCircle,
  ArrowRight, Sparkles, KeyRound, CheckCircle2, Activity,
  Building, Building2, Landmark, School, Library, Radio, Wifi, Zap, ShieldCheck, MapPin, Cpu
} from 'lucide-react';

const ADMIN_EMAIL = 'admin@mcc.edu';
const ADMIN_PASSWORD = 'admin@mcc2024';

const CAMPUS_NODES = [
  { id: 'academic', name: 'Academic Block', desc: '24 Lecture Halls', status: 'Optimal', icon: School, color: '#800000', tag: 'Academic' },
  { id: 'library', name: 'Central Library', desc: 'Archives & Media', status: 'Synced', icon: Library, color: '#800000', tag: 'Library' },
  { id: 'admin', name: 'Admin Complex', desc: 'Master Core Hub', status: 'Master', icon: Landmark, color: '#800000', tag: 'Gateway' },
  { id: 'labs', name: 'Research Labs', desc: 'HVAC & Cleanrooms', status: 'Nominal', icon: Cpu, color: '#800000', tag: 'Science' },
  { id: 'hostels', name: 'Student Hostels', desc: 'Power & Utilities', status: 'Active', icon: Building, color: '#800000', tag: 'Residences' },
];

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  // Cycling active node for dynamic live telemetry highlight
  const [activeIdx, setActiveIdx] = useState(2);
  const [latency, setLatency] = useState(12);

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
      (password === ADMIN_PASSWORD || password === 'admin2024')
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
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-3 sm:p-5 md:p-8 selection:bg-[#800000] selection:text-white font-sans relative overflow-hidden">

      {/* Keyframe animations */}
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
          0%, 100% { box-shadow: 0 0 15px rgba(128, 0, 0, 0.2); }
          50% { box-shadow: 0 0 25px rgba(128, 0, 0, 0.4); }
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

      {/* Subtle Background Maroon Orbs */}
      <div className="absolute -top-20 -left-20 w-[35rem] h-[35rem] bg-[#800000]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[35rem] h-[35rem] bg-[#800000]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Center Floating Card Modal Container */}
      <div
        className={`w-full max-w-5xl bg-[#FFFFFF] rounded-3xl sm:rounded-[2.25rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-[#E5E5E5] overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 transition-transform ${
          shaking ? 'animate-[shake_0.5s_ease]' : ''
        }`}
      >

        {/* ────────────────────────────────────────────────────────────
           LEFT PANEL: Campus Infrastructure Command Topology (Light Gray #F7F7F7)
        ──────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 bg-[#F7F7F7] text-[#171717] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-[#E5E5E5] min-h-[520px] lg:min-h-[600px]">

          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8000000d_1px,transparent_1px),linear-gradient(to_bottom,#8000000d_1px,transparent_1px)] bg-[size:1.75rem_1.75rem] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none" />

          {/* 1. TOP BAR: Branding & Live Grid Status */}
          <div className="relative z-10 flex items-center justify-between pb-3.5 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-xs border border-[#E5E5E5] shrink-0 flex items-center justify-center">
                <CollegeLogo className="h-10 w-auto" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-[#171717] tracking-tight leading-tight">
                  MCC Admin Portal
                </h2>
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                  Campus Facilities Grid
                </span>
              </div>
            </div>

            {/* ONLINE STATUS: Preserved Success Green #159447 */}
            <div className="flex items-center gap-1.5 bg-[#F0FDF4] border border-[#BBF7D0] text-[#159447] text-[10px] font-black px-2.5 py-1 rounded-full shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#159447] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#159447]" />
              </span>
              <span>100% ONLINE</span>
            </div>
          </div>

          {/* 2. THE VISUAL TOPOLOGY CANVAS */}
          <div className="relative z-10 my-auto py-2 w-full flex-1 flex flex-col justify-center">

            {/* Topology Frame Container */}
            <div className="relative w-full h-[300px] sm:h-[320px] rounded-2xl bg-[#FFFFFF] border border-[#E5E5E5] shadow-xs overflow-hidden p-3.5 flex items-center justify-center">

              {/* Laser Stream Canvas (SVG Layer in Background) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 400 300" preserveAspectRatio="none" fill="none">
                <defs>
                  {/* MCC Maroon Laser Gradients */}
                  <linearGradient id="fiberGradMaroon" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#800000" />
                    <stop offset="50%" stopColor="#990000" />
                    <stop offset="100%" stopColor="#660000" />
                  </linearGradient>

                  <filter id="neonBeamFilter" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Background Circuit Bus Tracks */}
                <path d="M 95 60 C 135 60, 155 150, 200 150" stroke="#E5E5E5" strokeWidth="2.5" />
                <path d="M 95 240 C 135 240, 155 150, 200 150" stroke="#E5E5E5" strokeWidth="2.5" />
                <path d="M 305 60 C 265 60, 245 150, 200 150" stroke="#E5E5E5" strokeWidth="2.5" />
                <path d="M 305 240 C 265 240, 245 150, 200 150" stroke="#E5E5E5" strokeWidth="2.5" />

                <line x1="95" y1="60" x2="95" y2="240" stroke="#E5E5E5" strokeWidth="1.8" strokeDasharray="3 3" />
                <line x1="305" y1="60" x2="305" y2="240" stroke="#E5E5E5" strokeWidth="1.8" strokeDasharray="3 3" />

                {/* Active Glowing Laser Streams (MCC Maroon #800000) */}
                <path
                  d="M 95 60 C 135 60, 155 150, 200 150"
                  stroke="url(#fiberGradMaroon)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-1"
                />

                <path
                  d="M 95 240 C 135 240, 155 150, 200 150"
                  stroke="url(#fiberGradMaroon)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-2"
                />

                <path
                  d="M 305 60 C 265 60, 245 150, 200 150"
                  stroke="url(#fiberGradMaroon)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-1"
                />

                <path
                  d="M 305 240 C 265 240, 245 150, 200 150"
                  stroke="url(#fiberGradMaroon)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#neonBeamFilter)"
                  className="animate-fiber-2"
                />

                {/* Central Hub Sonar Radar Wave */}
                <g transform="translate(200, 150)">
                  <circle cx="0" cy="0" r="14" fill="none" stroke="#800000" strokeWidth="1.5" className="animate-sonar-beacon" />
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#800000" strokeWidth="0.8" opacity="0.25" />
                </g>
              </svg>

              {/* ── Building Node Cards (Visual Colors: All Changed to Maroon #800000 & Crisp White) ── */}

              {/* Node 1: Academic Block (Top-Left) */}
              <div
                className={`absolute top-3 left-3 w-40 p-2.5 rounded-xl border transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 0
                    ? 'bg-white border-[#800000] shadow-[0_4px_14px_rgba(128,0,0,0.15)] ring-1 ring-[#800000]/40'
                    : 'bg-white/90 border-[#E5E5E5] hover:border-[#800000]/40'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#F7EAEA] border border-[#800000]/20 flex items-center justify-center text-[#800000] shrink-0">
                  <School size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-[#171717] block truncate leading-tight">Academic Quad</span>
                  <span className="text-[9px] font-semibold text-[#666666] block truncate">24 Lecture Halls</span>
                </div>
              </div>

              {/* Node 2: Central Library (Top-Right) */}
              <div
                className={`absolute top-3 right-3 w-40 p-2.5 rounded-xl border transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 1
                    ? 'bg-white border-[#800000] shadow-[0_4px_14px_rgba(128,0,0,0.15)] ring-1 ring-[#800000]/40'
                    : 'bg-white/90 border-[#E5E5E5] hover:border-[#800000]/40'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#F7EAEA] border border-[#800000]/20 flex items-center justify-center text-[#800000] shrink-0">
                  <Library size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-[#171717] block truncate leading-tight">Central Library</span>
                  <span className="text-[9px] font-semibold text-[#666666] block truncate">Archives & Media</span>
                </div>
              </div>

              {/* Node 3: MASTER CORE HUB — Central Admin Complex (Center) */}
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 p-3 rounded-2xl border transition-all duration-300 z-20 flex items-center gap-3 shadow-md ${
                  activeIdx === 2
                    ? 'bg-white border-[#800000] shadow-[0_4px_20px_rgba(128,0,0,0.2)] ring-2 ring-[#800000] animate-core-pulse'
                    : 'bg-white border-[#800000]/60 shadow-xs'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#800000] flex items-center justify-center text-white shadow-xs shrink-0">
                  <Landmark size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#171717] block truncate leading-tight">Admin Complex</span>
                    <span className="text-[8px] font-black bg-[#F7EAEA] text-[#800000] border border-[#800000]/30 px-1.5 py-0.2 rounded uppercase">
                      HUB
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-[#800000] block truncate mt-0.5">Master Gateway Online</span>
                </div>
              </div>

              {/* Node 4: Research Labs (Bottom-Left) */}
              <div
                className={`absolute bottom-3 left-3 w-40 p-2.5 rounded-xl border transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 3
                    ? 'bg-white border-[#800000] shadow-[0_4px_14px_rgba(128,0,0,0.15)] ring-1 ring-[#800000]/40'
                    : 'bg-white/90 border-[#E5E5E5] hover:border-[#800000]/40'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#F7EAEA] border border-[#800000]/20 flex items-center justify-center text-[#800000] shrink-0">
                  <Cpu size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-[#171717] block truncate leading-tight">Research Labs</span>
                  <span className="text-[9px] font-semibold text-[#666666] block truncate">HVAC & Cleanrooms</span>
                </div>
              </div>

              {/* Node 5: Student Hostels (Bottom-Right) */}
              <div
                className={`absolute bottom-3 right-3 w-40 p-2.5 rounded-xl border transition-all duration-300 z-10 flex items-center gap-2.5 cursor-pointer ${
                  activeIdx === 4
                    ? 'bg-white border-[#800000] shadow-[0_4px_14px_rgba(128,0,0,0.15)] ring-1 ring-[#800000]/40'
                    : 'bg-white/90 border-[#E5E5E5] hover:border-[#800000]/40'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#F7EAEA] border border-[#800000]/20 flex items-center justify-center text-[#800000] shrink-0">
                  <Building size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black text-[#171717] block truncate leading-tight">Student Hostels</span>
                  <span className="text-[9px] font-semibold text-[#666666] block truncate">Power & Utilities</span>
                </div>
              </div>

            </div>

            {/* 3. REAL-TIME TELEMETRY STATUS DOCK */}
            <div className="mt-3 bg-white rounded-xl p-2.5 sm:p-3 border border-[#E5E5E5] shadow-xs flex items-center justify-between transition-all duration-300">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-7 h-7 rounded-lg bg-[#800000] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <activeNode.icon size={14} />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#171717] block leading-tight truncate">
                      {activeNode.name}
                    </span>
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded bg-[#F7EAEA] text-[#800000] border border-[#800000]/20 shrink-0">
                      {activeNode.tag}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-[#666666] block leading-tight truncate mt-0.5">
                    {activeNode.desc} • Status: {activeNode.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <div className="flex items-center gap-1 bg-[#F0FDF4] border border-[#BBF7D0] text-[#159447] px-2 py-0.5 rounded-lg text-[9px] font-bold">
                  <Zap size={10} className="text-[#159447]" />
                  <span>Synced</span>
                </div>
                <div className="hidden sm:flex items-center gap-1 bg-[#F7F7F7] text-[#666666] border border-[#E5E5E5] px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold">
                  <Activity size={10} className="text-[#800000]" />
                  <span>{latency}ms</span>
                </div>
              </div>
            </div>

          </div>

          {/* 4. FOOTER */}
          <div className="relative z-10 pt-3 border-t border-[#E5E5E5] flex items-center justify-between text-[10px] font-semibold text-[#666666]">
            <span>© 2026 Campus Facilities Governance</span>
            <span className="flex items-center gap-1.5 text-[#800000] font-extrabold">
              <ShieldCheck size={13} className="text-[#800000]" />
              <span>SSL-256 Encrypted Grid</span>
            </span>
          </div>

        </div>

        {/* ────────────────────────────────────────────────────────────
           RIGHT PANEL: Administrator Sign In Form
        ──────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 p-7 sm:p-9 md:p-11 bg-[#FFFFFF] flex flex-col justify-center space-y-5">

          {/* Header (Dark Charcoal #171717) */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171717] tracking-tight">Admin Sign In</h1>
            <p className="text-xs text-[#666666] font-medium mt-1">Official Campus Facilities Management Control</p>
          </div>

          {/* "Authorized Staff only" box: Light Maroon #F7EAEA, Border #800000/30, Text #800000 / #171717 */}
          <div className="flex items-center gap-2.5 bg-[#F7EAEA] border border-[#800000]/30 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#171717]">
            <Shield size={15} className="text-[#800000] shrink-0" />
            <span>This administrative portal is for <strong className="font-extrabold text-[#800000]">Authorized Staff only</strong></span>
          </div>

          {/* Section Divider */}
          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-[#E5E5E5] w-full" />
            <span className="bg-[#FFFFFF] px-3 text-[10px] font-extrabold text-[#666666] uppercase tracking-widest absolute">
              VERIFY CREDENTIALS
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            {/* Email Input: Background #FFFFFF, Border #E5E5E5, Text #171717, Focus Border #800000 (No Blue Glow) */}
            <div>
              <label htmlFor="admin-email" className="block text-[11px] font-extrabold text-[#171717] uppercase tracking-wider mb-1.5">
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
                  placeholder="e.g. admin@mcc.edu"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] text-[#171717] placeholder:text-[#888888] text-xs font-medium focus:bg-white focus:border-[#800000] focus:ring-0 transition duration-150 outline-none"
                  autoFocus
                />
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none" />
              </div>
              <p className="text-[11px] text-[#666666] mt-1">Enter the email address registered with your campus account.</p>
            </div>

            {/* Password Input: Background #FFFFFF, Border #E5E5E5, Text #171717, Focus Border #800000 (No Blue Glow) */}
            <div>
              <label htmlFor="admin-password" className="block text-[11px] font-extrabold text-[#171717] uppercase tracking-wider mb-1.5">
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
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] text-[#171717] placeholder:text-[#888888] text-xs font-medium focus:bg-white focus:border-[#800000] focus:ring-0 transition duration-150 outline-none"
                />
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#171717] transition cursor-pointer"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="flex items-center gap-2 text-[#800000] text-xs bg-[#F7EAEA] border border-[#800000]/30 rounded-xl px-4 py-2.5 font-semibold animate-slide-up">
                <AlertCircle size={15} className="shrink-0 text-[#800000]" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button: Background #800000, Text #FFFFFF, Hover #660000 */}
            <button
              type="submit"
              className="w-full bg-[#800000] hover:bg-[#660000] text-[#FFFFFF] font-bold py-3.5 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer mt-2"
            >
              <span>Verify & Sign In</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
