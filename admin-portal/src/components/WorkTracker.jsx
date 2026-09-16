/**
 * WorkTracker.jsx — Bold Multi-Stage Status Bar & Animated Progress Tracker
 * Features flowing liquid gradient progress, pulsing active stage nodes, and smooth step transitions.
 */
import React from 'react';
import { CheckCircle2, Clock, Wrench, Send, FileCheck, Sparkles } from 'lucide-react';

export default function WorkTracker({ ticket, compact = false }) {
  if (!ticket) return null;

  const isUnsolved  = ticket.status === 'Unsolved';
  const isOngoing   = ticket.status === 'Ongoing' || ticket.status === 'Awaiting User Confirmation' || ticket.status === 'Reopened';
  const isCompleted = ticket.status === 'Completed' || ticket.status === 'Resolved';

  // Step 2 status
  const step2Active = isOngoing;
  const step2Done   = isCompleted;
  // Step 3 status
  const step3Done   = isCompleted;

  if (compact) {
    return (
      <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden border border-slate-200 p-0.5 shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isCompleted
              ? 'w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600 shadow-emerald-500/20'
              : isOngoing
              ? 'w-2/3 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shadow-amber-500/20'
              : 'w-1/3 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 shadow-blue-500/20'
          }`}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-300 space-y-2.5 relative overflow-hidden group">
      {/* Subtle background ambient gradient accent */}
      <div className="absolute top-0 right-0 w-80 h-32 bg-gradient-to-l from-blue-50/60 via-indigo-50/30 to-transparent pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:rotate-6 transition-transform">
            <FileCheck size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Resolution Progress Tracker
              </span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                {ticket.ticketNo}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium truncate max-w-sm">
              {ticket.description ? ticket.description.slice(0, 65) + (ticket.description.length > 65 ? '…' : '') : 'Live complaint status timeline'}
            </p>
          </div>
        </div>

        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs transition-all duration-300 ${
          isCompleted ? 'badge-completed animate-pop-badge' : isOngoing ? 'badge-ongoing animate-pulse' : 'badge-unsolved'
        }`}>
          {isCompleted ? '✓ Stage 3/3: Solved & Closed' : isOngoing ? '⚡ Stage 2/3: In Progress' : '● Stage 1/3: Ticket Logged'}
        </span>
      </div>

      {/* Bold Smooth Multi-Stage Progress Bar Container */}
      <div className="relative pt-1.5 pb-1 px-2">
        {/* Track Line Background */}
        <div className="absolute top-6.5 left-10 right-10 h-2 bg-slate-100 rounded-full -z-0 border border-slate-200/80 overflow-hidden">
          {/* Faint animated background shimmer */}
          <div className="w-full h-full animate-shimmer" />
        </div>

        {/* Dynamic Animated Filled Liquid Track */}
        <div
          className="absolute top-6.5 left-10 h-2 rounded-full transition-all duration-700 ease-out -z-0 shadow-sm bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 animate-gradient-flow"
          style={{
            width: isCompleted ? 'calc(100% - 5rem)' : isOngoing ? 'calc(50% - 2.5rem)' : '0%',
          }}
        />

        {/* 3 Interactive Stage Nodes */}
        <div className="flex items-center justify-between relative z-10">

          {/* Stage 1: Logged */}
          <div className="flex flex-col items-center text-center group/node cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25 font-bold ring-3 ring-white transform group-hover/node:scale-105 transition-all duration-300">
              <CheckCircle2 size={18} className="animate-pop-badge" />
            </div>
            <span className="text-[11px] font-extrabold text-slate-800 mt-1">1. Logged</span>
            <span className="text-[9px] font-semibold text-slate-400">Ticket Created</span>
          </div>

          {/* Stage 2: Work In Progress */}
          <div className="flex flex-col items-center text-center group/node cursor-pointer">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-md transition-all duration-300 ring-3 ring-white transform group-hover/node:scale-105 ${
              step2Done
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25'
                : step2Active
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/35 ring-amber-100 animate-pulse-glow'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}>
              {step2Done ? (
                <CheckCircle2 size={18} className="animate-pop-badge" />
              ) : (
                <Wrench size={16} className={step2Active ? 'animate-spin group-hover-wiggle' : ''} />
              )}
            </div>
            <span className={`text-[11px] font-extrabold mt-1 transition-colors ${step2Active || step2Done ? 'text-slate-900' : 'text-slate-400'}`}>
              2. In Progress
            </span>
            <span className="text-[9px] font-semibold text-slate-500 truncate max-w-[120px]">
              {ticket.assignedWorker ? `👤 ${ticket.assignedWorker}` : 'Assigning Staff…'}
            </span>
          </div>

          {/* Stage 3: Solved & Notified */}
          <div className="flex flex-col items-center text-center group/node cursor-pointer">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-md transition-all duration-300 ring-3 ring-white transform group-hover/node:scale-105 ${
              step3Done
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30 ring-emerald-100'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}>
              {step3Done ? (
                <CheckCircle2 size={18} className="animate-pop-badge" />
              ) : (
                <Send size={15} className="transform group-hover/node:translate-x-0.5 transition-transform" />
              )}
            </div>
            <span className={`text-[11px] font-extrabold mt-1 transition-colors ${step3Done ? 'text-slate-900' : 'text-slate-400'}`}>
              3. Solved & Closed
            </span>
            <span className="text-[9px] font-semibold text-slate-500 truncate max-w-[120px]">
              {step3Done ? (ticket.completedDate ? `✓ ${ticket.completedDate}` : 'Task Completed') : 'Pending Resolution'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
