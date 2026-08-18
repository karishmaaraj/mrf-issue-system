/**
 * StatsBar.jsx — Animated & Clickable Statistics Bar for Admin Dashboard
 * Features animated count transitions with rAF cleanup, interactive hover lift, glowing icons,
 * live resolution meters, and 1-click navigation to dedicated work history views.
 */
import React, { useEffect, useState } from 'react';
import { isTicketUrgent } from '../ticketsStore.js';
import {
  ClipboardList, Clock, CheckCircle2, AlertTriangle,
  TrendingUp, Sparkles, Activity, ArrowUpRight
} from 'lucide-react';

function AnimatedCounter({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    let animId;
    const duration = 300; // ms
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(start + (end - start) * progress);
      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(updateCounter);
      }
    };

    animId = requestAnimationFrame(updateCounter);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [value]);

  return <span className="inline-block transition-all duration-300 transform">{displayValue}</span>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  border,
  trend,
  isUrgent = false,
  badgeText,
  onClick,
  categoryKey,
  activeCategory
}) {
  const isActive = activeCategory === categoryKey;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick(); } }}
      title={`Click to view ${label} history & work orders`}
      className={`
        relative overflow-hidden rounded-2xl px-5 py-4 border ${border} ${bg}
        shadow-[0_4px_14px_-2px_rgba(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1.5
        active:scale-[0.98] transition-all duration-300 group cursor-pointer select-none
        ${isActive ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''}
        ${isUrgent && value > 0 ? 'animate-urgent-pulse' : ''}
      `}
    >
      {/* Ambient background glow orb */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/40 blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

      {/* Top light shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

      <div className="flex items-center gap-4 relative z-10">
        {/* Animated Icon Container */}
        <div
          className={`
            w-12 h-12 rounded-2xl flex items-center justify-center ${color}
            shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3
            relative shrink-0
          `}
        >
          <Icon size={22} className="text-white transform transition-transform group-hover:scale-105" />
          {isUrgent && value > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border-2 border-white" />
            </span>
          )}
        </div>

        {/* Text & Count Value */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate group-hover:text-slate-800 transition-colors">
              {label}
            </p>
            {badgeText && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200/80 shadow-2xs text-slate-600">
                {badgeText}
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-0.5">
            <p className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
              <AnimatedCounter value={value} />
            </p>
            <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              <span>View</span>
              <ArrowUpRight size={11} />
            </span>
          </div>
        </div>

        {/* Trend / Metric indicator */}
        {trend !== undefined && (
          <div className="ml-auto flex items-center gap-1.5 text-emerald-700 bg-emerald-100/80 border border-emerald-200/80 px-2.5 py-1 rounded-full text-xs font-extrabold shadow-2xs group-hover:scale-105 transition-transform shrink-0">
            <TrendingUp size={13} className="animate-pulse" />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsBar({ tickets = [], activeCategory, onSelectCategory }) {
  const total     = tickets.length;
  const unsolved  = tickets.filter(t => t.status === 'Unsolved').length;
  const ongoing   = tickets.filter(t => t.status === 'Ongoing').length;
  const completed = tickets.filter(t => t.status === 'Completed').length;
  const pending   = unsolved + ongoing;
  const urgent    = tickets.filter(isTicketUrgent).length;
  const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. TOTAL CARD */}
      <StatCard
        categoryKey="TOTAL"
        activeCategory={activeCategory}
        onClick={() => onSelectCategory && onSelectCategory('TOTAL')}
        icon={ClipboardList}
        label="Total Logged"
        value={total}
        color="bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20"
        bg="bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40"
        border="border-blue-200/80"
        trend={`${rate}% resolved`}
      />

      {/* 2. PENDING CARD */}
      <StatCard
        categoryKey="PENDING"
        activeCategory={activeCategory}
        onClick={() => onSelectCategory && onSelectCategory('PENDING')}
        icon={Clock}
        label="Pending"
        value={pending}
        color="bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/20"
        bg="bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40"
        border="border-amber-200/80"
        badgeText={`${unsolved} Unsolved`}
      />

      {/* 3. URGENT ISSUES CARD */}
      <StatCard
        categoryKey="URGENT"
        activeCategory={activeCategory}
        onClick={() => onSelectCategory && onSelectCategory('URGENT')}
        icon={AlertTriangle}
        label="Urgent Issues"
        value={urgent}
        color="bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20"
        bg="bg-gradient-to-br from-red-50/90 via-white to-rose-50/40"
        border="border-red-200/80"
        isUrgent={true}
        badgeText={urgent > 0 ? 'Action Req.' : 'Clear'}
      />

      {/* 4. COMPLETED CARD */}
      <StatCard
        categoryKey="COMPLETED"
        activeCategory={activeCategory}
        onClick={() => onSelectCategory && onSelectCategory('COMPLETED')}
        icon={CheckCircle2}
        label="Completed"
        value={completed}
        color="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
        bg="bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40"
        border="border-emerald-200/80"
        badgeText={`${total - pending} Closed`}
      />
    </div>
  );
}
