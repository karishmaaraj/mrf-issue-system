/**
 * Navbar.jsx — Student Portal Navigation Bar (Purely Student Options)
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowRight } from 'lucide-react';
import CollegeLogo from './CollegeLogo.jsx';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs sticky top-0 z-30 py-0.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-2">
        {/* Brand (Left Side) */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <CollegeLogo className="h-14 sm:h-16 w-auto shrink-0 transition-transform group-hover:scale-105" />
          <div>
            <p className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight group-hover:text-red-700 transition">MCC ISSUE PORTAL</p>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight">Campus Maintenance Tracking System</p>
          </div>
        </Link>

        {/* Right Side Status & Action Area */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Subtle Live System Status Indicator */}
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/90 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-black text-slate-800 leading-none">
                System Online
              </span>
              <span className="text-[9px] font-semibold text-slate-500 leading-none mt-0.5">
                24/7 Maintenance Support
              </span>
            </div>
          </div>

          {/* Navigation Action: Report an Issue or Back to Home */}
          {location.pathname !== '/complaint' ? (
            <Link
              to="/complaint"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-600 via-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-3.5 sm:px-4 py-2 rounded-xl shadow-xs shadow-red-600/20 hover:shadow-md hover:shadow-red-600/25 hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              <span>Report an Issue</span>
              <ArrowRight size={13} className="stroke-[2.5]" />
            </Link>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100/80 hover:bg-blue-50 border border-slate-200/90 hover:border-blue-200 px-3.5 py-2 rounded-xl transition-all duration-200 active:scale-95 shadow-2xs"
            >
              <Home size={14} />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
