/**
 * SuperAdminLogin.jsx — Master Authentication Gate for Super Admin
 * Default Credentials:
 *   Email:    superadmin@mrf.edu
 *   Password: super2024
 */
import React, { useState } from 'react';
import CollegeLogo from './CollegeLogo.jsx';
import { Crown, ShieldAlert, Eye, EyeOff, Lock, Mail, AlertCircle, Sparkles, KeyRound } from 'lucide-react';

const SUPER_EMAIL    = 'superadmin@mrf.edu';
const SUPER_PASSWORD = 'super2024';

export default function SuperAdminLogin({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [shaking, setShaking]   = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your Super Admin email.');
      return;
    }

    if (
      email.trim().toLowerCase() === SUPER_EMAIL &&
      password === SUPER_PASSWORD
    ) {
      onLogin();
    } else {
      setError('Invalid Super Admin credentials. Access denied.');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  };

  const fillDemo = () => {
    setEmail(SUPER_EMAIL);
    setPassword(SUPER_PASSWORD);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-amber-500 selection:text-black">
      {/* Ambient Master Glows */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-10 right-10 w-[30rem] h-[30rem] bg-indigo-600/20 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid line texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#f59e0b15_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 text-white mb-8 relative z-10 animate-fade-in">
        <CollegeLogo className="h-14 w-auto drop-shadow-[0_4px_12px_rgba(245,158,11,0.35)]" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight block text-white">MRF Super Admin</span>
            <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
              Level 0 Access
            </span>
          </div>
          <span className="text-xs text-slate-400 font-semibold tracking-wide">Campus-Wide Master Governance & Dynamic Control</span>
        </div>
      </div>

      {/* Login Card */}
      <div
        className={`bg-slate-900/90 backdrop-blur-2xl text-white w-full max-w-md rounded-3xl shadow-[0_30px_90px_-15px_rgba(0,0,0,0.95)] animate-scale-in border border-amber-500/30 relative overflow-hidden z-10 ${
          shaking ? 'animate-[shake_0.5s_ease]' : ''
        }`}
      >
        {/* Master Gold Accent Line */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-purple-600 to-blue-500" />

        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-300 bg-amber-950/80 border border-amber-500/40 px-3.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
              <Crown size={14} className="text-amber-400" />
              <span>Master System Commander</span>
            </div>

            <div className="flex justify-center py-2 relative group">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl group-hover:bg-amber-500/40 transition-all pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300/30 relative z-10">
                <Crown size={32} className="text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight">Super Admin Sign In</h1>
            <p className="text-xs text-slate-400 font-medium">
              Dynamic configuration for User & Admin Portals.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="super-email" className="input-label flex items-center gap-1.5 font-bold text-slate-300 mb-1 text-[11px]">
                <Mail size={13} className="text-amber-400 shrink-0" />
                <span>SUPER ADMIN EMAIL</span>
              </label>
              <input
                id="super-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="superadmin@mrf.edu"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950/80 text-white placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium transition duration-150 outline-none"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="super-password" className="input-label flex items-center gap-1.5 font-bold text-slate-300 mb-1 text-[11px]">
                <Lock size={13} className="text-amber-400 shrink-0" />
                <span>MASTER PASSWORD</span>
              </label>
              <div className="relative">
                <input
                  id="super-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter master password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-700/80 bg-slate-950/80 text-white placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium transition duration-150 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-300 text-xs bg-red-950/80 border border-red-500/40 rounded-xl px-3.5 py-2.5 font-semibold">
                <AlertCircle size={14} className="shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black py-3.5 rounded-xl shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 transition-all duration-200 flex items-center justify-center gap-2 text-sm hover:scale-[1.01] active:scale-95 cursor-pointer mt-2"
            >
              <Crown size={17} />
              <span>Enter Super Admin Control Center</span>
            </button>
          </form>
        </div>
      </div>

      {/* Demo Credentials Pill */}
      <div className="mt-6 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-5 py-3 text-xs text-slate-300 flex flex-col sm:flex-row items-center gap-3 shadow-xl relative z-10">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <KeyRound size={14} />
          <span>Super Admin Access:</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>Email: <code className="bg-slate-950 text-amber-300 px-2 py-0.5 rounded-md font-mono border border-slate-800">superadmin@mrf.edu</code></span>
          <span>·</span>
          <span>Pass: <code className="bg-slate-950 text-amber-300 px-2 py-0.5 rounded-md font-mono border border-slate-800">super2024</code></span>
        </div>
        <button
          type="button"
          onClick={fillDemo}
          className="ml-auto text-[11px] font-black text-amber-300 hover:text-black bg-amber-500/20 hover:bg-amber-400 border border-amber-500/40 px-3 py-1 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
        >
          <Sparkles size={12} /> Auto-Fill
        </button>
      </div>
    </div>
  );
}
