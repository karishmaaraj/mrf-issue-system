/**
 * StatRow.jsx — Compact Status Summary Metrics (Institutional MCC Light Theme)
 * Renders Unsolved, In Progress, Awaiting User Confirmation, Resolved & Closed, Reopened.
 * Features status-specific soft tinted backgrounds and clean compact metric counters.
 */
import React from 'react';

export default function StatRow({ tickets = [], activeCategory, onSelectCategory }) {
  const unsolved  = tickets.filter(t => t.status === 'Unsolved').length;
  const ongoing   = tickets.filter(t => t.status === 'Ongoing').length;
  const awaiting  = tickets.filter(t => t.status === 'Awaiting User Confirmation').length;
  const resolved  = tickets.filter(t => t.status === 'Completed' || t.status === 'Resolved').length;
  const reopened  = tickets.filter(t => t.status === 'Reopened').length;

  const stats = [
    {
      key: 'UNSOLVED',
      label: 'Unsolved',
      count: unsolved,
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FCA5A5]/60',
      textColor: 'text-[#991B1B]',
      countColor: 'text-[#7F1D1D]',
    },
    {
      key: 'ONGOING',
      label: 'In Progress',
      count: ongoing,
      bg: 'bg-[#FFF7ED]',
      border: 'border-[#FDBA74]/60',
      textColor: 'text-[#C2410C]',
      countColor: 'text-[#9A3412]',
    },
    {
      key: 'AWAITING',
      label: 'Awaiting User Confirmation',
      count: awaiting,
      bg: 'bg-[#FEFCE8]',
      border: 'border-[#FDE047]/60',
      textColor: 'text-[#A16207]',
      countColor: 'text-[#854D0E]',
    },
    {
      key: 'RESOLVED',
      label: 'Resolved & Closed',
      count: resolved,
      bg: 'bg-[#F0FDF4]',
      border: 'border-[#86EFAC]/60',
      textColor: 'text-[#15803D]',
      countColor: 'text-[#166534]',
    },
    {
      key: 'REOPENED',
      label: 'Reopened',
      count: reopened,
      bg: 'bg-[#FAF5FF]',
      border: 'border-[#E9D5FF]/60',
      textColor: 'text-[#7E22CE]',
      countColor: 'text-[#6B21A8]',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((item) => {
        const isActive = activeCategory === item.key;

        return (
          <div
            key={item.key}
            onClick={() => onSelectCategory && onSelectCategory(item.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCategory && onSelectCategory(item.key); } }}
            className={`
              p-3.5 rounded-xl border ${item.bg} ${item.border}
              transition-all duration-200 cursor-pointer select-none shadow-2xs hover:shadow-xs hover:-translate-y-0.5
              ${isActive ? 'ring-2 ring-[#800000] ring-offset-1' : ''}
            `}
          >
            <p className={`text-2xl font-black tracking-tight leading-none ${item.countColor}`}>
              {item.count}
            </p>
            <p className={`text-xs font-bold leading-tight mt-1.5 truncate ${item.textColor}`}>
              {item.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

