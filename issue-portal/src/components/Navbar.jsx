/**
 * Navbar.jsx — Student Portal Navigation Bar (Purely Student Options)
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import CollegeLogo from './CollegeLogo.jsx';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 py-1">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-2">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <CollegeLogo className="h-16 sm:h-18 w-auto shrink-0" />
          <div>
            <p className="font-extrabold text-slate-900 text-lg leading-tight group-hover:text-red-900 transition">MRF Issue Portal</p>
            <p className="text-xs text-slate-500 font-medium leading-tight">Campus Maintenance Tracking System</p>
          </div>
        </Link>

        {/* Navigation Options */}
        <div className="flex items-center gap-2 sm:gap-3">
          {location.pathname !== '/' && (
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <Home size={14} />
              <span className="hidden sm:inline">Home</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
