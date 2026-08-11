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
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { createTicket } from '../ticketsStore.js';
import {
  ClipboardList, Upload, CheckCircle, ArrowRight, Phone,
  User, Mail, Building2, Layers, FileText, Camera,
  ChevronDown, LayoutDashboard, X, AlertCircle, Hash,
  Clock, Wrench, Info, MapPin, GraduationCap, BadgeCheck,
  SendHorizonal, PhoneCall, HelpCircle, ChevronRight,
  CalendarDays, Shield, ArrowLeft, Droplets
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
  { label: '💡 Electrical', prefix: 'Electrical issue: ' },
  { label: '🚰 Plumbing', prefix: 'Plumbing issue: ' },
  { label: '🖥️ IT / Network', prefix: 'IT/Network issue: ' },
  { label: '🪟 Civil / Infra', prefix: 'Civil/Infrastructure issue: ' },
  { label: '🧹 Sanitation', prefix: 'Sanitation issue: ' },
  { label: '♿ Accessibility', prefix: 'Accessibility issue: ' },
  { label: '📌 Others', prefix: 'Other issue: ' },
];

const OTHER_SUB_CATEGORIES = [
  { label: '💧 Drinking Water Cooler Leak', text: 'Drinking Water Leakage: Water cooler / purifier unit is leaking water.' },
  { label: '🚰 Restroom Tap / Flush Leak', text: 'Restroom Water Leakage: Tap, washbasin, or flush valve leaking continuously.' },
  { label: '🌧️ Pipe / Ceiling Water Seepage', text: 'Water Seepage Leakage: Water leaking from overhead tank, pipe junction, or ceiling.' },
  { label: '🧹 General Maintenance', text: 'General Maintenance: ' },
];

function SelectField({ label, id, value, onChange, options, placeholder, icon: Icon, error }) {
  return (
    <div>
      <label htmlFor={id} className="input-label flex items-center gap-1.5">
        {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}
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
      {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11}/>{error}</p>}
    </div>
  );
}

function InputField({ label, id, type = 'text', value, onChange, placeholder, icon: Icon, required, error }) {
  return (
    <div>
      <label htmlFor={id} className="input-label flex items-center gap-1.5">
        {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}
        <span>{label}</span>
        <span className="text-red-500 font-extrabold ml-0.5">*</span>
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
      {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11}/>{error}</p>}
    </div>
  );
}

export default function UserForm() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
    if (!form.name.trim())        errs.name = 'Name is required.';
    if (!form.email.trim())       errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.';
    if (!form.department)         errs.department = 'Select a department.';
    if (!form.userType)           errs.userType = 'Select a user type.';
    if (form.userType === 'Student') {
      if (!form.studentStream)    errs.studentStream = 'Select stream.';
      if (!form.studentLevel)     errs.studentLevel = 'Select level.';
    }
    if (!form.block)              errs.block = 'Select a block/building.';
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
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Navbar />

        <div className="flex-1 flex items-center justify-center p-6 py-12">
          <div className="animate-scale-in w-full max-w-lg">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-center text-white">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={34} className="text-white" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">Ticket Submitted!</h1>
                <p className="text-emerald-100 text-sm mt-1">Your complaint has been logged in the system.</p>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest">Assigned Ticket Number</p>
                    <p className="text-3xl font-extrabold text-blue-700 tracking-tight mt-0.5">{createdTicket.ticketNo}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Hash size={22} className="text-blue-600" />
                  </div>
                </div>

                <div className="space-y-0 divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden text-xs">
                  {[
                    { icon: User,        label: 'Name',        value: createdTicket.name },
                    { icon: Mail,        label: 'Email',       value: createdTicket.email },
                    { icon: Building2,   label: 'Department',  value: createdTicket.department },
                    { icon: GraduationCap, label: 'User Type', value:
                      createdTicket.userType +
                      (createdTicket.studentStream ? ` · ${createdTicket.studentStream}` : '') +
                      (createdTicket.studentLevel  ? ` · ${createdTicket.studentLevel}`  : '')
                    },
                    { icon: MapPin,      label: 'Location',    value:
                      createdTicket.block + (createdTicket.roomNo ? ` · Room ${createdTicket.roomNo}` : '')
                    },
                    { icon: CalendarDays, label: 'Submitted',  value: submittedAt },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white">
                      <Icon size={14} className="text-slate-400 shrink-0" />
                      <span className="text-slate-500 w-24 shrink-0 font-medium">{label}</span>
                      <span className="font-semibold text-slate-700 truncate">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleNewTicket}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition flex items-center justify-center gap-2 text-sm shadow"
                  >
                    <SendHorizonal size={15}/> File Another Issue
                  </button>
                  <Link
                    to="/"
                    className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition flex items-center gap-1.5"
                  >
                    <ArrowLeft size={15}/> Home
                  </Link>
                </div>
              </div>
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col selection:bg-blue-500 selection:text-white">
      <Navbar />

      {/* Page Header */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-8 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Link to="/" className="hover:text-blue-600 transition">Home</Link>
              <span>/</span>
              <span className="font-bold text-blue-600">Complaint Form</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                <ClipboardList size={22} />
              </div>
              <span>Submit Maintenance Complaint</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Fill out the form below to report campus infrastructure or facility issues.
            </p>
          </div>

          <Link
            to="/"
            className="text-xs text-slate-600 hover:text-blue-600 font-bold flex items-center gap-2 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/80 px-4 py-2.5 rounded-xl transition shadow-xs"
          >
            <ArrowLeft size={15} />
            <span>Back to Overview</span>
          </Link>
        </div>
      </div>

      {/* Form Container */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/90 overflow-hidden animate-slide-up"
        >
          {/* Top Gradient Accent Line */}
          <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

          <div className="p-6 md:p-10 space-y-10">

            {/* ── Section 1: Personal Info ────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <User size={15} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-blue-600">Personal Information</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InputField
                  label="Full Name" id="name" value={form.name}
                  onChange={handleChange('name')} placeholder="e.g. Arjun Nair"
                  icon={User} required error={errors.name}
                />
                <InputField
                  label="Email Address" id="email" type="email" value={form.email}
                  onChange={handleChange('email')} placeholder="you@college.edu"
                  icon={Mail} required error={errors.email}
                />
                <InputField
                  label="Phone Number" id="phone" type="tel" value={form.phone}
                  onChange={handleChange('phone')} placeholder="+91 9876543210"
                  icon={Phone} error={errors.phone}
                />
              </div>
            </section>

            {/* ── Section 2: Role & Classification ────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <Layers size={15} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-blue-600">Role & Classification</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <SelectField
                  label="User Type" id="userType" value={form.userType}
                  onChange={handleChange('userType')}
                  options={[
                    { value: 'Student', label: '🎓 Student' },
                    { value: 'Staff',   label: '👨‍🏫 Staff' },
                    { value: 'Unit',    label: '🏢 Unit / Office' },
                  ]}
                  placeholder="Select user type" icon={User} error={errors.userType}
                />

                {form.userType === 'Student' && (
                  <>
                    <div className="animate-fade-in">
                      <SelectField
                        label="Stream" id="studentStream" value={form.studentStream}
                        onChange={handleChange('studentStream')}
                        options={[
                          { value: 'Aided', label: 'Aided' },
                          { value: 'SFS',   label: 'SFS (Self-Financing)' },
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
                      : DEPARTMENTS
                  }
                  placeholder="Select department" icon={Building2} error={errors.department}
                />
              </div>
            </section>

            {/* ── Section 3: Location Details ─────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                  <MapPin size={15} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-blue-600">Location Details</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <SelectField
                  label="Block / Building" id="block" value={form.block}
                  onChange={handleChange('block')} options={BLOCKS}
                  placeholder="Select block" icon={Building2} error={errors.block}
                />
                <InputField
                  label="Room / Area No." id="roomNo" value={form.roomNo}
                  onChange={handleChange('roomNo')} placeholder="e.g. Room 204, Lab 3, Restroom 2nd floor"
                  icon={MapPin} error={errors.roomNo}
                />
              </div>
            </section>

            {/* ── Section 4: Issue Description & Photo ───────── */}
            <section className="space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <FileText size={15} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-wider text-blue-600">Issue Details</h2>
              </div>

              <div className="space-y-5">
                {/* Category chips */}
                <div>
                  <label className="input-label flex items-center gap-1.5 font-bold text-slate-700 mb-2">
                    <Hash size={14} className="text-blue-500 shrink-0"/>
                    <span>ISSUE CATEGORY</span>
                    <span className="text-red-500 font-extrabold ml-0.5">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ISSUE_CATEGORIES.map(({ label, prefix }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            issueCategory: label,
                            description: prev.description.startsWith(prefix)
                              ? prev.description
                              : prefix + prev.description.replace(/^[^:]+: /, ''),
                          }));
                        }}
                        className={`text-xs px-3.5 py-2 rounded-xl border font-bold transition-all duration-200 cursor-pointer ${
                          form.issueCategory === label
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 scale-105'
                            : 'bg-slate-50/80 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-white hover:text-blue-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-picks for Others (Drinking Water Leak, Restroom Tap Leak, etc.) */}
                {form.issueCategory.includes('Others') && (
                  <div className="p-4 bg-blue-50/90 border border-blue-200/80 rounded-2xl animate-fade-in space-y-2.5 shadow-xs">
                    <p className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Droplets size={14} className="text-blue-600 shrink-0" />
                      Quick Sub-Categories (e.g., Water Leakage):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {OTHER_SUB_CATEGORIES.map(sub => (
                        <button
                          key={sub.label}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({
                              ...prev,
                              description: sub.text,
                            }));
                          }}
                          className={`text-xs px-3.5 py-2 rounded-xl border font-bold transition-all duration-200 flex items-center gap-1.5 ${
                            form.description.startsWith(sub.text.split(':')[0])
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority Segmented Control */}
                <div>
                  <label className="input-label flex items-center gap-1.5 font-bold text-slate-700 mb-2">
                    <AlertCircle size={14} className="text-amber-500 shrink-0"/>
                    <span>PRIORITY LEVEL</span>
                    <span className="text-red-500 font-extrabold ml-0.5">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2.5 bg-slate-100/80 p-2 rounded-2xl border border-slate-200/80">
                    {[
                      { level: 'Normal',   icon: '🟢', bgActive: 'bg-[#ECFDF5] text-[#10B981] border-emerald-300 shadow-sm font-black' },
                      { level: 'High',     icon: '🟡', bgActive: 'bg-[#FFFBEB] text-[#D97706] border-amber-300 shadow-sm font-black' },
                      { level: 'Critical', icon: '🔴', bgActive: 'bg-[#FEF2F2] text-[#EF4444] border-red-300 shadow-sm font-black' },
                    ].map(({ level: p, icon, bgActive }) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                        className={`text-xs py-2.5 px-3 rounded-xl border font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                          form.priority === p
                            ? bgActive
                            : 'bg-white/70 text-slate-500 border-transparent hover:bg-white hover:text-slate-800'
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{p}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description Textarea */}
                <div>
                  <label htmlFor="description" className="input-label flex items-center gap-1.5 font-bold text-slate-700">
                    <FileText size={14} className="text-slate-400 shrink-0"/>
                    <span>DESCRIPTION</span>
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea
                    id="description"
                    rows={5}
                    value={form.description}
                    onChange={handleChange('description')}
                    placeholder="Describe the complaint in detail (what is broken, where, since when)..."
                    className={`input-field resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${errors.description ? 'border-red-400 focus:ring-red-400' : ''}`}
                  />
                  {errors.description && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11}/>{errors.description}</p>}
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="input-label flex items-center gap-1.5 font-bold text-slate-700">
                    <Camera size={14} className="text-slate-400"/>
                    <span>UPLOAD PHOTO</span>
                    <span className="text-slate-400 font-normal text-xs">(optional · max 5MB)</span>
                  </label>
                  {photoPreview ? (
                    <div className="relative group">
                      <img src={photoPreview} alt="Preview" className="h-48 w-full object-cover rounded-2xl border border-slate-200 shadow-md"/>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute top-3 right-3 bg-white/90 backdrop-blur-md border border-slate-200 shadow-md text-slate-700 hover:text-red-600 rounded-full p-2 transition hover:scale-110"
                      >
                        <X size={15}/>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group space-y-2"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all">
                        <Upload size={22} />
                      </div>
                      <p className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                        Click or drag photo to upload
                      </p>
                      <p className="text-[11px] text-slate-400">PNG, JPG, WEBP up to 5MB</p>
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
            <div className="flex items-center gap-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-900 font-medium">
              <Shield size={18} className="text-blue-600 shrink-0" />
              <span>Your submission will be logged under ticket sequence and assigned to the facilities supervisor for review.</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center gap-2.5 text-base hover:scale-[1.01] active:scale-98 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <><SendHorizonal size={17}/> Submit Complaint</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
