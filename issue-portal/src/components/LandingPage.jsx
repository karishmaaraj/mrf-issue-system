/**
 * LandingPage.jsx — Premium Hero & Landing Page with Glassmorphism, Floating Particles & Mesh Gradients
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { getSystemConfig, fetchSystemConfigFromServer } from '../systemConfigStore.js';
import {
  ClipboardList, PlusCircle, Shield, Clock, BadgeCheck, Mail,
  Wrench, AlertCircle, PhoneCall, ChevronRight,
  Sparkles, TrendingUp, CheckCircle2, Building2, Megaphone, Crown
} from 'lucide-react';

const HOW_STEPS = [
  {
    stepNum: '01',
    badge: 'STEP 01',
    tag: '⚡ Quick Submission',
    icon: ClipboardList,
    gradient: 'from-blue-600 to-indigo-600',
    topBar: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-200/80 shadow-blue-500/10',
    hoverBorder: 'hover:border-blue-300 hover:shadow-blue-500/10',
    title: 'File Complaint Form',
    desc: 'Select department, block, category, or water leakage sub-types with photo evidence.',
  },
  {
    stepNum: '02',
    badge: 'STEP 02',
    tag: '📌 Live Tracker',
    icon: BadgeCheck,
    gradient: 'from-indigo-600 to-purple-600',
    topBar: 'bg-gradient-to-r from-indigo-500 to-purple-600',
    iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200/80 shadow-indigo-500/10',
    hoverBorder: 'hover:border-indigo-300 hover:shadow-indigo-500/10',
    title: 'Track via Ticket ID',
    desc: 'Receive an auto-generated ticket ID (#003) to monitor real-time multi-stage status.',
  },
  {
    stepNum: '03',
    badge: 'STEP 03',
    tag: '✉️ Email Dispatched',
    icon: Wrench,
    gradient: 'from-emerald-500 to-teal-600',
    topBar: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-emerald-500/10',
    hoverBorder: 'hover:border-emerald-300 hover:shadow-emerald-500/10',
    title: 'Rapid Resolution',
    desc: 'Facility workers resolve the issue and dispatch automated email notifications to submitters.',
  },
];

export default function LandingPage() {
  const [systemConfig, setSystemConfig] = useState(() => getSystemConfig());

  useEffect(() => {
    fetchSystemConfigFromServer().then(cfg => {
      if (cfg) setSystemConfig(cfg);
    });
    const handleStorage = (e) => {
      if (e.key === 'mrf_system_config') {
        setSystemConfig(getSystemConfig());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col selection:bg-blue-500 selection:text-white">
      
      {/* Hero Section Custom Animations */}
      <style>{`
        @keyframes float-card-1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes float-card-2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-1deg); }
        }
        @keyframes float-card-3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
        }
        @keyframes float-card-4 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-11px) rotate(1deg); }
        }
        .animate-float-1 { animation: float-card-1 5s ease-in-out infinite; }
        .animate-float-2 { animation: float-card-2 5.8s ease-in-out infinite 0.7s; }
        .animate-float-3 { animation: float-card-3 5.2s ease-in-out infinite 1.4s; }
        .animate-float-4 { animation: float-card-4 6.2s ease-in-out infinite 2.1s; }
        .animate-orb-mesh {
          animation: orb-float 8s ease-in-out infinite;
        }
      `}</style>

      {/* Translucent Glassmorphic Navbar */}
      <Navbar />

      {/* Broadcast Banner Live Notice from Super Admin */}
      {systemConfig.announcement?.enabled && systemConfig.announcement?.message && (
        <div className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
          systemConfig.announcement.type === 'alert'
            ? 'bg-red-500 text-white border-red-600'
            : systemConfig.announcement.type === 'warning'
            ? 'bg-amber-500 text-slate-950 border-amber-600'
            : 'bg-blue-600 text-white border-blue-700'
        }`}>
          <div className="max-w-6xl mx-auto w-full flex items-center gap-2">
            <Megaphone size={15} className="shrink-0 animate-bounce" />
            <span className="uppercase text-[10px] font-black tracking-wider px-1.5 py-0.5 bg-black/20 rounded">Campus Notice</span>
            <span className="truncate">{systemConfig.announcement.message}</span>
          </div>
        </div>
      )}

      {/* Hero Banner with Rich SaaS Design, Glassmorphism & Mesh Background */}
      <div className="relative bg-[#0F172A] text-white overflow-hidden py-16 md:py-24 border-b border-slate-800">
        
        {/* Dynamic Gradient Mesh Orbs with Continuous Floating Glow */}
        <div className="absolute -top-24 -left-20 w-96 h-96 bg-blue-600/35 rounded-full blur-[110px] pointer-events-none animate-orb-mesh" />
        <div className="absolute top-1/2 -right-20 w-[30rem] h-[30rem] bg-indigo-600/30 rounded-full blur-[130px] pointer-events-none animate-orb-mesh" style={{ animationDelay: '-4s' }} />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none animate-orb-mesh" style={{ animationDelay: '-2s' }} />

        {/* Subtle Background Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-12">
          
          {/* Left Column: Headline & Action Badges */}
          <div className="flex-1 text-center md:text-left space-y-6">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-blue-300 bg-blue-950/80 backdrop-blur-md border border-blue-500/40 px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/10 hover:border-blue-400 transition-all duration-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <Shield size={14} className="text-blue-400" />
              <span>Official MCC Campus Maintenance Portal</span>
            </div>

            {/* Glowing Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.15] tracking-tight text-white">
              Campus Maintenance <br />
              <span className="bg-gradient-to-r from-sky-400 via-blue-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-sm font-extrabold inline-block pb-1">
                & Issue Resolution
              </span>
            </h1>

            <p className="text-slate-300 text-sm md:text-base max-w-xl leading-relaxed font-medium">
              Report maintenance issues for classrooms, labs, hostels, water coolers, and campus infrastructure.
              Track resolution progress in real-time with automatic email alerts to admins and workers.
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap gap-4 pt-4 justify-center md:justify-start">
              {[
                { icon: Clock, text: '24h Target Response' },
                { icon: BadgeCheck, text: 'Auto Ticket ID (#003)' },
                { icon: Mail, text: 'Email Resolution Alert' },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-2 text-xs text-slate-300 font-semibold bg-slate-800/80 backdrop-blur-md border border-slate-700/80 px-4 py-2 rounded-xl shadow-md hover:border-blue-500/50 hover:text-white hover:scale-105 transition-all duration-300 group cursor-default"
                >
                  <Icon size={14} className="text-blue-400 group-hover:rotate-12 transition-transform" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Animated Floating Modern Glassmorphism KPI Dashboard Cards */}
          <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-auto">
            {[
              { value: '100+', label: 'Issues Solved', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', anim: 'animate-float-1' },
              { value: '24h', label: 'Response SLA', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', anim: 'animate-float-2' },
              { value: '14+', label: 'Departments', icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', anim: 'animate-float-3' },
              { value: '100%', label: 'Tracked & Logged', icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/25', anim: 'animate-float-4' },
            ].map(({ value, label, icon: Icon, color, bg, anim }) => (
              <div
                key={label}
                className={`${anim} backdrop-blur-2xl bg-slate-800/50 border ${bg} rounded-3xl p-6 min-w-[145px] text-center hover:scale-110 hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-300 shadow-2xl group relative overflow-hidden`}
              >
                {/* Glow Background Pulse */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex justify-center mb-2.5 relative">
                  <Icon size={24} className={`${color} group-hover:scale-125 transition-transform duration-300`} />
                </div>
                <p className="text-3xl md:text-4xl font-black text-white tracking-tight group-hover:text-blue-200 transition-colors">{value}</p>
                <p className="text-[11px] font-extrabold text-slate-400 mt-1 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-16 flex-1 w-full">
        
        {/* Section 1: Workflow Overview Cards */}
        <section className="space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-200/80 px-4 py-1.5 rounded-full shadow-sm">
              <Sparkles size={14} className="text-blue-500" />
              <span>TRANSPARENT CAMPUS WORKFLOW</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">How Complaints Get Solved</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg mx-auto">Clear 3-stage process from ticket submission to full resolution.</p>
          </div>

          <div className="relative space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {HOW_STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className={`
                      relative overflow-hidden bg-white
                      rounded-tl-[48px] rounded-br-[48px] rounded-tr-2xl rounded-bl-2xl
                      border border-slate-200/90 shadow-[0_10px_35px_-8px_rgba(0,0,0,0.06)]
                      hover:shadow-[0_28px_60px_-15px_rgba(37,99,235,0.18)]
                      hover:-translate-y-3.5 hover:scale-[1.02]
                      transition-all duration-300 flex flex-col justify-between group
                    `}
                  >
                    {/* Interactive reflective light shine sweep */}
                    <div className="card-shine-effect" />

                    {/* Top Asymmetrical Curved Gradient Canopy */}
                    <div className={`h-3.5 w-full bg-gradient-to-r ${step.gradient} shadow-sm group-hover:h-5 transition-all duration-300`} />

                    {/* Background Soft Colored Ambient Flare */}
                    <div className="absolute -top-12 -left-12 w-40 h-40 bg-gradient-to-br from-blue-100/50 to-indigo-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div className="p-8 space-y-6 flex-1 relative z-10">
                      {/* Top Header: Floating Step Badge & Giant Watermark */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-2 text-xs font-black px-4 py-1.5 rounded-full text-white bg-gradient-to-r ${step.gradient} shadow-md tracking-wider uppercase transform group-hover:scale-105 transition-transform`}>
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          {step.badge}
                        </span>

                        <span className="text-5xl font-black text-slate-100/90 group-hover:text-slate-200 group-hover:scale-115 transition-all duration-300 select-none font-mono tracking-tighter">
                          {step.stepNum}
                        </span>
                      </div>

                      {/* Orbital Floating Icon Sphere with Concentric Ring */}
                      <div className="flex items-center gap-4">
                        <div className={`w-18 h-18 rounded-[26px] ${step.iconBg} flex items-center justify-center shadow-xl ring-8 ring-slate-50/80 group-hover:ring-blue-100/80 group-hover:scale-115 group-hover:rotate-6 transition-all duration-300`}>
                          <Icon size={30} className="transform transition-transform group-hover:scale-110" />
                        </div>
                      </div>

                      {/* Step Title & Description with Tinted Underline Accent */}
                      <div className="space-y-2.5">
                        <h4 className="font-black text-slate-900 text-xl tracking-tight group-hover:text-blue-600 transition-colors">
                          {step.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                          {step.desc}
                        </p>
                      </div>
                    </div>

                    {/* Sculpted Bottom Pill Bar */}
                    <div className="px-8 pb-8 pt-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between relative z-10">
                      <span className="text-xs font-black text-slate-700 bg-white border border-slate-200/90 px-4 py-1.5 rounded-xl shadow-2xs group-hover:border-blue-300 group-hover:text-blue-600 transition-all">
                        {step.tag}
                      </span>
                      <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:border-blue-600 group-hover:scale-110 transition-all duration-300 shadow-2xs">
                        <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Button below How Complaints Get Solved Section */}
            <div className="flex justify-center pt-2">
              <Link
                to="/complaint"
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black px-9 py-4 rounded-2xl shadow-xl shadow-blue-600/30 hover:shadow-blue-500/50 transition-all duration-300 flex items-center justify-center gap-3 text-sm sm:text-base hover:scale-[1.03] active:scale-95 group"
              >
                <PlusCircle size={22} className="group-hover:rotate-90 transition-transform duration-300" />
                <span>Submit Complaint Now</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Section 2: Contact & Emergency Support Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Facilities Contact & Support Card */}
          <div className="bg-[#EEF5FF] border border-blue-200/70 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2.5">
              <PhoneCall size={20} className="text-blue-600 shrink-0" />
              <h4 className="font-extrabold text-slate-900 text-base sm:text-lg">Facilities Contact & Support</h4>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              If you have urgent inquiries regarding a previously submitted complaint, contact the campus facilities helpdesk.
            </p>
            <div className="space-y-1.5 text-xs sm:text-sm text-slate-700 font-medium pt-2">
              <p><span className="font-bold text-slate-900">Office:</span> Campus Maintenance Office, Ground Floor, Admin Block</p>
              <p><span className="font-bold text-slate-900">Email:</span> mrf-support@campus.edu</p>
              <p><span className="font-bold text-slate-900">Hours:</span> Monday – Saturday (8:30 AM – 5:00 PM)</p>
            </div>
          </div>

          {/* Emergency Hazards Card */}
          <div className="bg-[#FFF0F0] border border-red-200/70 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={20} className="text-red-600 shrink-0" />
              <h4 className="font-extrabold text-red-900 text-base sm:text-lg">Emergency Hazards</h4>
            </div>
            <p className="text-xs sm:text-sm text-red-800 leading-relaxed font-normal">
              For critical emergencies such as active electrical fires, major gas leaks, structural collapse, or severe flooding, please contact security immediately.
            </p>
            <div className="text-xs sm:text-sm pt-2">
              <p className="font-bold text-red-950">
                Emergency Helpline: <span className="font-extrabold text-red-900 underline underline-offset-2">+91 0000-00000</span>
              </p>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="bg-[#0B132B] text-slate-400 border-t border-slate-800 py-6 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <ClipboardList size={16} className="text-blue-400" />
            <span>MRF Issue Portal</span>
            <span className="text-slate-500 font-normal">— Campus Complaint System</span>
          </div>
          <p className="text-slate-400">© 2026 Campus Facilities Dept. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
