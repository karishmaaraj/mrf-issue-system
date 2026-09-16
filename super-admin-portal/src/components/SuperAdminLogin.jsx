/**
 * SuperAdminLogin.jsx — Native Issue Portal Master Authentication Gate
 * Design System: MCC Maroon Light Institutional Theme (100% Native to Issue Portal)
 * Credentials: superadmin@mcc.edu / super2024
 */
import React, { useState } from 'react';
import CollegeLogo from './CollegeLogo.jsx';
import { Crown, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

const SUPER_EMAIL = 'superadmin@mcc.edu';

export default function SuperAdminLogin({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [shaking, setShaking]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your Super Admin email.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      const apiBase = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
        ? ''
        : 'http://localhost:5000';

      const res = await fetch(`${apiBase}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        if (data.user?.role !== 'SUPER_ADMIN') {
          setError('Access Denied: Super Admin privileges required.');
          setShaking(true);
          setTimeout(() => setShaking(false), 600);
          return;
        }
        onLogin(data.user);
      } else {
        setError(data.error || 'Invalid Super Admin credentials. Access denied.');
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      }
    } catch (err) {
      setError('Connection error. Server is unreachable.');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#171717] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-[#A00000] selection:text-white font-sans">
      {/* Soft Ambient Maroon Radial Wash */}
      <div className="fixed top-[-10%] left-[-5%] w-[45rem] h-[45rem] bg-[#FFF5F5]/60 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[45rem] h-[45rem] bg-[#FFF5F5]/40 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#A000000d_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />

      {/* Page Header */}
      <div className="flex items-center gap-4 text-[#171717] mb-8 relative z-10 animate-fade-in">
        <CollegeLogo className="h-14 sm:h-16 w-auto shrink-0" />
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-black tracking-tight block text-[#171717]">MCC Super Admin</span>
          </div>
          <span className="text-xs text-[#666666] font-semibold tracking-wide block mt-0.5">
            Campus-Wide Governance & Facilities Control System
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div
        className={`bg-white text-[#171717] w-full max-w-md rounded-3xl shadow-xl animate-scale-in border border-[#E5E5E5] relative overflow-hidden z-10 ${
          shaking ? 'animate-[shake_0.5s_ease]' : ''
        }`}
      >
        {/* Solid Top Maroon Stripe */}
        <div className="h-2 w-full bg-[#A00000]" />

        <div className="p-7 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#A00000] bg-[#FFF5F5] border border-[#E5E5E5] px-3.5 py-1 rounded-full uppercase tracking-wider shadow-2xs">
              <ShieldCheck size={14} className="text-[#A00000]" />
              <span>Master Authority Gate</span>
            </div>

            <div className="flex justify-center py-2 relative">
              <div className="w-16 h-16 rounded-full bg-[#FFF5F5] border border-[#E5E5E5] flex items-center justify-center text-[#A00000] shadow-xs">
                <Crown size={32} />
              </div>
            </div>

            <h1 className="text-2xl font-black text-[#171717] tracking-tight">Super Admin Sign In</h1>
            <p className="text-xs text-[#666666] font-medium">
              Access system-wide controls, staff dispatches & portal branding.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="super-email" className="input-label flex items-center gap-1.5 font-extrabold text-[#171717] mb-1 text-[11px] uppercase tracking-wider">
                <Mail size={13} className="text-[#A00000] shrink-0" />
                <span>SUPER ADMIN EMAIL</span>
              </label>
              <input
                id="super-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="superadmin@mcc.edu"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] bg-white text-[#171717] placeholder:text-[#888888] text-xs font-medium focus:ring-4 focus:ring-[#A00000]/10 focus:border-[#A00000] transition duration-150 outline-none"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="super-password" className="input-label flex items-center gap-1.5 font-extrabold text-[#171717] mb-1 text-[11px] uppercase tracking-wider">
                <Lock size={13} className="text-[#A00000] shrink-0" />
                <span>MASTER PASSWORD</span>
              </label>
              <div className="relative">
                <input
                  id="super-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter master password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E5E5E5] bg-white text-[#171717] placeholder:text-[#888888] text-xs font-medium focus:ring-4 focus:ring-[#A00000]/10 focus:border-[#A00000] transition duration-150 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A00000] transition cursor-pointer"
                >
                  {showPw ? <span className="text-xs font-bold text-[#666666]">Hide</span> : <span className="text-xs font-bold text-[#A00000]">Show</span>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 font-semibold">
                <AlertCircle size={14} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#A00000] hover:bg-[#800000] text-white font-bold py-3.5 rounded-xl shadow-md shadow-[#A00000]/20 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm hover:scale-[1.01] active:scale-95 cursor-pointer mt-2"
            >
              <span>Enter Super Admin Control Center</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
