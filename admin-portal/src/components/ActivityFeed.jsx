/**
 * ActivityFeed.jsx — Recent Activity Section (Light MCC Theme)
 * Displays compact timestamped activity feed using real ticket data.
 */
import React from 'react';

function formatShortTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Just now';
  }
}

export default function ActivityFeed({ tickets = [], onSelectTicket }) {
  const sortedTickets = tickets
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Recent Activity
        </h2>
        <span className="text-[11px] text-slate-400 font-medium">Live Feed</span>
      </div>

      <div className="divide-y divide-slate-100">
        {sortedTickets.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">No recent activity logged.</p>
        ) : (
          sortedTickets.map((item) => {
            const timeStr = formatShortTime(item.updatedAt || item.createdAt);
            const isAssigned = !!item.assignedWorker;
            const isCompleted = item.status === 'Completed' || item.status === 'Resolved';
            const isReopened = item.status === 'Reopened';

            let icon = '📋';
            let actionText = `Ticket ${item.ticketNo} updated to ${item.status}`;

            if (isCompleted) {
              icon = '✓';
              actionText = `Ticket ${item.ticketNo} marked resolved`;
            } else if (isReopened) {
              icon = '↻';
              actionText = `Ticket ${item.ticketNo} reopened by user`;
            } else if (isAssigned) {
              icon = '🔧';
              actionText = `Assigned ${item.ticketNo} to ${item.assignedWorker}`;
            }

            return (
              <div
                key={item.ticketNo}
                onClick={() => onSelectTicket && onSelectTicket(item)}
                className="py-2.5 flex items-start gap-3 hover:bg-slate-50 p-2 rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-xs font-mono text-slate-400 font-medium shrink-0 pt-0.5">
                  {timeStr}
                </span>

                <div className="min-w-0 flex-1 text-xs text-slate-800 font-medium leading-normal">
                  <span className="mr-1.5">{icon}</span>
                  <span>{actionText}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
