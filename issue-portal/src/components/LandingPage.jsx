/**
 * LandingPage.jsx — Premium Hero & Landing Page with Glassmorphism, Floating Particles & Mesh Gradients
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import campusBg from '../assets/campus_bg.png';
import campusIllustration from '../assets/campus_illustration.png';
import { getSystemConfig, fetchSystemConfigFromServer } from '../systemConfigStore.js';
import {
  ClipboardList, PlusCircle, Shield, Clock, BadgeCheck, Mail,
  Wrench, AlertCircle, PhoneCall, ChevronRight,
  Sparkles, TrendingUp, CheckCircle2, Building2, Megaphone, Crown,
  Search, Users, BarChart2, Zap, Rocket, Plus, Check, Send, ArrowRight
} from 'lucide-react';

const HOW_STEPS = [
  {
    stepNum: '01',
    badge: 'STEP 01',
    badgeBg: 'bg-blue-600',
    topBar: 'bg-blue-600',
    topWash: 'bg-gradient-to-b from-blue-50/60 to-transparent',
    hoverBorder: 'hover:border-blue-300 hover:shadow-blue-500/15',
    title: 'File Complaint Form',
    desc: 'Select department, block, category, or write a detailed issue description with photos or location.',
    iconType: 'clipboard',
    tagIcon: Zap,
    tagTitle: 'Quick Submission',
    tagSubtitle: 'Easy • Simple • Fast',
    tagBg: 'bg-[#FFFBEB] border-amber-200/80',
    tagIconColor: 'text-amber-500',
    arrowBg: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    accentColor: 'blue',
  },
  {
    stepNum: '02',
    badge: 'STEP 02',
    badgeBg: 'bg-indigo-600',
    topBar: 'bg-gradient-to-r from-indigo-500 via-purple-600 to-purple-700',
    topWash: 'bg-gradient-to-b from-purple-50/60 to-transparent',
    hoverBorder: 'hover:border-purple-300 hover:shadow-purple-500/15',
    title: 'Track via Ticket ID',
    desc: 'Receive an auto-generated ticket ID (#003) to monitor real-time multi-stage status.',
    iconType: 'ticket',
    tagIcon: Rocket,
    tagTitle: 'Live Tracker',
    tagSubtitle: 'Real-time updates at your fingertips.',
    tagBg: 'bg-[#FAF5FF] border-purple-200/80',
    tagIconColor: 'text-purple-500',
    arrowBg: 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
    accentColor: 'purple',
  },
  {
    stepNum: '03',
    badge: 'STEP 03',
    badgeBg: 'bg-emerald-600',
    topBar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    topWash: 'bg-gradient-to-b from-emerald-50/60 to-transparent',
    hoverBorder: 'hover:border-emerald-300 hover:shadow-emerald-500/15',
    title: 'Rapid Resolution',
    desc: 'Facility workers resolve the issue and dispatch automated email notifications to submitters.',
    iconType: 'wrench',
    tagIcon: Mail,
    tagTitle: 'Email Dispatched',
    tagSubtitle: 'Stay informed every step of the way.',
    tagBg: 'bg-[#F0FDF4] border-emerald-200/80',
    tagIconColor: 'text-emerald-500',
    arrowBg: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    accentColor: 'green',
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
    // Poll every 4s so LandingPage stays in sync with Super Admin changes
    const pollTimer = setInterval(() => {
      fetchSystemConfigFromServer().then(cfg => {
        if (cfg) setSystemConfig(cfg);
      });
    }, 4000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollTimer);
    };
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
        <div className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${systemConfig.announcement.type === 'alert'
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

      {/* Portal Notice Banner (Super Admin: portalNotice) — shown on Landing Page */}
      {systemConfig.portalNotice?.enabled && systemConfig.portalNotice?.message && (
        <div className={`px-6 py-2.5 text-xs font-bold flex items-center border-b ${
          systemConfig.portalNotice.type === 'alert'
            ? 'bg-red-50 text-red-800 border-red-200'
            : systemConfig.portalNotice.type === 'warning'
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
        }`}>
          <div className="max-w-6xl mx-auto w-full flex items-center gap-2">
            <Megaphone size={14} className="shrink-0" />
            <span className="uppercase text-[10px] font-black tracking-wider px-1.5 py-0.5 bg-black/10 rounded">Portal Notice</span>
            <span>{systemConfig.portalNotice.message}</span>
          </div>
        </div>
      )}

      {/* Hero Banner matched to reference image */}
      <div className="relative overflow-hidden py-16 md:py-24 border-b border-slate-800/60 min-h-[580px] flex items-center bg-slate-950">

        {/* Full Natural Campus Photograph */}
        <img
          src={campusBg}
          alt="MCC MRF Innovation Park"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Left Horizontal Dark Gradient Vignette for Text Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 via-40% to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-10">

          {/* Left Column: Typography, Badges & Action Buttons */}
          <div className="flex-1 space-y-6 text-left max-w-xl">

            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 bg-white px-3.5 py-1.5 rounded-full shadow-lg border border-slate-100">
              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white">
                <Shield size={10} className="fill-white" />
              </div>
              <span className="tracking-widest uppercase text-[11px] font-bold text-slate-700">
                OFFICIAL <span className="text-slate-950 font-black">MCC</span> PORTAL
              </span>
            </div>

            {/* Main Heading & Subtitle */}
            <div className="space-y-2">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight text-white drop-shadow-md">
                Campus <br />
                <span className="text-[#DC2626] font-black inline-block">
                  Maintenance
                </span>
              </h1>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-wide drop-shadow-sm pt-1">
                Report<span className="text-red-500">.</span> Track<span className="text-red-500">.</span> Resolve<span className="text-red-500">.</span>
              </p>
            </div>

            {/* Description Text */}
            <div className="space-y-1 text-slate-300 text-sm md:text-base leading-relaxed font-normal">
              <p>
                Report maintenance issues across classrooms, labs, hostels, water coolers, and campus infrastructure<span className="text-red-500">.</span>
              </p>
              <p>
                Track resolution progress in real-time with automatic email alerts to admins and workers<span className="text-red-500">.</span>
              </p>
            </div>

            {/* Call To Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/complaint"
                className="inline-flex items-center gap-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-red-950/40 hover:shadow-red-900/60 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Wrench size={16} className="text-white" />
                <span>Report an Issue</span>
              </Link>

              <a
                href="#workflow-section"
                className="inline-flex items-center gap-2.5 bg-black/40 hover:bg-black/60 text-white font-bold text-sm px-6 py-3.5 rounded-xl border border-white/25 backdrop-blur-md hover:border-white/50 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Search size={16} className="text-slate-300" />
                <span>Track My Issue</span>
              </a>
            </div>
          </div>

          {/* Right Column: 4 Frosted Glass KPI Cards in 2x2 Grid */}
          <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-[380px]">
            {[
              {
                value: '100+',
                label: 'Issues Resolved',
                desc: 'Successfully resolved maintenance requests',
                icon: CheckCircle2,
                iconColor: 'text-emerald-400',
                labelColor: 'text-emerald-400',
                borderHover: 'hover:border-emerald-500/50',
              },
              {
                value: '24h',
                label: 'Response SLA',
                desc: 'Average target response time',
                icon: Clock,
                iconColor: 'text-amber-400',
                labelColor: 'text-amber-400',
                borderHover: 'hover:border-amber-500/50',
              },
              {
                value: '14+',
                label: 'Departments',
                desc: 'Working together for a better campus',
                icon: Users,
                iconColor: 'text-sky-400',
                labelColor: 'text-sky-400',
                borderHover: 'hover:border-sky-500/50',
              },
              {
                value: '100%',
                label: 'Tracked & Logged',
                desc: 'Every request is tracked transparently',
                icon: BarChart2,
                iconColor: 'text-purple-400',
                labelColor: 'text-purple-400',
                borderHover: 'hover:border-purple-500/50',
              },
            ].map(({ value, label, desc, icon: Icon, iconColor, labelColor, borderHover }) => (
              <div
                key={label}
                className={`bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-center shadow-xl hover:bg-black/50 ${borderHover} hover:scale-[1.03] transition-all duration-300 flex flex-col items-center justify-center`}
              >
                <div className="mb-2">
                  <Icon size={24} className={iconColor} />
                </div>
                <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">{value}</p>
                <p className={`text-xs font-bold ${labelColor} mt-1`}>{label}</p>
                <p className="text-[10px] text-slate-300 font-medium mt-1 leading-tight">{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Section 1: Workflow Overview Cards (Proportionally Scaled Down Compact Version) */}
      <section id="workflow-section" className="w-full bg-[#F8FAFC] py-12 sm:py-16 relative overflow-hidden scroll-mt-10">

        {/* Background Atmospheric Layers & Shapes */}
        {/* 1. Visible Top-Left Dot Matrix (6 rows x 4 cols) */}
        <div className="absolute top-8 left-6 sm:left-10 grid grid-cols-4 gap-3 pointer-events-none -z-10">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#BFDBFE]" />
          ))}
        </div>

        {/* 2. Far-Left Smooth Sky-Blue Cloud Wave */}
        <div className="absolute top-8 -left-24 w-80 h-[400px] bg-[#E0EEFE] rounded-full blur-2xl opacity-90 pointer-events-none -z-10" />

        {/* 3. Far-Right Smooth Lavender/Sky Cloud Wave */}
        <div className="absolute top-6 -right-24 w-80 h-[400px] bg-[#E8EEFF] rounded-full blur-2xl opacity-90 pointer-events-none -z-10" />

        {/* Center Content Container */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 space-y-8 sm:space-y-10">

          {/* Section Header */}
          <div className="text-center max-w-xl mx-auto space-y-2 relative z-10">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50/90 border border-indigo-200/80 px-3 py-1 rounded-full shadow-xs">
              <Sparkles size={11} className="text-indigo-500" />
              <span className="tracking-wider uppercase font-extrabold">TRANSPARENT CAMPUS WORKFLOW</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-[32px] font-black text-slate-900 tracking-tight leading-tight">
              How Complaints <span className="text-[#DC2626]">Get Solved</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
              Clear 3-stage process from ticket submission to full resolution.
            </p>

            {/* Slider Dot Indicator */}
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              <span className="w-6 h-0.5 bg-slate-300 rounded-full" />
              <span className="w-2 h-2 bg-[#DC2626] rounded-full shadow-xs" />
              <span className="w-6 h-0.5 bg-slate-300 rounded-full" />
            </div>
          </div>

          {/* 3 Step Workflow Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 relative z-10 pt-1 pb-1">
            {HOW_STEPS.map((step, idx) => {
              const TagIcon = step.tagIcon;
              return (
                <div key={step.title} className="relative flex flex-col">
                  {/* The Card */}
                  <div
                    className={`
                      relative overflow-hidden bg-white
                      rounded-[26px] border border-slate-200/80 shadow-[0_12px_36px_-8px_rgba(0,0,0,0.06)]
                      hover:shadow-[0_20px_48px_-12px_rgba(37,99,235,0.12)] ${step.hoverBorder}
                      hover:-translate-y-2 transition-all duration-300
                      flex flex-col justify-between group p-5 sm:p-5.5 flex-1
                    `}
                  >
                    {/* Top Curved Accent Cap */}
                    <div className={`absolute top-0 inset-x-0 h-1.5 rounded-t-[26px] ${step.topBar}`} />

                    {/* Top Subtle Gradient Wash */}
                    <div className={`absolute top-1.5 inset-x-0 h-24 ${step.topWash} pointer-events-none`} />

                    {/* Card Content Top */}
                    <div className="pt-1 relative z-10">
                      {/* Header: Step Pill & Circular 3D Icon with Floating Specks */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center text-[10px] font-extrabold px-3 py-1 rounded-full text-white ${step.badgeBg} shadow-xs tracking-wider uppercase`}>
                          {step.badge}
                        </span>

                        {/* 3D Styled Step Icon Badge with Floating Specks */}
                        {step.iconType === 'clipboard' && (
                          <div className="relative">
                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/80 flex items-center justify-center relative shadow-xs group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                              <ClipboardList size={24} className="text-blue-600" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs border-2 border-white">
                                <Plus size={11} strokeWidth={3} />
                              </span>
                            </div>
                            <span className="absolute -top-1 -left-1 w-1 h-1 rounded-full bg-blue-400 opacity-70" />
                            <span className="absolute -bottom-1 -left-1.5 w-1 h-1 rounded-full bg-blue-300 opacity-60" />
                          </div>
                        )}

                        {step.iconType === 'ticket' && (
                          <div className="relative">
                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200/80 flex items-center justify-center relative shadow-xs group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                              <div className="px-2 py-0.5 rounded-md bg-purple-100 border-2 border-purple-400 text-purple-700 shadow-2xs flex items-center justify-center">
                                <span className="text-[11px] font-black tracking-tight font-mono">#003</span>
                              </div>
                            </div>
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-ping opacity-75" />
                            <span className="absolute -bottom-0.5 -left-1 w-1 h-1 rounded-full bg-purple-500 opacity-80" />
                            <span className="absolute top-1/2 -right-1.5 w-1 h-1 rounded-full bg-purple-400 opacity-70" />
                          </div>
                        )}

                        {step.iconType === 'wrench' && (
                          <div className="relative">
                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/80 flex items-center justify-center relative shadow-xs group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                              <Wrench size={24} className="text-emerald-600" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border-2 border-white">
                                <Check size={11} strokeWidth={3} />
                              </span>
                            </div>
                            <span className="absolute -top-1 -left-1 w-1 h-1 rounded-full bg-emerald-400 opacity-70" />
                            <span className="absolute bottom-1 -left-1.5 w-1 h-1 rounded-full bg-emerald-300 opacity-60" />
                          </div>
                        )}
                      </div>

                      {/* Step Title & Description */}
                      <div className="mt-4 space-y-1.5 text-left">
                        <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight leading-snug group-hover:text-slate-950 transition-colors">
                          {step.title}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed font-normal min-h-[44px]">
                          {step.desc}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Highlight Action Box */}
                    <Link
                      to="/complaint"
                      className={`w-full ${step.tagBg} border rounded-xl p-2.5 sm:p-3 flex items-center justify-between transition-all duration-300 hover:scale-[1.02] shadow-2xs group/tag cursor-pointer mt-4 relative z-10`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg bg-white shadow-2xs ${step.tagIconColor}`}>
                          <TagIcon size={15} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs sm:text-[13px] font-black text-slate-900 leading-snug">
                            {step.tagTitle}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {step.tagSubtitle}
                          </p>
                        </div>
                      </div>

                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${step.arrowBg} flex items-center justify-center transition-all duration-300 shadow-2xs shrink-0`}>
                        <ArrowRight size={14} className="group-hover/tag:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Area: Left Signature in Circle area, Center CTA, Right Building Sketch in Box area */}
          <div className="relative pt-4 pb-1 min-h-[110px] flex items-center justify-center">

            {/* Left: Signature Watermark (in the circle area below Card 1) */}
            <div className="hidden lg:flex flex-col items-start absolute left-0 sm:left-2 bottom-1 select-none pointer-events-none z-10 opacity-95">
              <p className="font-serif italic text-slate-700 text-xl font-black leading-tight tracking-wide" style={{ fontFamily: "'Caveat', 'Segoe Script', cursive, serif" }}>
                Together<br />
                <span className="text-base font-extrabold text-slate-600">for a better campus</span>
              </p>
              <div className="w-28 h-1 bg-[#DC2626] rounded-full -rotate-2 mt-1 ml-0.5 shadow-2xs" />
            </div>

            {/* Center: CTA Button */}
            <div className="flex flex-col items-center justify-center space-y-2.5 relative z-20">
              <Link
                to="/complaint"
                className="inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm px-7 py-3 rounded-full shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-300 group"
              >
                <Send size={15} className="text-white -rotate-12 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <span>Submit a Complaint Now</span>
                <ArrowRight size={15} className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </Link>

              <div className="flex items-center justify-center gap-2.5 text-[11px] sm:text-xs text-slate-400 font-medium">
                <span className="w-10 h-px bg-slate-200"></span>
                <span>A better campus starts with your voice.</span>
                <span className="w-10 h-px bg-slate-200"></span>
              </div>
            </div>

            {/* Right: Building Sketch (in the right box area below Card 3) */}
            <div className="hidden md:block absolute right-0 sm:right-1 -bottom-3 w-[290px] sm:w-[340px] pointer-events-none select-none z-10 opacity-95 mix-blend-multiply filter contrast-125 brightness-90">
              <img src={campusIllustration} alt="Campus Building Sketch" className="w-full object-contain object-bottom" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area (Subsequent Sections) */}
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-16 flex-1 w-full">

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
