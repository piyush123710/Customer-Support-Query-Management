import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { fetchTickets, updateTicket } from '../api/client.ts';
import {
  COMPLAINT_STAGES,
  type AnalyticsSummary,
  type ComplaintStage,
  type PaginatedResponse,
  type TicketWithCustomer,
} from '../types/support.ts';
import {
  formatMinutes,
  formatRelativeTime,
  getPriorityTextClass,
  getStatusTextClass,
} from '../utils/format.ts';

interface ComplaintsWorkflowViewProps {
  analytics: AnalyticsSummary | null;
  refreshKey: number;
  onSelectTicket: (ticketId: string) => void;
  onTicketMutated: () => void;
}

const NEXT_STAGE: Record<ComplaintStage, ComplaintStage | null> = {
  Intake: 'Investigation',
  Investigation: 'Remediation',
  Remediation: 'Verified Resolved',
  'Verified Resolved': null,
};

export function ComplaintsWorkflowView({
  analytics,
  refreshKey,
  onSelectTicket,
  onTicketMutated,
}: ComplaintsWorkflowViewProps) {
  const [stageFilter, setStageFilter] = useState<ComplaintStage | ''>('');
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<TicketWithCustomer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTickets({
      page,
      limit: 20,
      complaintsOnly: true,
      complaintStage: stageFilter,
      slaBreached: slaBreachedOnly,
      sortBy: 'createdAt',
      sortDir: 'desc',
    })
      .then((res) => {
        if (active) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, stageFilter, slaBreachedOnly, refreshKey]);

  const handleAdvanceStage = async (
    e: React.MouseEvent,
    ticket: TicketWithCustomer,
    nextStage: ComplaintStage
  ) => {
    e.stopPropagation();
    setUpdatingId(ticket.id);
    try {
      await updateTicket(ticket.id, {
        complaintStage: nextStage,
        status: nextStage === 'Verified Resolved' ? 'Resolved' : 'In Progress',
        actorName: 'Hannah Lindqvist',
      });
      onTicketMutated();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4-Stage Complaint Tracking Workflow Pipeline */}
      <section
        aria-label="Complaint workflow stages"
        className="bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        {COMPLAINT_STAGES.map((stage, index) => {
          const stats = analytics?.complaintFunnel.find((s) => s.stage === stage);
          const isActive = stageFilter === stage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => {
                setStageFilter((prev) => (prev === stage ? '' : stage));
                setPage(1);
              }}
              className={`p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive ? 'bg-blue-50/60' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  0{index + 1}. {stage}
                </span>
                {isActive && (
                  <span className="text-blue-700 font-medium">Filtered</span>
                )}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                {stats?.count ?? 0}
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                Avg response: {formatMinutes(stats?.avgResponseMinutes || null)}
              </div>
            </button>
          );
        })}
      </section>

      {/* Workflow Filter Bar & Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Complaint Resolution &amp; SLA Escalation Queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor pending complaints, response times, and advance remediation stages
            </p>
          </div>

          <div className="flex items-center gap-2">
            {stageFilter && (
              <button
                type="button"
                onClick={() => {
                  setStageFilter('');
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
              >
                Show All Stages
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSlaBreachedOnly((prev) => !prev);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                slaBreachedOnly
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              SLA Breaches Only
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4 whitespace-nowrap">Ticket</th>
                <th className="py-3 px-4">Complaint Summary &amp; Account</th>
                <th className="py-3 px-4 whitespace-nowrap">Priority</th>
                <th className="py-3 px-4 whitespace-nowrap">Workflow Stage</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  Response / Target
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  Workflow Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-4 px-4">
                      <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    No complaints found for the selected stage filter.
                  </td>
                </tr>
              ) : (
                data.items.map((ticket) => {
                  const stage = ticket.complaintStage ?? 'Intake';
                  const nextStage = NEXT_STAGE[stage];
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => onSelectTicket(ticket.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {ticket.id}
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-medium text-slate-900 truncate">
                          {ticket.subject}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {ticket.customerName} ({ticket.customerTier}) ·{' '}
                          {ticket.customerCompany} · {formatRelativeTime(ticket.createdAt)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span className={getPriorityTextClass(ticket.priority)}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          {stage === 'Verified Resolved' ? (
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-emerald-600"
                              aria-hidden="true"
                            />
                          ) : ticket.slaBreached ? (
                            <ShieldAlert
                              className="w-3.5 h-3.5 text-red-600"
                              aria-hidden="true"
                            />
                          ) : (
                            <Clock
                              className="w-3.5 h-3.5 text-amber-600"
                              aria-hidden="true"
                            />
                          )}
                          <span>{stage}</span>
                        </div>
                        <div className={`mt-0.5 ${getStatusTextClass(ticket.status)}`}>
                          {ticket.status}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums">
                        <span
                          className={`font-mono text-xs ${
                            ticket.slaBreached
                              ? 'text-red-600 font-semibold'
                              : 'text-slate-700'
                          }`}
                        >
                          {formatMinutes(ticket.responseTimeMinutes)}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          {' '}
                          / {formatMinutes(ticket.slaTargetMinutes)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {nextStage ? (
                          <button
                            type="button"
                            disabled={updatingId === ticket.id}
                            onClick={(e) => handleAdvanceStage(e, ticket, nextStage)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
                          >
                            <span>
                              {updatingId === ticket.id
                                ? 'Updating...'
                                : `Advance to ${nextStage}`}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-medium">
                            Closed Loop
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600 tabular-nums">
            <span>
              Page {data.page} of {data.totalPages} ({data.total} complaints)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
