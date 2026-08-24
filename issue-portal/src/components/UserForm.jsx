/**
 * UserForm.jsx — Dedicated Complaint Submission Form (route "/complaint")
 *
 * Provides a clean, standalone complaint form for students, staff, and campus units.
 * Features:
 *  • Integrated shared Navbar (with link to Home and Admin)
 *  • Personal Information fields
 *  • Role & Classification (Student stream/level, Staff, Unit)
 *  • Location details (Block & Room Number)
 *  • Issue details (Category quick-picks, Priority levels, Description)
 *  • Photo upload with preview
 *  • Instant Ticket ID (#001) confirmation modal/screen
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { createTicket } from '../ticketsStore.js';
import { getSystemConfig, fetchSystemConfigFromServer } from '../systemConfigStore.js';
import {
  ClipboardList, Upload, CheckCircle, ArrowRight, Phone,
  User, Mail, Building2, Layers, FileText, Camera,
  ChevronDown, LayoutDashboard, X, AlertCircle, Hash,
  Clock, Wrench, Info, MapPin, GraduationCap, BadgeCheck,
  SendHorizonal, PhoneCall, HelpCircle, ChevronRight,
  CalendarDays, Shield, ArrowLeft, Droplets, Megaphone, Lock,
  Zap, Monitor, Trash2, Accessibility, MoreHorizontal, CloudRain,
  Plus, Sparkles, Check, Home
} from 'lucide-react';

export const AIDED_UG_DEPARTMENTS = [
  'B. A. English Language and Literature',
  'B. A. Tamil Literature',
  'B. A. History',
  'B. A. Political Science',
  'B. A. Economics',
  'B. A. Philosophy',
  'B. Com. – Commerce',
  'B. Sc. Mathematics',
  'B. Sc. Statistics',
  'B. Sc. Physics',
  'B. Sc. Chemistry',
  'B. Sc. Plant Biology and Plant Biotechnology',
  'B. Sc. Zoology',
];

export const AIDED_PG_DEPARTMENTS = [
  'M. A. English Language and Literature',
  'M. A. Tamil Literature',
  'M. A. History',
  'M. A. Political Science',
  'M. A. Public Administration',
  'M. A. Economics',
  'M. A. Philosophy',
  'M. Com. – Commerce',
  'M. S. W. (Community Development & Medical Psychiatry)',
  'M. Sc. Mathematics',
  'M. Sc. Statistics',
  'M. Sc. Physics',
  'M. Sc. Chemistry',
  'M. Sc. Plant Biology and Plant Biotechnology',
  'M. Sc. Zoology',
];

export const SFS_UG_DEPARTMENTS = [
  'B. A. English Language and Literature',
  'B. A. Journalism',
  'B. A. History (Vocational)– (Archeology and Museology) – (Shift I)',
  'B. S. W. Social Work',
  'B. Com. – Commerce',
  'B. Com. Accounting and Finance',
  'B. Com. Professional Accounting',
  'B. B. A. Business Administration',
  'B. Sc. Geography, Tourism and Travel Management',
  'B. Sc. Hospitality and Tourism',
  'B. Sc. Mathematics',
  'B. Sc. Physics',
  'B. Sc. Microbiology',
  'B. C. A. Computer Application',
  'B. Sc. Computer Science',
  'B. Sc. Visual Communication',
  'B. Sc. Physical Education, Health Education and Sports',
  'B. Sc. Psychology',
];

export const SFS_PG_DEPARTMENTS = [
  'M. S. W. Social Work (Human Resource Management)',
  'M. Com. Computer-Oriented Business Application',
  'M. A. Communication',
  'M. Sc. Chemistry',
  'M. Sc. Applied Microbiology',
  'M. C. A. Computer Application',
  'M. Sc. Data Science',
];

const DEPARTMENTS = [
  'Computer Science', 'Electronics & Communication', 'Mechanical Engineering',
  'Civil Engineering', 'Electrical Engineering', 'Commerce', 'Management Studies',
  'Sciences', 'Humanities', 'Administration', 'Library', 'Sports Department',
  'Principal Office', 'Other',
];

const BLOCKS = [
  'Block A', 'Block B', 'Block C', 'Block D', 'Main Building',
  'Science Block', 'Admin Block', 'Library Block', 'Sports Complex',
  'Hostel Block', 'Canteen', 'Parking Area', 'Other',
];

const ISSUE_CATEGORIES = [
  { label: 'Electrical', prefix: 'Electrical issue: ', color: 'amber' },
  { label: 'Plumbing', prefix: 'Plumbing issue: ', color: 'cyan' },
  { label: 'IT / Network', prefix: 'IT/Network issue: ', color: 'indigo' },
  { label: 'Civil / Infra', prefix: 'Civil/Infrastructure issue: ', color: 'orange' },
  { label: 'Sanitation', prefix: 'Sanitation issue: ', color: 'emerald' },
  { label: 'Accessibility', prefix: 'Accessibility issue: ', color: 'sky' },
  { label: 'Others', prefix: 'Other issue: ', color: 'rose' },
];

const OTHER_SUB_CATEGORIES = [
  {
    id: 'sub-water-cooler',
    label: 'Drinking Water Cooler Leak',
    text: 'Drinking Water Leakage: Water cooler / purifier unit is leaking water.',
    emoji: '💧',
  },
  {
    id: 'sub-restroom-tap',
    label: 'Restroom Tap / Flush Leak',
    text: 'Restroom Water Leakage: Tap, washbasin, or flush valve leaking continuously.',
    emoji: '🚰',
  },
  {
    id: 'sub-pipe-seepage',
    label: 'Pipe / Ceiling Water Seepage',
    text: 'Water Seepage Leakage: Water leaking from overhead tank, pipe junction, or ceiling.',
    emoji: '🌧️',
  },
  {
    id: 'sub-general-maint',
    label: 'General Maintenance',
    text: 'General Maintenance: ',
    emoji: '🔧',
  },
];

function CategoryIcon({ label, id }) {
  const clean = ((label || '') + ' ' + (id || '')).toLowerCase();
  if (clean.includes('cat1') || clean.includes('electric') || clean.includes('power') || clean.includes('light')) {
    return (
      <span className="inline-flex items-center justify-center text-[15px] transition-transform duration-200 group-hover:scale-125 group-hover:-rotate-12 select-none shrink-0">
        💡
      </span>
    );
  }
  if (clean.includes('cat2') || clean.includes('plumb') || clean.includes('water') || clean.includes('pipe') || clean.includes('tap')) {
    return (
      <span className="inline-flex items-center justify-center text-[15px] transition-transform duration-200 group-hover:scale-125 group-hover:rotate-6 select-none shrink-0">
        🚰
      </span>
    );
  }
  if (clean.includes('cat3') || clean.includes('it') || clean.includes('net') || clean.includes('wifi') || clean.includes('computer')) {
    return (
      <span className="inline-flex items-center justify-center text-[15px] transition-transform duration-200 group-hover:scale-125 group-hover:-rotate-6 select-none shrink-0">
        🖥️
      </span>
    );
  }
  if (clean.includes('cat4') || clean.includes('civil') || clean.includes('infra') || clean.includes('build') || clean.includes('window') || clean.includes('door')) {
    return (
      <span className="inline-flex items-center justify-center text-[15px] transition-transform duration-200 group-hover:scale-125 group-hover:rotate-12 select-none shrink-0">
        🪟
      </span>
    );
  }
  if (clean.includes('cat5') || clean.includes('sanit') || clean.includes('clean') || clean.includes('wash') || clean.includes('waste') || clean.includes('trash') || clean.includes('sweep') || clean.includes('broom')) {
    return (
      <span className="inline-flex items-center justify-center text-[15px] transition-transform duration-200 group-hover:scale-125 group-hover:-rotate-12 select-none shrink-0">
        🧹
      </span>
    );
  }
  if (clean.includes('cat6') || clean.includes('access') || clean.includes('ramp') || clean.includes('lift') || clean.includes('wheel') || clean.includes('handicap') || clean.includes('disabled')) {
    return (
      <span className="inline-flex items-center justify-center text-[15px] transition-transform duration-200 group-hover:scale-125 group-hover:rotate-6 select-none shrink-0">
        ♿
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-[15px] transition-transform duration-200 group-hover:scale-125 group-hover:rotate-12 select-none shrink-0">
      📌
    </span>
  );
}

function getCleanCategoryLabel(label) {
  if (!label) return '';
  // Strip leading question marks, broken unicode chars, emojis, or spaces
  const cleaned = label.replace(/^[\?\s\uFFFD\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\uFE0F\u{1F300}-\u{1FAFF}]+/gu, '').trim();
  return cleaned || label;
}
/**
 * Abstract3DSaasBackdrop — Premium Abstract 3D SaaS Environment (Linear / Stripe / Raycast)
 * 
 * Visibly designed 3D abstract geometric elements:
 * • Base light cool-gray canvas (#F6F8FC)
 * • 1. Top-Left: Large Translucent Blue Rounded Capsule / Tile (rich blue gradient, glass border, drop shadow)
 * • 2. Top-Right: Large Translucent Indigo Curved Glass Tile (rich indigo gradient, glass border, drop shadow)
 * • 3. Left-Edge: Floating Translucent Pill Shape (sky-blue to indigo glass)
 * • 4. Right-Edge: Partial Cyan / Blue Geometric Rounded Shape
 * • 5. Bottom: Soft Overlapping Horizon Pill Arc creating depth
 * • Soft ambient radial depth underlay
 */
function Abstract3DSaasBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* ── 1. Base Canvas ── */}
      <div className="absolute inset-0 bg-[#F7F7F7]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_10%,#FFFFFF_0%,#F7F7F7_60%,#F4E8EA_100%)]" />
    </div>
  );
}

function SelectField({ label, id, value, onChange, options, placeholder, error }) {
  return (
    <div>
      <label htmlFor={id} className="input-label flex items-center gap-1 font-bold text-[#171717]">
        <span>{label}</span>
        <span className="text-red-500 font-extrabold ml-0.5">*</span>
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          className={`input-field appearance-none pr-8 cursor-pointer ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map(opt =>
            typeof opt === 'string'
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          )}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}

function InputField({ label, id, type = 'text', value, onChange, placeholder, required, error }) {
  return (
    <div>
      <label htmlFor={id} className="input-label flex items-center gap-1 font-bold text-[#171717]">
        <span>{label}</span>
        {required && <span className="text-red-500 font-extrabold ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`input-field ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}

export default function UserForm() {
  const [systemConfig, setSystemConfig] = useState(() => getSystemConfig());

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'MCC Issue Portal — Campus Facilities';
    fetchSystemConfigFromServer().then(cfg => {
      if (cfg) setSystemConfig(cfg);
    });
    const handleStorage = (e) => {
      if (e.key === 'mcc_system_config') {
        setSystemConfig(getSystemConfig());
      }
    };
    window.addEventListener('storage', handleStorage);
    // Poll every 3s so UserForm stays in real-time sync with Super Admin changes
    const pollTimer = setInterval(() => {
      fetchSystemConfigFromServer().then(cfg => {
        if (cfg) setSystemConfig(cfg);
      });
    }, 3000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollTimer);
    };
  }, []);

  const dynamicCategories = useMemo(() => {
    return (systemConfig.categories || ISSUE_CATEGORIES).filter(c => c.active !== false);
  }, [systemConfig]);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', department: '', userType: '',
    studentStream: '', studentLevel: '', block: '', roomNo: '',
    issueCategory: '', description: '', priority: 'Normal',
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);
  const fileInputRef = useRef(null);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: 'File must be under 5MB.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhoto(ev.target.result);
      setPhotoPreview(ev.target.result);
      setErrors(prev => ({ ...prev, photo: null }));
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.';
    if (!form.department) errs.department = 'Select a department.';
    if (!form.userType) errs.userType = 'Select a user type.';
    if (form.userType === 'Student') {
      if (!form.studentStream) errs.studentStream = 'Select stream.';
      if (!form.studentLevel) errs.studentLevel = 'Select level.';
    }
    if (!form.block) errs.block = 'Select a block/building.';
    if (!form.description.trim()) errs.description = 'Describe the issue.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));
    const ticket = await createTicket({ ...form, photo });
    setCreatedTicket(ticket);
    setSubmitted(true);
    setSubmitting(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewTicket = () => {
    setForm({
      name: '', email: '', phone: '', department: '', userType: '',
      studentStream: '', studentLevel: '', block: '', roomNo: '',
      issueCategory: '', description: '', priority: 'Normal',
    });
    setPhoto(null); setPhotoPreview(null);
    setErrors({}); setSubmitted(false); setCreatedTicket(null);
  };

  // ─────────────────────────────────────────────────────────────
  // CONFIRMATION SCREEN
  // ─────────────────────────────────────────────────────────────
  if (submitted && createdTicket) {
    const dateObj = createdTicket.createdAt ? new Date(createdTicket.createdAt) : new Date();
    const submittedAt = isNaN(dateObj.getTime())
      ? new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
      : dateObj.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
    return (
      <div className="min-h-screen flex flex-col relative selection:bg-blue-500 selection:text-white saas-3d-bg">
        <Abstract3DSaasBackdrop />

        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar />

          <div className="flex-1 flex items-center justify-center p-6 py-12">
            <div className="animate-scale-in w-full max-w-lg">
              <div className="bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12),0_10px_30px_-5px_rgba(37,99,235,0.08),0_0_0_1px_rgba(226,232,240,0.9)] border border-slate-200/90 overflow-hidden ring-1 ring-blue-500/10">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-center text-white">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={34} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-extrabold tracking-tight">Ticket Submitted!</h1>
                  <p className="text-emerald-100 text-sm mt-1">Your complaint has been logged in the system.</p>
                </div>

                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between bg-[#F4E8EA] border border-[#E5E5E5] rounded-2xl px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-[#800000] uppercase tracking-widest">Assigned Ticket Number</p>
                      <p className="text-3xl font-extrabold text-[#800000] tracking-tight mt-0.5">{createdTicket.ticketNo}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E5E5] flex items-center justify-center">
                      <Hash size={22} className="text-[#800000]" />
                    </div>
                  </div>

                  <div className="space-y-0 divide-y divide-[#E5E5E5] rounded-2xl border border-[#E5E5E5] overflow-hidden text-xs">
                    {[
                      { icon: User, label: 'Name', value: createdTicket.name },
                      { icon: Mail, label: 'Email', value: createdTicket.email },
                      { icon: Building2, label: 'Department', value: createdTicket.department },
                      {
                        icon: GraduationCap, label: 'User Type', value:
                          createdTicket.userType +
                          (createdTicket.studentStream ? ` · ${createdTicket.studentStream}` : '') +
                          (createdTicket.studentLevel ? ` · ${createdTicket.studentLevel}` : '')
                      },
                      {
                        icon: MapPin, label: 'Location', value:
                          createdTicket.block + (createdTicket.roomNo ? ` · Room ${createdTicket.roomNo}` : '')
                      },
                      { icon: CalendarDays, label: 'Submitted', value: submittedAt },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white">
                        <Icon size={14} className="text-[#6B6B6B] shrink-0" />
                        <span className="text-[#6B6B6B] w-24 shrink-0 font-medium">{label}</span>
                        <span className="font-semibold text-[#171717] truncate">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleNewTicket}
                      className="flex-1 bg-[#800000] hover:bg-[#9A1B2F] text-white font-semibold rounded-xl py-3 transition flex items-center justify-center gap-2 text-sm shadow"
                    >
                      <SendHorizonal size={15} /> File Another Issue
                    </button>
                    <Link
                      to="/"
                      className="px-4 py-3 rounded-xl border border-[#E5E5E5] text-[#171717] hover:bg-[#F7F7F7] text-sm font-medium transition flex items-center gap-1.5"
                    >
                      <ArrowLeft size={15} /> Home
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PORTAL CLOSED GATE (Super Admin: portalActive = false)
  // ─────────────────────────────────────────────────────────────
  if (systemConfig.portalActive === false) {
    return (
      <div className="min-h-screen flex flex-col relative selection:bg-blue-500 selection:text-white saas-3d-bg">
        <Abstract3DSaasBackdrop />

        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto">
                <Lock size={36} className="text-slate-400" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {systemConfig.userPortal?.closedNotice?.title || 'Portal Temporarily Closed'}
                </h1>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  {systemConfig.userPortal?.closedNotice?.message || 'The MCC Issue Portal is currently offline for maintenance or scheduled downtime. Please check back shortly or contact the Facilities Office directly.'}
                </p>
              </div>
              {systemConfig.portalNotice?.enabled && systemConfig.portalNotice?.message && (
                <div className={`text-xs font-semibold px-4 py-3 rounded-xl border text-left ${systemConfig.portalNotice.type === 'alert' ? 'bg-red-50 text-red-800 border-red-200'
                  : systemConfig.portalNotice.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}>
                  <Megaphone size={13} className="inline mr-1.5" />
                  {systemConfig.portalNotice.message}
                </div>
              )}
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow"
              >
                <ArrowLeft size={15} /> Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // COMPLAINT FORM PAGE
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative selection:bg-[#800000] selection:text-white bg-[#F7F7F7]">
      <Abstract3DSaasBackdrop />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* Page Header */}
        <div className="bg-white border-b border-[#E5E5E5] px-6 py-7 shadow-xs">
          <div className="max-w-4xl mx-auto space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold mb-2">
              <Link
                to="/"
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#800000]/30 text-[#800000] hover:border-[#800000]/60 hover:bg-[#F4E8EA] transition-all duration-150 shadow-2xs font-medium"
              >
                <Home size={13} className="text-[#800000]" />
                <span>Home</span>
              </Link>

              <span className="text-[#9E9E9E] font-medium text-xs px-0.5 select-none">/</span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4E8EA] border border-[#800000]/30 text-[#800000] font-bold shadow-2xs">
                <FileText size={13} className="text-[#800000]" />
                <span>Complaint Form</span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#171717] tracking-tight">
                Submit Maintenance Complaint
              </h1>
              <p className="text-xs text-[#6B6B6B] font-medium mt-1">
                Fill out the form below to report campus infrastructure or facility issues.
              </p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(23,23,23,0.08),0_0_0_1px_rgba(229,229,229,0.9)] border border-[#E5E5E5] overflow-hidden ring-1 ring-[#800000]/10 animate-slide-up"
          >
            {/* Top Accent Line */}
            <div className="h-1.5 w-full bg-[#800000]" />

            <div className="p-6 md:p-10 space-y-10">

              {/* ── Section 1: Personal Info ────────────────────── */}
              <section className="space-y-4">
                <div className="border-b border-[#E5E5E5] pb-3">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#800000]">Personal Information</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField
                    label="Full Name" id="name" value={form.name}
                    onChange={handleChange('name')} placeholder="e.g. Arjun Nair"
                    required error={errors.name}
                  />
                  <InputField
                    label="Email Address" id="email" type="email" value={form.email}
                    onChange={handleChange('email')} placeholder="you@college.edu"
                    required error={errors.email}
                  />
                  <InputField
                    label="Phone Number" id="phone" type="tel" value={form.phone}
                    onChange={handleChange('phone')} placeholder="+91 9876543210"
                    error={errors.phone}
                  />
                </div>
              </section>

              {/* ── Section 2: Role & Classification ────────────── */}
              <section className="space-y-4">
                <div className="border-b border-[#E5E5E5] pb-3">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#800000]">Role & Classification</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SelectField
                    label="User Type" id="userType" value={form.userType}
                    onChange={handleChange('userType')}
                    options={[
                      { value: 'Student', label: 'Student' },
                      { value: 'Staff', label: 'Staff' },
                      { value: 'Unit', label: 'Unit / Office' },
                    ]}
                    placeholder="Select user type" error={errors.userType}
                  />

                  {form.userType === 'Student' && (
                    <>
                      <div className="animate-fade-in">
                        <SelectField
                          label="Stream" id="studentStream" value={form.studentStream}
                          onChange={handleChange('studentStream')}
                          options={[
                            { value: 'Aided', label: 'Aided' },
                            { value: 'SFS', label: 'SFS (Self-Financing)' },
                          ]}
                          placeholder="Select stream" error={errors.studentStream}
                        />
                      </div>
                      <div className="animate-fade-in">
                        <SelectField
                          label="Level" id="studentLevel" value={form.studentLevel}
                          onChange={handleChange('studentLevel')}
                          options={[
                            { value: 'UG', label: 'UG (Undergraduate)' },
                            { value: 'PG', label: 'PG (Postgraduate)' },
                          ]}
                          placeholder="Select level" error={errors.studentLevel}
                        />
                      </div>
                    </>
                  )}

                  <SelectField
                    label="Department" id="department" value={form.department}
                    onChange={handleChange('department')}
                    options={
                      form.userType === 'Student' && form.studentStream === 'Aided' && form.studentLevel === 'UG'
                        ? AIDED_UG_DEPARTMENTS
                        : form.userType === 'Student' && form.studentStream === 'Aided' && form.studentLevel === 'PG'
                          ? AIDED_PG_DEPARTMENTS
                          : form.userType === 'Student' && form.studentStream === 'SFS' && form.studentLevel === 'UG'
                            ? SFS_UG_DEPARTMENTS
                            : form.userType === 'Student' && form.studentStream === 'SFS' && form.studentLevel === 'PG'
                              ? SFS_PG_DEPARTMENTS
                              : DEPARTMENTS
                    }
                    placeholder="Select department" error={errors.department}
                  />
                </div>
              </section>

              {/* ── Section 3: Location Details ─────────────────── */}
              <section className="space-y-4">
                <div className="border-b border-[#E5E5E5] pb-3">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#800000]">Location Details</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SelectField
                    label="Block / Building" id="block" value={form.block}
                    onChange={handleChange('block')} options={BLOCKS}
                    placeholder="Select block" error={errors.block}
                  />
                  <InputField
                    label="Room / Area No." id="roomNo" value={form.roomNo}
                    onChange={handleChange('roomNo')} placeholder="e.g. Room 204, Lab 3, Restroom 2nd floor"
                    error={errors.roomNo}
                  />
                </div>
              </section>

              {/* ── Section 4: Issue Description & Photo ───────── */}
              <section className="space-y-5">
                <div className="border-b border-[#E5E5E5] pb-3">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#800000]">Issue Details</h2>
                </div>

                <div className="space-y-5">
                  {/* Category chips */}
                  <div>
                    <label className="input-label flex items-center gap-1.5 font-bold text-[#800000] mb-2.5">
                      <span className="tracking-wide">ISSUE CATEGORY</span>
                      <span className="text-red-500 font-extrabold ml-0.5">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {dynamicCategories.map((cat) => {
                        const cleanLabel = getCleanCategoryLabel(cat.label);
                        const isSelected = form.issueCategory === cat.label || form.issueCategory === cleanLabel;
                        const prefix = cat.prefix || `${cleanLabel} issue: `;

                        return (
                          <button
                            key={cat.id || cat.label}
                            type="button"
                            onClick={() => {
                              setForm(prev => ({
                                ...prev,
                                issueCategory: cleanLabel,
                                description: prev.description.startsWith(prefix)
                                  ? prev.description
                                  : prefix + prev.description.replace(/^[^:]+: /, ''),
                              }));
                            }}
                            className={`group text-xs px-4 py-2 rounded-full border font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center select-none ${isSelected
                              ? 'bg-[#800000] text-white border-[#800000] shadow-md shadow-[#800000]/20 scale-[1.03]'
                              : 'bg-white text-[#171717] border-[#D9D9D9] shadow-2xs hover:border-[#800000] hover:bg-[#F6E8EA] hover:text-[#800000] hover:-translate-y-0.5 hover:shadow-xs active:scale-95'
                              }`}
                          >
                            <span>{cleanLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sub-picks for Others */}
                  {(form.issueCategory.includes('Others') || form.issueCategory.includes('Other') || form.issueCategory.includes('📌')) && (
                    <div className="p-4 sm:p-5 bg-[#F6E8EA] border border-[#D9D9D9] rounded-2xl animate-slide-up space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold text-[#800000] uppercase tracking-wider flex items-center gap-1.5">
                          <span>QUICK SUB-CATEGORIES (E.G., WATER LEAKAGE):</span>
                        </p>
                        <span className="text-[10px] font-bold text-[#800000] bg-white border border-[#D9D9D9] px-2 py-0.5 rounded-full">1-Click Autofill</span>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        {OTHER_SUB_CATEGORIES.map(sub => {
                          const isSubSelected = form.description.startsWith(sub.text.split(':')[0]);
                          return (
                            <button
                              key={sub.id || sub.label}
                              type="button"
                              onClick={() => {
                                setForm(prev => ({
                                  ...prev,
                                  description: sub.text,
                                }));
                              }}
                              className={`group text-xs px-4 py-2 rounded-full border font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${isSubSelected
                                ? 'bg-[#800000] text-white border-[#800000] shadow-md shadow-[#800000]/20 scale-[1.03]'
                                : 'bg-white text-[#171717] border-[#D9D9D9] shadow-2xs hover:border-[#800000] hover:bg-white hover:text-[#800000] hover:-translate-y-0.5 hover:shadow-xs active:scale-95'
                                }`}
                            >
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Priority Segmented Control */}
                  <div>
                    <label className="input-label flex items-center gap-1.5 font-bold text-[#800000] mb-2.5">
                      <span className="tracking-wide">PRIORITY LEVEL</span>
                      <span className="text-red-500 font-extrabold ml-0.5">*</span>
                    </label>
                    <div className="bg-white border border-[#D9D9D9] rounded-2xl p-1.5 flex items-center justify-between gap-2 shadow-2xs">
                      {[
                        {
                          level: 'Normal',
                          dotGradient: 'bg-[#159447]',
                          activeClasses: 'bg-[#F6E8EA] border-[#800000] text-[#800000] shadow-xs ring-1 ring-[#800000]/20',
                        },
                        {
                          level: 'High',
                          dotGradient: 'bg-amber-500',
                          activeClasses: 'bg-[#FFFBEB] border-amber-500 text-amber-800 shadow-xs ring-1 ring-amber-500/20',
                        },
                        {
                          level: 'Critical',
                          dotGradient: 'bg-red-600',
                          activeClasses: 'bg-[#FEF2F2] border-red-500 text-red-700 shadow-xs ring-1 ring-red-500/20',
                        },
                      ].map(({ level, dotGradient, activeClasses }) => {
                        const isActive = form.priority === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, priority: level }))}
                            className={`group flex-1 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl border text-[11px] sm:text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2.5 cursor-pointer select-none ${isActive
                              ? `${activeClasses} scale-[1.01]`
                              : 'border-transparent text-[#171717] hover:bg-[#F6E8EA] hover:text-[#800000] hover:shadow-2xs active:scale-98'
                              }`}
                          >
                            <div className="relative flex items-center justify-center">
                              <span className={`w-3.5 h-3.5 rounded-full ${dotGradient} shrink-0 transition-transform duration-300 group-hover:scale-120`} />
                              {isActive && level === 'Critical' && (
                                <span className="absolute w-3.5 h-3.5 rounded-full bg-red-400 opacity-75 animate-ping" />
                              )}
                            </div>
                            <span>{level}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Description Textarea */}
                  <div>
                    <label htmlFor="description" className="input-label flex items-center gap-1.5 font-bold text-[#800000]">
                      <span>DESCRIPTION</span>
                      <span className="text-red-500 font-extrabold ml-0.5">*</span>
                    </label>
                    <textarea
                      id="description"
                      rows={5}
                      value={form.description}
                      onChange={handleChange('description')}
                      placeholder="Describe the complaint in detail (what is broken, where, since when)..."
                      className={`w-full px-4 py-2.5 rounded-2xl border border-[#D9D9D9] bg-white text-sm text-[#171717] placeholder:text-[#777777] hover:bg-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#800000]/12 focus:border-[#800000] transition duration-200 resize-none shadow-xs ${errors.description ? 'border-red-400 focus:ring-red-400' : ''}`}
                    />
                    {errors.description && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.description}</p>}
                  </div>

                  {/* Photo Upload */}
                  <div>
                    <label className="input-label flex items-center gap-1.5 font-bold text-[#800000]">
                      <span>UPLOAD PHOTO</span>
                      <span className="text-[#777777] font-normal text-xs">(optional · max 5MB)</span>
                    </label>
                    {photoPreview ? (
                      <div className="relative group">
                        <img src={photoPreview} alt="Preview" className="h-48 w-full object-cover rounded-2xl border border-[#D9D9D9] shadow-md" />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute top-3 right-3 bg-white/90 backdrop-blur-md border border-[#D9D9D9] shadow-md text-[#171717] hover:text-red-600 rounded-full p-2 transition hover:scale-110"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-[#D9D9D9] hover:border-[#800000] bg-white hover:bg-[#F6E8EA] rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group space-y-2"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-[#F6E8EA] border border-[#D9D9D9] shadow-sm flex items-center justify-center mx-auto text-[#800000] group-hover:scale-110 transition-all">
                          <Upload size={22} className="text-[#800000]" />
                        </div>
                        <p className="text-xs font-bold text-[#171717] group-hover:text-[#800000] transition-colors">
                          Click or drag photo to upload
                        </p>
                        <p className="text-[11px] text-[#777777]">PNG, JPG, WEBP up to 5MB</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </section>

              {/* Form Info Box */}
              <div className="flex items-center gap-3 bg-[#F4E8EA] border border-[#E5E5E5] rounded-2xl p-4 text-xs text-[#800000] font-medium">
                <span>Your submission will be logged under ticket sequence and assigned to the facilities supervisor for review.</span>
              </div>

              {/* Submissions Disabled Warning */}
              {systemConfig.submissionsEnabled === false && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3.5 text-xs text-amber-900 font-semibold">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">Submissions Temporarily Disabled</span>
                    <span className="font-medium text-amber-800">The portal is visible but new complaint submissions have been paused by the administrator. Please try again later.</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || systemConfig.submissionsEnabled === false}
                className="w-full bg-[#800000] hover:bg-[#9A1B2F] text-white font-black py-4 rounded-2xl shadow-xl shadow-[#800000]/25 hover:shadow-[#800000]/40 transition-all duration-200 flex items-center justify-center gap-2.5 text-base hover:scale-[1.01] active:scale-98 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Ticket...</span>
                  </>
                ) : systemConfig.submissionsEnabled === false ? (
                  <><Lock size={17} /> Submissions Paused</>
                ) : (
                  <><SendHorizonal size={17} /> Submit Complaint</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
