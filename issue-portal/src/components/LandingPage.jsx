/**
 * LandingPage.jsx — Premium Hero & Landing Page with Glassmorphism, Floating Particles & Mesh Gradients
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import campusBg from '../assets/campus_bg.png';
import campusIllustration from '../assets/campus_illustration.png';
import { getSystemConfig, fetchSystemConfigFromServer, applyThemeTokens } from '../systemConfigStore.js';
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (systemConfig?.theme) {
      applyThemeTokens(systemConfig.theme);
    }
  }, [systemConfig]);

  useEffect(() => {
    document.title = 'MCC FIX HUB — Campus Facilities';

    fetchSystemConfigFromServer().then(cfg => {
      if (cfg) setSystemConfig(cfg);
    });

    const handleStorage = (e) => {
      if (!e.key || e.key === 'mcc_system_config') {
        setSystemConfig(getSystemConfig());
      }
    };
    window.addEventListener('storage', handleStorage);

    let channel;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('mcc_config_sync_channel');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'CONFIG_UPDATED' && e.data.config) {
          setSystemConfig(e.data.config);
        }
      };
    }

    // Fast 2s polling to ensure instant synchronization across portals
    const pollTimer = setInterval(() => {
      fetchSystemConfigFromServer().then(cfg => {
        if (cfg) setSystemConfig(cfg);
      });
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (channel) channel.close();
      clearInterval(pollTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col selection:bg-[#800000] selection:text-white">

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
          ? 'bg-[#800000] text-white border-[#9A1B2F]'
          : systemConfig.announcement.type === 'warning'
            ? 'bg-[#800000] text-white border-[#9A1B2F]'
            : 'bg-[#800000] text-white border-[#9A1B2F]'
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
        <div className={`px-6 py-2.5 text-xs font-bold flex items-center border-b ${systemConfig.portalNotice.type === 'alert'
          ? 'bg-[#F4E8EA] text-[#800000] border-[#E5E5E5]'
          : systemConfig.portalNotice.type === 'warning'
            ? 'bg-[#F4E8EA] text-[#800000] border-[#E5E5E5]'
            : 'bg-[#F4E8EA] text-[#800000] border-[#E5E5E5]'
          }`}>
          <div className="max-w-6xl mx-auto w-full flex items-center gap-2">
            <Megaphone size={14} className="shrink-0" />
            <span className="uppercase text-[10px] font-black tracking-wider px-1.5 py-0.5 bg-black/10 rounded">Portal Notice</span>
            <span>{systemConfig.portalNotice.message}</span>
          </div>
        </div>
      )}

      {/* Hero Banner matched to reference image */}
      <div className="relative overflow-hidden py-16 md:py-24 border-b border-[#1A1A1A] min-h-[580px] flex items-center bg-[#111111]">

        {/* Dynamic Campus Background Image */}
        <img
          src={
            (isMobile && systemConfig.homePage?.hero?.mobileBackgroundImage)
              ? systemConfig.homePage.hero.mobileBackgroundImage
              : (systemConfig.homePage?.hero?.desktopBackgroundImage || systemConfig.homePage?.hero?.backgroundImage || campusBg)
          }
          alt="MCC Campus Background"
          className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-500"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = campusBg;
          }}
        />

        {/* Left Horizontal Dark Gradient Vignette for Text Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 via-40% to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-10">

          {/* Left Column: Typography, Badges & Action Buttons */}
          <div className="flex-1 space-y-6 text-left max-w-xl">

            {/* Main Heading & Subtitle */}
            <div className="space-y-2">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight text-white drop-shadow-md">
                {systemConfig.homePage?.hero?.titleLine1 || 'Campus'} <br />
                <span
                  className="font-black inline-block transition-colors duration-300"
                  style={{ color: systemConfig.homePage?.hero?.highlightColor || systemConfig.theme?.primaryColor || '#800000' }}
                >
                  {systemConfig.homePage?.hero?.titleLine2 || 'Maintenance'}
                </span>
              </h1>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-wide drop-shadow-sm pt-1">
                {systemConfig.homePage?.hero?.tagline || 'Report. Track. Resolve.'}
              </p>
            </div>

            {/* Description Text */}
            <div className="space-y-1.5 text-[#E5E5E5] text-sm md:text-base leading-relaxed font-normal">
              <p>
                {systemConfig.homePage?.hero?.description1 || 'Report maintenance issues across classrooms, labs, hostels, water coolers, and campus infrastructure.'}
              </p>
              {systemConfig.homePage?.hero?.description2 && (
                <p>
                  {systemConfig.homePage?.hero?.description2}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: 4 Clean Institutional Light KPI Cards (MCC IGH Style) */}
          <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-[380px]">
            {(systemConfig.homePage?.statistics?.cards || [
              { value: '100+', label: 'Issues Resolved', desc: 'Successfully resolved maintenance requests' },
              { value: '24h', label: 'Response SLA', desc: 'Average target response time' },
              { value: '14+', label: 'Departments', desc: 'Working together for a better campus' },
              { value: '100%', label: 'Tracked & Logged', desc: 'Every request is tracked transparently' },
            ]).filter(c => c.visible !== false).map((card, idx) => {
              const icons = [CheckCircle2, Clock, Users, BarChart2];
              const Icon = icons[idx % icons.length];

              return (
                <div
                  key={card.id || card.label || idx}
                  className="bg-white/95 backdrop-blur-md border border-white/90 rounded-2xl p-5 text-center shadow-xl hover:bg-white hover:scale-[1.03] transition-all duration-300 flex flex-col items-center justify-center"
                >
                  <div className="mb-2 p-2 rounded-xl bg-[#F5E6E6] border border-[#EBD0D0] text-[#800000]">
                    <Icon size={20} className="text-[#800000]" />
                  </div>
                  <p className="text-3xl sm:text-4xl font-black text-[#111111] tracking-tight">{card.value}</p>
                  <p className="text-xs font-extrabold text-[#111111] mt-1">{card.label}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">{card.desc || card.description}</p>
                </div>
              );
            })}
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
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#800000] bg-[#F4E8EA] border border-[#E5E5E5] px-3 py-1 rounded-full shadow-xs">
              <Sparkles size={11} className="text-[#800000]" />
              <span className="tracking-wider uppercase font-extrabold">TRANSPARENT CAMPUS WORKFLOW</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-[32px] font-black text-[#171717] tracking-tight leading-tight">
              How Complaints <span className="text-[#800000]">Get Solved</span>
            </h2>

            <p className="text-xs sm:text-sm text-[#6B6B6B] font-medium max-w-md mx-auto">
              Clear 3-stage process from ticket submission to full resolution.
            </p>

            {/* Slider Dot Indicator */}
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              <span className="w-6 h-0.5 bg-[#E5E5E5] rounded-full" />
              <span className="w-2 h-2 bg-[#800000] rounded-full shadow-xs" />
              <span className="w-6 h-0.5 bg-[#E5E5E5] rounded-full" />
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
                    className="relative overflow-hidden bg-white rounded-[26px] border border-[#E5E5E5] shadow-md hover:shadow-xl hover:border-[#800000]/40 hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between group p-5 sm:p-5.5 flex-1"
                  >
                    {/* Top Curved Accent Cap */}
                    <div className="absolute top-0 inset-x-0 h-1.5 rounded-t-[26px] bg-[#800000]" />

                    {/* Top Subtle Gradient Wash */}
                    <div className="absolute top-1.5 inset-x-0 h-24 bg-gradient-to-b from-[#F4E8EA]/60 to-transparent pointer-events-none" />

                    {/* Card Content Top */}
                    <div className="pt-1 relative z-10">
                      {/* Header: Step Pill & Circular 3D Icon with Floating Specks */}
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center text-[10px] font-extrabold px-3 py-1 rounded-full text-white bg-[#800000] shadow-xs tracking-wider uppercase">
                          {step.badge}
                        </span>

                        {/* 3D Styled Step Icon Badge */}
                        <div className="relative">
                          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#F4E8EA] border border-[#E5E5E5] flex items-center justify-center relative shadow-xs group-hover:scale-110 transition-transform duration-300">
                            {step.iconType === 'clipboard' && <ClipboardList size={24} className="text-[#800000]" />}
                            {step.iconType === 'ticket' && (
                              <div className="px-2 py-0.5 rounded-md bg-white border border-[#800000] text-[#800000] shadow-2xs flex items-center justify-center">
                                <span className="text-[11px] font-black tracking-tight font-mono">#003</span>
                              </div>
                            )}
                            {step.iconType === 'wrench' && <Wrench size={24} className="text-[#800000]" />}
                          </div>
                        </div>
                      </div>

                      {/* Step Title & Description */}
                      <div className="mt-4 space-y-1.5 text-left">
                        <h3 className="font-black text-[#171717] text-base sm:text-lg tracking-tight leading-snug group-hover:text-[#800000] transition-colors">
                          {step.title}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-[#6B6B6B] leading-relaxed font-normal min-h-[44px]">
                          {step.desc}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Highlight Action Box */}
                    <Link
                      to="/complaint"
                      className="w-full bg-[#F7F7F7] border border-[#E5E5E5] hover:border-[#800000]/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between transition-all duration-300 hover:scale-[1.02] shadow-2xs group/tag cursor-pointer mt-4 relative z-10"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-white border border-[#E5E5E5] text-[#800000] shadow-2xs">
                          <TagIcon size={15} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs sm:text-[13px] font-black text-[#171717] leading-snug">
                            {step.tagTitle}
                          </p>
                          <p className="text-[10px] text-[#6B6B6B] font-medium">
                            {step.tagSubtitle}
                          </p>
                        </div>
                      </div>

                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#800000] text-white flex items-center justify-center transition-all duration-300 shadow-2xs shrink-0">
                        <ArrowRight size={14} className="group-hover/tag:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Area: Signature, Center CTA, Building Sketch */}
          <div className="relative pt-4 pb-1 min-h-[110px] flex items-center justify-center">

            {/* Left: Signature Watermark */}
            <div className="hidden lg:flex flex-col items-start absolute left-0 sm:left-2 bottom-1 select-none pointer-events-none z-10 opacity-95">
              <p className="font-serif italic text-[#171717] text-xl font-black leading-tight tracking-wide" style={{ fontFamily: "'Caveat', 'Segoe Script', cursive, serif" }}>
                Together<br />
                <span className="text-base font-extrabold text-[#6B6B6B]">for a better campus</span>
              </p>
              <div className="w-28 h-1 bg-[#800000] rounded-full -rotate-2 mt-1 ml-0.5 shadow-2xs" />
            </div>

            {/* Center: CTA Button */}
            <div className="flex flex-col items-center justify-center space-y-2.5 relative z-20">
              <Link
                to="/complaint"
                className="inline-flex items-center gap-2.5 bg-[#800000] hover:bg-[#9A1B2F] text-white font-black text-xs sm:text-sm px-7 py-3 rounded-full shadow-lg shadow-[#800000]/25 hover:shadow-[#800000]/40 hover:scale-105 active:scale-95 transition-all duration-300 group"
              >
                <Send size={15} className="text-white -rotate-12 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <span>Submit a Complaint Now</span>
                <ArrowRight size={15} className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </Link>

              <div className="flex items-center justify-center gap-2.5 text-[11px] sm:text-xs text-[#6B6B6B] font-medium">
                <span className="w-10 h-px bg-[#E5E5E5]"></span>
                <span>A better campus starts with your voice.</span>
                <span className="w-10 h-px bg-[#E5E5E5]"></span>
              </div>
            </div>

            {/* Right: Building Sketch */}
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
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm hover:shadow-md hover:border-[#800000]/40 transition">
            <div className="flex items-center gap-2.5">
              <PhoneCall size={20} className="text-[#800000] shrink-0" />
              <h4 className="font-extrabold text-[#171717] text-base sm:text-lg">
                {systemConfig.facilitiesContact?.title || 'Facilities Contact & Support'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#6B6B6B] leading-relaxed font-normal">
              {systemConfig.facilitiesContact?.description || 'If you have urgent inquiries regarding a previously submitted complaint, contact the campus facilities helpdesk.'}
            </p>
            <div className="space-y-1.5 text-xs sm:text-sm text-[#171717] font-medium pt-2">
              <p>
                <span className="font-bold text-[#171717]">Office:</span>{' '}
                {systemConfig.facilitiesContact?.office || 'Campus Maintenance Office, Ground Floor, Admin Block'}
              </p>
              <p>
                <span className="font-bold text-[#171717]">Email:</span>{' '}
                {systemConfig.facilitiesContact?.email || 'mcc-support@campus.edu'}
              </p>
              <p>
                <span className="font-bold text-[#171717]">Hours:</span>{' '}
                {systemConfig.facilitiesContact?.hours || 'Monday – Saturday (8:30 AM – 5:00 PM)'}
              </p>
            </div>
          </div>

          {/* Emergency Hazards Card */}
          <div className="bg-[#F4E8EA] border border-[#E5E5E5] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={20} className="text-[#800000] shrink-0" />
              <h4 className="font-extrabold text-[#800000] text-base sm:text-lg">
                {systemConfig.emergencyHazards?.title || 'Emergency Hazards'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#800000] leading-relaxed font-normal">
              {systemConfig.emergencyHazards?.description || 'For critical emergencies such as active electrical fires, major gas leaks, structural collapse, or severe flooding, please contact security immediately.'}
            </p>
            <div className="text-xs sm:text-sm pt-2">
              <p className="font-bold text-[#171717]">
                Emergency Helpline:{' '}
                <span className="font-extrabold text-[#800000] underline underline-offset-2">
                  {systemConfig.emergencyHazards?.helpline || '+91 0000-00000'}
                </span>
              </p>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="bg-[#171717] text-[#E5E5E5] border-t border-[#262626] py-6 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2 text-white font-bold">
            <ClipboardList size={16} className="text-[#800000]" />
            <span>MCC FIX HUB</span>
            <span className="text-[#6B6B6B] font-normal">— Campus Complaint System</span>
          </div>
          <p className="text-[#6B6B6B]">© 2026 Campus Facilities Dept. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
