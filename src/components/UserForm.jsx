/**
 * UserForm.jsx — Dynamic Complaint Submission Form (route "/complaint")
 *
 * Provides a clean, standalone complaint form for students, staff, and campus units.
 * Features:
 *  • Integrated shared Navbar (with link to Home and Admin)
 *  • Dynamic Section & Field Rendering driven by Super Admin Complaint Form configuration
 *  • Preserves native ticket schema and user workflow
 *  • Instant Ticket ID (#001) confirmation modal/screen
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { createTicket } from '../ticketsStore.js';
import { getSystemConfig, fetchSystemConfigFromServer, getNormalizedFormConfig, applyThemeTokens, DEFAULT_STARTUP_COMPANIES } from '../systemConfigStore.js';
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
  'M. A. English', 'M. A. Tamil', 'M. A. History', 'M. A. Political Science',
  'M. A. Economics', 'M. A. Philosophy', 'M. Com. Commerce',
  'M. Sc. Mathematics', 'M. Sc. Physics', 'M. Sc. Chemistry',
  'M. Sc. Plant Biology & Plant Biotechnology', 'M. Sc. Zoology'
];

export const SFS_UG_DEPARTMENTS = [
  'B. A. English Language & Literature', 'B. A. Journalism', 'B. Com. Commerce',
  'B. Com. Accounting & Finance', 'B. Com. Corporate Secretaryship',
  'B. Com. Professional Accounting', 'B. B. A. Business Administration',
  'B. C. A. Computer Applications', 'B. Sc. Computer Science',
  'B. Sc. Visual Communication', 'B. Sc. Physical Education',
  'B. Sc. Psychology', 'B. Sc. Geography & Tourism'
];

export const SFS_PG_DEPARTMENTS = [
  'M. A. Communication', 'M. Com. Corporate Secretaryship',
  'M. Sc. Applied Microbiology', 'M. Sc. Chemistry',
  'M. Sc. Physics', 'M. Sc. Mathematics', 'M. S. W. Social Work',
  'M. C. A. Master of Computer Applications'
];

export const DEPARTMENTS = Array.from(new Set([
  ...AIDED_UG_DEPARTMENTS,
  ...AIDED_PG_DEPARTMENTS,
  ...SFS_UG_DEPARTMENTS,
  ...SFS_PG_DEPARTMENTS,
])).sort();

export const BLOCKS = [
  'Main Academic Building', 'Science Block A', 'Science Block B',
  'Commerce Block', 'SFS Main Block', 'SFS Annex', 'Central Library',
  'Student Center / Canteen', 'Selaiyur Hall (Hostel)', "St. Thomas's Hall (Hostel)",
  'Bishop Heber Hall (Hostel)', 'Martin Hall (Hostel)', 'Margaret Hall (Hostel)',
  'Barnes Hall (Hostel)', 'Administrative Building', 'Sports Complex & Pavilion',
  'Campus Health Center', 'Auditorium & Fine Arts Complex'
];

export const ISSUE_CATEGORIES = [
  { id: 'cat-1', label: '🚰 Plumbing & Water Supply', prefix: 'Plumbing & Water issue: ' },
  { id: 'cat-2', label: '⚡ Electrical & Power', prefix: 'Electrical fault: ' },
  { id: 'cat-3', label: '❄️ Air Conditioner & Cooling', prefix: 'AC maintenance issue: ' },
  { id: 'cat-4', label: '🪑 Furniture & Carpentry', prefix: 'Furniture repair needed: ' },
  { id: 'cat-5', label: '💻 IT & Network Infrastructure', prefix: 'Network/IT issue: ' },
  { id: 'cat-6', label: '🧹 Civil, Cleaning & Sanitation', prefix: 'Sanitation / Cleaning issue: ' },
  { id: 'cat-7', label: '📌 Others / Custom Complaint', prefix: 'General complaint: ' },
];

export const OTHER_SUB_CATEGORIES = [
  { id: 'sub-1', label: '💧 Water Leakage / Seepage', text: 'Water leakage observed from pipe / wall seepage.' },
  { id: 'sub-2', label: '💡 Broken Light Switch', text: 'Light switch / power socket broken or flickering.' },
  { id: 'sub-3', label: '🔑 Door Lock Jamb', text: 'Door lock jammed or key cylinder broken.' },
  { id: 'sub-4', label: '🖥️ Projector / Display Fault', text: 'Classroom projector / display screen not powering on.' },
  { id: 'sub-5', label: '🪟 Broken Window Glass', text: 'Window glass cracked or window latch loose.' },
];

function Abstract3DSaasBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#800000]/10 via-[#9A1B2F]/5 to-transparent blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-[#800000]/10 via-[#9A1B2F]/5 to-transparent blur-3xl" />
      <div className="absolute inset-0 bg-[radial-[#800000]_1px,transparent_1px] [background-size:24px_24px] opacity-[0.03]" />
    </div>
  );
}

export function getCleanCategoryLabel(rawLabel) {
  if (!rawLabel) return '';
  return rawLabel.replace(/^[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/gu, '').trim();
}

function SelectField({ label, id, value, onChange, options, placeholder, required, error }) {
  return (
    <div>
      <label htmlFor={id} className="input-label flex items-center gap-1 font-bold text-[#171717]">
        <span>{label}</span>
        {required && <span className="text-red-500 font-extrabold ml-0.5">*</span>}
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
              : <option key={opt.value !== undefined ? opt.value : opt} value={opt.value !== undefined ? opt.value : opt}>
                  {opt.label || opt.value || opt}
                </option>
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
    if (systemConfig?.theme) {
      applyThemeTokens(systemConfig.theme);
    }
  }, [systemConfig]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'MCC FIX HUB — Campus Facilities';
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

  const normalizedForm = useMemo(() => {
    return getNormalizedFormConfig(systemConfig.complaintForm);
  }, [systemConfig]);

  const enabledSections = useMemo(() => {
    return (normalizedForm.sections || []).filter(sec => sec.enabled !== false);
  }, [normalizedForm]);

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
    const val = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setForm(prev => ({ ...prev, [field]: val }));
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

  // Dynamic validation across all enabled sections & enabled fields
  const validate = () => {
    const errs = {};

    enabledSections.forEach(sec => {
      (sec.fields || []).forEach(field => {
        if (field.enabled === false) return;

        const val = form[field.id];
        const valStr = val !== undefined && val !== null ? val.toString().trim() : '';

        if (field.required) {
          if (field.id === 'photoUpload' || field.type === 'file') {
            if (!photo && !val) errs[field.id] = `${field.label || 'Photo'} is required.`;
          } else if (field.id === 'userType') {
            if (!valStr) errs.userType = 'Select a user type.';
            const isStudent = form.userType && (form.userType === 'Student' || form.userType.includes('Student'));
            const isStaff = form.userType && (form.userType === 'Staff' || form.userType.includes('Staff'));
            if ((isStudent || isStaff) && !form.studentStream) {
              errs.studentStream = 'Select stream.';
            }
            if (isStudent && !form.studentLevel) {
              errs.studentLevel = 'Select level.';
            }
          } else if (field.id === 'studentStream') {
            const isStudent = form.userType && (form.userType === 'Student' || form.userType.includes('Student'));
            const isStaff = form.userType && (form.userType === 'Staff' || form.userType.includes('Staff'));
            if ((isStudent || isStaff) && !valStr) {
              errs.studentStream = 'Select stream.';
            }
          } else if (field.id === 'studentLevel') {
            const isStudent = form.userType && (form.userType === 'Student' || form.userType.includes('Student'));
            if (isStudent && !valStr) {
              errs.studentLevel = 'Select level.';
            }
          } else if (field.id === 'department') {
            const isStartup = form.userType && (form.userType === 'Startup' || form.userType.includes('Startup'));
            if (!isStartup && !valStr) {
              errs.department = 'Select department.';
            }
          } else if (field.id === 'company') {
            const isStartup = form.userType && (form.userType === 'Startup' || form.userType.includes('Startup'));
            if (isStartup && !valStr) {
              errs.company = 'Select company.';
            }
          } else {
            if (!valStr) {
              errs[field.id] = `${field.label} is required.`;
            }
          }
        }

        if (field.type === 'email' && valStr && !/\S+@\S+\.\S+/.test(valStr)) {
          errs[field.id] = 'Enter a valid email address.';
        }
      });
    });

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

    const customFields = {};
    enabledSections.forEach(sec => {
      (sec.fields || []).forEach(f => {
        if (f.enabled !== false && form[f.id] !== undefined) {
          customFields[f.id] = form[f.id];
        }
      });
    });

    const ticketPayload = {
      ...form,
      photo,
      customFields,
      formData: { ...form, photoName: photo ? 'Attached Photo' : null }
    };

    const ticket = await createTicket(ticketPayload);
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
                      { icon: Building2, label: createdTicket.userType === 'Startup' ? 'Company' : 'Department', value: createdTicket.department },
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
                      className="flex-1 bg-[#800000] hover:bg-[#9A1B2F] text-white font-semibold rounded-xl py-3 transition flex items-center justify-center gap-2 text-sm shadow cursor-pointer"
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
                  {systemConfig.userPortal?.closedNotice?.message || 'The MCC FIX HUB is currently offline for maintenance or scheduled downtime. Please check back shortly or contact the Facilities Office directly.'}
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

  // Helper to render individual dynamic fields
  const renderField = (field) => {
    if (field.enabled === false) return null;

    // 1. Special field: userType
    if (field.id === 'userType') {
      return (
        <SelectField
          key={field.id}
          label={field.label || 'User Classification'}
          id="userType"
          value={form.userType}
          onChange={handleChange('userType')}
          options={field.options || ['Student', 'Staff', 'Unit / Office', 'Startup']}
          placeholder={field.placeholder || "Select classification"}
          required={field.required}
          error={errors.userType}
        />
      );
    }

    if (field.id === 'studentStream') {
      const isStudent = form.userType && (form.userType === 'Student' || form.userType.includes('Student'));
      const isStaff = form.userType && (form.userType === 'Staff' || form.userType.includes('Staff'));
      if (!isStudent && !isStaff) return null;
      return (
        <div key={field.id} className="animate-fade-in">
          <SelectField
            label={field.label || 'Stream'}
            id="studentStream"
            value={form.studentStream}
            onChange={handleChange('studentStream')}
            options={(Array.isArray(field.options) && field.options.length > 0) ? field.options : [
              { value: 'Aided', label: 'Aided' },
              { value: 'SFS', label: 'SFS (Self-Financing)' },
            ]}
            placeholder="Select stream"
            required={field.required}
            error={errors.studentStream}
          />
        </div>
      );
    }

    if (field.id === 'studentLevel') {
      const isStudent = form.userType && (form.userType === 'Student' || form.userType.includes('Student'));
      if (!isStudent) return null;
      return (
        <div key={field.id} className="animate-fade-in">
          <SelectField
            label={field.label || 'Level'}
            id="studentLevel"
            value={form.studentLevel}
            onChange={handleChange('studentLevel')}
            options={(Array.isArray(field.options) && field.options.length > 0) ? field.options : [
              { value: 'UG', label: 'UG (Undergraduate)' },
              { value: 'PG', label: 'PG (Postgraduate)' },
            ]}
            placeholder="Select level"
            required={field.required}
            error={errors.studentLevel}
          />
        </div>
      );
    }

    // 2. Special field: department
    if (field.id === 'department') {
      const isStudent = form.userType && form.userType.includes('Student');
      const isStartup = form.userType && (form.userType === 'Startup' || form.userType.includes('Startup'));
      if (isStartup) return null;

      const secRoleFieldOpts = systemConfig.complaintForm?.sections?.find(s => s.id === 'sec_role')?.fields?.find(f => f.id === 'department')?.options;
      const sysConfigDepts = systemConfig.complaintForm?.fields?.department?.options || secRoleFieldOpts;

      const configuredDepts = (Array.isArray(sysConfigDepts) && sysConfigDepts.length > 0)
        ? sysConfigDepts.filter(o => o !== 'Startup')
        : (Array.isArray(field.options) && field.options.length > 0)
          ? field.options.filter(o => o !== 'Startup')
          : DEPARTMENTS;

      let filteredDepts = configuredDepts;

      if (isStudent && form.studentStream && form.studentLevel) {
        const knownOtherDepts = (form.studentStream === 'Aided' && form.studentLevel === 'UG')
          ? [...AIDED_PG_DEPARTMENTS, ...SFS_UG_DEPARTMENTS, ...SFS_PG_DEPARTMENTS]
          : (form.studentStream === 'Aided' && form.studentLevel === 'PG')
            ? [...AIDED_UG_DEPARTMENTS, ...SFS_UG_DEPARTMENTS, ...SFS_PG_DEPARTMENTS]
            : (form.studentStream === 'SFS' && form.studentLevel === 'UG')
              ? [...AIDED_UG_DEPARTMENTS, ...AIDED_PG_DEPARTMENTS, ...SFS_PG_DEPARTMENTS]
              : [...AIDED_UG_DEPARTMENTS, ...AIDED_PG_DEPARTMENTS, ...SFS_UG_DEPARTMENTS];

        const subset = configuredDepts.filter(d => !knownOtherDepts.includes(d));
        if (subset.length > 0) {
          filteredDepts = subset;
        }
      }

      const deptOpts = filteredDepts.length > 0 ? filteredDepts : configuredDepts;

      return (
        <SelectField
          key={field.id}
          label={field.label || 'Department'}
          id="department"
          value={form.department}
          onChange={handleChange('department')}
          options={deptOpts}
          placeholder="Select department"
          required={field.required}
          error={errors.department}
        />
      );
    }

    // Dynamic field: company (for Startup classification)
    if (field.id === 'company') {
      const isStartup = form.userType && (form.userType === 'Startup' || form.userType.includes('Startup'));
      if (!isStartup) return null;

      const secRoleFieldOpts = systemConfig.complaintForm?.sections?.find(s => s.id === 'sec_role')?.fields?.find(f => f.id === 'company')?.options;
      const startupCompanyOpts = (Array.isArray(secRoleFieldOpts) && secRoleFieldOpts.length > 0)
        ? secRoleFieldOpts
        : (Array.isArray(systemConfig?.companies) && systemConfig.companies.length > 0)
          ? systemConfig.companies
          : (Array.isArray(field.options) && field.options.length > 0)
            ? field.options
            : DEFAULT_STARTUP_COMPANIES;

      return (
        <div key={field.id} className="animate-fade-in">
          <SelectField
            label={field.label || 'Company'}
            id="company"
            value={form.company || form.department}
            onChange={(e) => {
              const val = e.target.value;
              setForm(prev => ({
                ...prev,
                company: val,
                department: val
              }));
              if (errors.company || errors.department) {
                setErrors(prev => ({ ...prev, company: '', department: '' }));
              }
            }}
            options={startupCompanyOpts}
            placeholder="Select company"
            required={field.required}
            error={errors.company || errors.department}
          />
        </div>
      );
    }

    // 3. Special field: block
    if (field.id === 'block') {
      const blockOpts = Array.isArray(field.options) && field.options.length > 0
        ? field.options
        : (systemConfig.complaintForm?.fields?.location?.blocks || BLOCKS);

      return (
        <SelectField
          key={field.id}
          label={field.label || 'Block / Building'}
          id="block"
          value={form.block}
          onChange={handleChange('block')}
          options={blockOpts}
          placeholder="Select block"
          required={field.required}
          error={errors.block}
        />
      );
    }

    // 4. Special field: issueCategory
    if (field.id === 'issueCategory') {
      return (
        <div key={field.id} className="space-y-3">
          <label className="input-label flex items-center gap-1.5 font-bold text-[#800000] mb-2.5">
            <span className="tracking-wide">{field.label?.toUpperCase() || 'ISSUE CATEGORY'}</span>
            {field.required && <span className="text-red-500 font-extrabold ml-0.5">*</span>}
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
          {errors.issueCategory && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.issueCategory}</p>}
        </div>
      );
    }

    // 5. Special field: priority
    if (field.id === 'priority') {
      return (
        <div key={field.id}>
          <label className="input-label flex items-center gap-1.5 font-bold text-[#800000] mb-2.5">
            <span className="tracking-wide">{field.label?.toUpperCase() || 'PRIORITY LEVEL'}</span>
            {field.required && <span className="text-red-500 font-extrabold ml-0.5">*</span>}
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
      );
    }

    // 6. Special field: description
    if (field.id === 'description' || field.type === 'textarea') {
      return (
        <div key={field.id}>
          <label htmlFor={field.id} className="input-label flex items-center gap-1.5 font-bold text-[#800000]">
            <span>{field.label?.toUpperCase() || 'DESCRIPTION'}</span>
            {field.required && <span className="text-red-500 font-extrabold ml-0.5">*</span>}
          </label>
          <textarea
            id={field.id}
            rows={5}
            value={form[field.id] || ''}
            onChange={handleChange(field.id)}
            placeholder={field.placeholder || "Describe the complaint in detail..."}
            className={`w-full px-4 py-2.5 rounded-2xl border border-[#D9D9D9] bg-white text-sm text-[#171717] placeholder:text-[#777777] hover:bg-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#800000]/12 focus:border-[#800000] transition duration-200 resize-none shadow-xs ${errors[field.id] ? 'border-red-400 focus:ring-red-400' : ''}`}
          />
          {errors[field.id] && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors[field.id]}</p>}
        </div>
      );
    }

    // 7. Special field: photoUpload / file
    if (field.id === 'photoUpload' || field.type === 'file') {
      return (
        <div key={field.id}>
          <label className="input-label flex items-center gap-1.5 font-bold text-[#800000]">
            <span>{field.label?.toUpperCase() || 'UPLOAD PHOTO'}</span>
            <span className="text-[#777777] font-normal text-xs">({field.required ? 'required' : 'optional'} · max 5MB)</span>
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
          {errors[field.id] && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors[field.id]}</p>}
        </div>
      );
    }

    // 8. Dynamic Select Dropdown
    if (field.type === 'select') {
      return (
        <SelectField
          key={field.id}
          label={field.label}
          id={field.id}
          value={form[field.id] || ''}
          onChange={handleChange(field.id)}
          options={field.options || []}
          placeholder={field.placeholder || `Select ${field.label}`}
          required={field.required}
          error={errors[field.id]}
        />
      );
    }

    // 9. Dynamic Radio Group
    if (field.type === 'radio') {
      return (
        <div key={field.id} className="space-y-2">
          <label className="input-label flex items-center gap-1 font-bold text-[#171717]">
            <span>{field.label}</span>
            {field.required && <span className="text-red-500 font-extrabold ml-0.5">*</span>}
          </label>
          <div className="flex flex-wrap gap-4">
            {(field.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-xs font-semibold text-[#171717] cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={form[field.id] === opt}
                  onChange={handleChange(field.id)}
                  className="text-[#800000] focus:ring-[#800000]"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {errors[field.id] && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors[field.id]}</p>}
        </div>
      );
    }

    // 10. Dynamic Checkbox Group
    if (field.type === 'checkbox') {
      return (
        <div key={field.id} className="space-y-2">
          <label className="input-label flex items-center gap-1 font-bold text-[#171717]">
            <span>{field.label}</span>
            {field.required && <span className="text-red-500 font-extrabold ml-0.5">*</span>}
          </label>
          <div className="flex flex-wrap gap-4">
            {(field.options || []).map((opt) => {
              const currentVals = Array.isArray(form[field.id]) ? form[field.id] : [];
              const isChecked = currentVals.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 text-xs font-semibold text-[#171717] cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...currentVals, opt]
                        : currentVals.filter(v => v !== opt);
                      handleChange(field.id)(next);
                    }}
                    className="rounded text-[#800000] focus:ring-[#800000]"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
          {errors[field.id] && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors[field.id]}</p>}
        </div>
      );
    }

    // 11. Generic Input (text, email, phone, number)
    return (
      <InputField
        key={field.id}
        label={field.label}
        id={field.id}
        type={field.type || 'text'}
        value={form[field.id] || ''}
        onChange={handleChange(field.id)}
        placeholder={field.placeholder || `Enter ${field.label}`}
        required={field.required}
        error={errors[field.id]}
      />
    );
  };

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

              {/* Dynamically Render All Enabled Sections & Fields */}
              {enabledSections.map((sec) => {
                const secFields = (sec.fields || []).filter(f => f.enabled !== false);
                if (secFields.length === 0) return null;

                return (
                  <section key={sec.id} className="space-y-5">
                    <div className="border-b border-[#E5E5E5] pb-3">
                      <h2 className="text-xs font-black uppercase tracking-wider text-[#800000]">
                        {sec.title}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {secFields.map(field => {
                        const content = renderField(field);
                        if (!content) return null;

                        // Full width fields: issueCategory, priority, description, photoUpload
                        const isFullWidth = ['issueCategory', 'priority', 'description', 'photoUpload'].includes(field.id) || ['textarea', 'file'].includes(field.type);

                        return (
                          <div key={field.id} className={isFullWidth ? 'sm:col-span-2' : ''}>
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

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
