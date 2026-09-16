import { isTicketUrgent } from '../ticketsStore.js';

export function getAttentionLevel(t) {
  if (t.status === 'Completed' || t.status === 'Resolved' || t.status === 'Archived') return 99;

  const isCritical = t.priority === 'Critical' || t.isUrgent === true || isTicketUrgent(t);
  const isHigh = t.priority === 'High';
  const isUnsolvedUnassigned = t.status === 'Unsolved' && (!t.assignedWorker || !t.assignedWorker.trim());
  const isReopened = t.status === 'Reopened';

  if (isCritical) return 1;
  if (isHigh) return 2;
  if (isUnsolvedUnassigned) return 3;
  if (isReopened) return 4;
  
  return 99;
}

export function sortAndFilterAttentionItems(tickets) {
  const allActionItems = tickets
    .map(t => ({ ticket: t, level: getAttentionLevel(t) }))
    .filter(item => item.level < 99)
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      // Secondary sort: most recent first
      const dateA = new Date(a.ticket.createdAt || 0).getTime();
      const dateB = new Date(b.ticket.createdAt || 0).getTime();
      return dateB - dateA;
    })
    .map(item => item.ticket);

  // Deduplicate by ticketNo
  const uniqueActionItems = [];
  const seenTicketNos = new Set();
  for (const t of allActionItems) {
    if (!seenTicketNos.has(t.ticketNo)) {
      seenTicketNos.add(t.ticketNo);
      uniqueActionItems.push(t);
    }
  }

  return uniqueActionItems;
}
