import type { TicketPriority, TicketStatus } from '../types/support.ts';

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return 'Pending';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatShortDate(iso);
}

export function getPriorityTextClass(priority: TicketPriority): string {
  switch (priority) {
    case 'Urgent':
      return 'text-red-600 font-semibold';
    case 'High':
      return 'text-amber-700 font-semibold';
    case 'Medium':
      return 'text-slate-800 font-medium';
    case 'Low':
      return 'text-slate-500 font-normal';
  }
}

export function getStatusTextClass(status: TicketStatus): string {
  switch (status) {
    case 'Open':
      return 'text-blue-700 font-medium';
    case 'In Progress':
      return 'text-slate-900 font-medium';
    case 'Pending Customer':
      return 'text-amber-700 font-medium';
    case 'Escalated':
      return 'text-red-600 font-semibold';
    case 'Resolved':
      return 'text-emerald-700 font-medium';
    case 'Closed':
      return 'text-slate-500 font-normal';
  }
}
