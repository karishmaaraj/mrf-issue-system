/**
 * Navbar.jsx — Student Portal Navigation Bar (Purely Student Options)
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowRight, ArrowLeft } from 'lucide-react';
import CollegeLogo from './CollegeLogo.jsx';

export default function Navbar() {
  const location = useLocation();
  const isComplaintPage = location.pathname.includes('/complaint');

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-[#E5E5E5] shadow-xs sticky top-0 z-30 py-0.5">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between px-4 sm:px-6 py-1.5">
        {/* Brand (Left Side) */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <CollegeLogo className="h-10 sm:h-12 w-auto shrink-0 transition-transform group-hover:scale-105" />
          <div>
            <p className="font-extrabold text-[#171717] text-base sm:text-lg leading-tight group-hover:text-[#800000] transition">MCC FIX HUB</p>
            <p className="text-[11px] sm:text-xs text-[#6B6B6B] font-medium leading-tight">Campus Maintenance Tracking System</p>
          </div>
        </Link>

        {/* Right Side Status & Action Area */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {/* Subtle Live System Status Indicator */}
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#F7F7F7] border border-[#E5E5E5] shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#159447] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#159447]" />
            </span>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-black text-[#171717] leading-none">
                System Online
              </span>
              <span className="text-[9px] font-semibold text-[#6B6B6B] leading-none mt-0.5">
                24/7 Maintenance Support
              </span>
            </div>
          </div>

          {/* Navigation Actions */}
          {!isComplaintPage ? (
            <Link
              to="/complaint"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#800000] hover:bg-[#9A1B2F] px-3.5 sm:px-4 py-2 rounded-xl shadow-xs shadow-[#800000]/20 hover:shadow-md hover:shadow-[#800000]/25 hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              <span>Report an Issue</span>
              <ArrowRight size={13} className="stroke-[2.5]" />
            </Link>
          ) : (
            <>
              {/* Back to Overview Button */}
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#171717] hover:text-[#800000] bg-[#F7F7F7] hover:bg-[#F4E8EA] border border-[#E5E5E5] hover:border-[#800000]/40 px-3 py-2 rounded-xl transition-all duration-200 active:scale-95 shadow-2xs"
              >
                <ArrowLeft size={14} />
                <span>Back to Overview</span>
              </Link>

              {/* Back to Home Button */}
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#171717] hover:text-[#800000] bg-[#F7F7F7] hover:bg-[#F4E8EA] border border-[#E5E5E5] hover:border-[#800000]/40 px-3 py-2 rounded-xl transition-all duration-200 active:scale-95 shadow-2xs"
              >
                <Home size={14} />
                <span>Back to Home</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
