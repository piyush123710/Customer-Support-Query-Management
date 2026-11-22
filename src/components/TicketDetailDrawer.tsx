import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  addTicketInteraction,
  deleteTicket,
  fetchTicketDetail,
  updateTicket,
} from '../api/client.ts';
import {
  COMPLAINT_STAGES,
  SUPPORT_AGENTS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type ComplaintStage,
  type CustomerWithStats,
  type SupportAgent,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TicketWithCustomer,
} from '../types/support.ts';
import { formatDateTime, formatMinutes } from '../utils/format.ts';

interface TicketDetailDrawerProps {
  ticketId: string | null;
  onClose: () => void;
  onMutated: () => void;
  onOpenCustomer: (customerId: string) => void;
}

export function TicketDetailDrawer({
  ticketId,
  onClose,
  onMutated,
  onOpenCustomer,
}: TicketDetailDrawerProps) {
  const [ticket, setTicket] = useState<TicketWithCustomer | null>(null);
  const [customer, setCustomer] = useState<CustomerWithStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [nextStatus, setNextStatus] = useState<TicketStatus | ''>('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setTicket(null);
      setCustomer(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setConfirmDelete(false);
    setReplyText('');
    setNextStatus('');

    fetchTicketDetail(ticketId)
      .then((res) => {
        if (!active) return;
        setTicket(res.ticket);
        setCustomer(res.customer);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load ticket');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticketId]);

  if (!ticketId) return null;

  const handleFieldUpdate = async (
    updates: Partial<{
      status: TicketStatus;
      priority: TicketPriority;
      category: TicketCategory;
      assignedAgent: SupportAgent;
      isComplaint: boolean;
      complaintStage: ComplaintStage | null;
    }>
  ) => {
    if (!ticket) return;
    setSavingMeta(true);
    try {
      const updated = await updateTicket(ticket.id, {
        ...updates,
        actorName: 'Hannah Lindqvist',
      });
      setTicket(updated);
      onMutated();
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const updated = await addTicketInteraction(ticket.id, {
        authorType: 'Agent',
        authorName: 'Hannah Lindqvist',
        message: replyText.trim(),
        isInternalNote,
        nextStatus: nextStatus || undefined,
      });
      setTicket(updated);
      setReplyText('');
      setNextStatus('');
      onMutated();
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket) return;
    await deleteTicket(ticket.id);
    onMutated();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
      role="dialog"
      aria-modal="true"
      aria-label={`Ticket ${ticketId} workspace`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>{ticketId}</span>
              {ticket && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{ticket.channel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Created {formatDateTime(ticket.createdAt)}</span>
                </>
              )}
            </div>
            <h2 className="text-base font-semibold text-slate-900 mt-1 leading-snug">
              {ticket ? ticket.subject : 'Loading ticket...'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {ticket && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete ticket"
                className="p-2 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close ticket drawer"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        {loading ? (
          <div className="p-6 space-y-4 flex-1">
            <div className="h-24 bg-slate-100 rounded animate-pulse" />
            <div className="h-48 bg-slate-50 rounded animate-pulse" />
          </div>
        ) : error || !ticket ? (
          <div className="p-6 text-sm text-red-600">{error || 'Ticket not found'}</div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {/* SLA & Customer Context Strip */}
            <div className="px-6 py-4 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-900">
                  {ticket.customerName} · {ticket.customerCompany}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {ticket.customerEmail} · {ticket.customerTier} Tier
                  {customer ? ` · ${customer.totalTickets} total queries` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenCustomer(ticket.customerId);
                  onClose();
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                <span>Open Customer Record</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Workflow Controls Grid */}
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Status
                </label>
                <select
                  disabled={savingMeta}
                  value={ticket.status}
                  onChange={(e) =>
                    handleFieldUpdate({ status: e.target.value as TicketStatus })
                  }
                  className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Priority
                </label>
                <select
                  disabled={savingMeta}
                  value={ticket.priority}
                  onChange={(e) =>
                    handleFieldUpdate({ priority: e.target.value as TicketPriority })
                  }
                  className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Assigned Agent
                </label>
                <select
                  disabled={savingMeta}
                  value={ticket.assignedAgent}
                  onChange={(e) =>
                    handleFieldUpdate({ assignedAgent: e.target.value as SupportAgent })
                  }
                  className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                >
                  {SUPPORT_AGENTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Category
                </label>
                <select
                  disabled={savingMeta}
                  value={ticket.category}
                  onChange={(e) =>
                    handleFieldUpdate({ category: e.target.value as TicketCategory })
                  }
                  className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* SLA Metrics & Complaint Tracking Toggle */}
              <div className="col-span-2 sm:col-span-4 pt-2 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-4 tabular-nums">
                  <span className="text-slate-500">
                    First Response:{' '}
                    <strong
                      className={
                        ticket.slaBreached ? 'text-red-600' : 'text-slate-900'
                      }
                    >
                      {formatMinutes(ticket.responseTimeMinutes)}
                    </strong>
                  </span>
                  <span className="text-slate-500">
                    SLA Target:{' '}
                    <strong className="text-slate-900">
                      {formatMinutes(ticket.slaTargetMinutes)}
                    </strong>
                  </span>
                  {ticket.slaBreached && (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      SLA Breached
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ticket.isComplaint}
                      onChange={(e) =>
                        handleFieldUpdate({ isComplaint: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span>Complaint Workflow</span>
                  </label>

                  {ticket.isComplaint && (
                    <select
                      disabled={savingMeta}
                      value={ticket.complaintStage ?? 'Intake'}
                      onChange={(e) =>
                        handleFieldUpdate({
                          complaintStage: e.target.value as ComplaintStage,
                        })
                      }
                      aria-label="Complaint workflow stage"
                      className="h-8 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    >
                      {COMPLAINT_STAGES.map((st) => (
                        <option key={st} value={st}>
                          Stage: {st}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Chronological Interaction Thread */}
            <div className="px-6 py-5 space-y-4">
              <h3 className="text-xs font-semibold text-slate-700">
                Interaction History ({ticket.interactions.length})
              </h3>

              <div className="space-y-3">
                {ticket.interactions.map((entry) => {
                  const isSystem = entry.authorType === 'System';
                  const isAgent = entry.authorType === 'Agent';
                  return (
                    <div
                      key={entry.id}
                      className={`p-3.5 rounded-lg border text-sm ${
                        isSystem
                          ? 'bg-slate-50 border-slate-200 text-slate-600 text-xs py-2.5'
                          : entry.isInternalNote
                            ? 'bg-amber-50/60 border-amber-200 text-slate-900'
                            : isAgent
                              ? 'bg-blue-50/40 border-blue-200/80 text-slate-900'
                              : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900">
                          {entry.authorName}
                          <span className="font-normal text-slate-500">
                            {' '}
                            ·{' '}
                            {entry.isInternalNote
                              ? 'Internal Note'
                              : entry.authorType}
                          </span>
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-wrap">
                        {entry.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Reply / Internal Note Composer */}
        {ticket && (
          <form
            onSubmit={handleSendReply}
            className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3 shrink-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md">
                <button
                  type="button"
                  onClick={() => setIsInternalNote(false)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    !isInternalNote
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Customer Reply
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternalNote(true)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    isInternalNote
                      ? 'bg-amber-50 text-amber-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Internal Note
                </button>
              </div>

              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as TicketStatus | '')}
                aria-label="Update status on send"
                className="h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="">Keep Status ({ticket.status})</option>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    Set Status: {s}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={3}
              required
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                isInternalNote
                  ? 'Add an internal escalation note visible only to support staff...'
                  : `Reply to ${ticket.customerName}...`
              }
              className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingReply || !replyText.trim()}
                className="h-9 px-4 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                {submittingReply
                  ? 'Sending...'
                  : isInternalNote
                    ? 'Save Internal Note'
                    : 'Send Reply'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
