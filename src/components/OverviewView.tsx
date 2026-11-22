import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import type { AnalyticsSummary, TicketWithCustomer } from '../types/support.ts';
import {
  formatMinutes,
  formatRelativeTime,
  getPriorityTextClass,
  getStatusTextClass,
} from '../utils/format.ts';

interface OverviewViewProps {
  analytics: AnalyticsSummary | null;
  urgentTickets: TicketWithCustomer[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectTicket: (ticketId: string) => void;
  onNavigateQueue: (preset?: {
    status?: string;
    priority?: string;
    slaBreached?: boolean;
  }) => void;
  onNavigateComplaints: () => void;
}

export function OverviewView({
  analytics,
  urgentTickets,
  loading,
  error,
  onRetry,
  onSelectTicket,
  onNavigateQueue,
  onNavigateComplaints,
}: OverviewViewProps) {
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  if (error) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-sm font-medium text-slate-900">Unable to load support overview</p>
        <p className="text-sm text-slate-500 mt-1">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !analytics) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-5 space-y-2">
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white border border-slate-200 rounded-lg animate-pulse" />
          <div className="h-80 bg-white border border-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const maxDaily = Math.max(
    1,
    ...analytics.dailyTrend.map((d) => Math.max(d.created, d.resolved))
  );
  const activeDay =
    hoveredDayIndex !== null
      ? analytics.dailyTrend[hoveredDayIndex]
      : analytics.dailyTrend[analytics.dailyTrend.length - 1];

  return (
    <div className="space-y-6">
      {/* Primary KPI Strip (Single Surface, Hairline Dividers) */}
      <section
        aria-label="Key support metrics"
        className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <button
          type="button"
          onClick={() => onNavigateQueue({})}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <div className="text-xs font-medium text-slate-500">Total Customer Queries</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {analytics.totalTickets}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Across {analytics.totalCustomers} customer profiles
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateQueue({ status: 'Active' })}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <div className="text-xs font-medium text-slate-500">Active &amp; Pending</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-blue-700 tabular-nums">
            {analytics.openPendingCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {analytics.escalatedCount} escalated · {analytics.resolvedCount} resolved
          </div>
        </button>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Avg First Response</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {formatMinutes(analytics.avgFirstResponseMinutes)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Mean resolution: {analytics.avgResolutionHours}h
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateQueue({ slaBreached: true })}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <div className="text-xs font-medium text-slate-500">SLA Compliance</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums">
            {analytics.slaComplianceRate}%
          </div>
          <div className="mt-1 text-xs text-red-600 tabular-nums">
            {analytics.slaBreachedCount} queries breached SLA
          </div>
        </button>

        <button
          type="button"
          onClick={onNavigateComplaints}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 col-span-2 lg:col-span-1"
        >
          <div className="text-xs font-medium text-slate-500">Active Complaints</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-amber-700 tabular-nums">
            {analytics.activeComplaintsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span>View complaint workflow</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </button>
      </section>

      {/* Main Analytics Split: 14-Day Volume Chart + Priority Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                14-Day Query Volume &amp; Resolution Throughput
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily incoming customer queries compared against resolved cases
              </p>
            </div>

            {activeDay && (
              <div className="flex items-center gap-4 text-xs tabular-nums">
                <span className="font-medium text-slate-700">{activeDay.label}</span>
                <span className="text-blue-700 font-medium">
                  {activeDay.created} created
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  /
                </span>
                <span className="text-emerald-700 font-medium">
                  {activeDay.resolved} resolved
                </span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="h-56 flex items-end gap-2">
              {analytics.dailyTrend.map((day, idx) => {
                const createdPct = Math.round((day.created / maxDaily) * 100);
                const resolvedPct = Math.round((day.resolved / maxDaily) * 100);
                const isSelected = hoveredDayIndex === idx;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onFocus={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                    aria-label={`${day.label}: ${day.created} created, ${day.resolved} resolved`}
                    className={`flex-1 h-full flex flex-col justify-end items-center gap-1.5 px-1 rounded transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                      isSelected ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="w-full flex-1 flex items-end justify-center gap-1 pt-2">
                      <div
                        className="w-2.5 sm:w-3 bg-blue-600 rounded-t transition-all duration-150"
                        style={{ height: `${Math.max(4, createdPct)}%` }}
                      />
                      <div
                        className="w-2.5 sm:w-3 bg-emerald-600/80 rounded-t transition-all duration-150"
                        style={{ height: `${Math.max(4, resolvedPct)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {idx % 2 === 0 ? day.label : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-xs inline-block" />
                  Incoming Queries
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-600/80 rounded-xs inline-block" />
                  Resolved Queries
                </span>
              </div>
              <span className="tabular-nums">Peak daily load: {maxDaily}</span>
            </div>
          </div>
        </section>

        {/* Priority & Category Breakdown */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Priority Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active backlog segmented by SLA severity
            </p>

            <div className="mt-4 divide-y divide-slate-100">
              {analytics.byPriority.map((row) => {
                const pct = Math.round((row.count / analytics.totalTickets) * 100);
                return (
                  <button
                    key={row.priority}
                    type="button"
                    onClick={() => onNavigateQueue({ priority: row.priority })}
                    className="w-full py-2.5 flex items-center justify-between text-left hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`text-sm ${getPriorityTextClass(row.priority)}`}>
                        {row.priority}
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {row.openCount} active
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            row.priority === 'Urgent'
                              ? 'bg-red-600'
                              : row.priority === 'High'
                                ? 'bg-amber-600'
                                : row.priority === 'Medium'
                                  ? 'bg-blue-600'
                                  : 'bg-slate-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-900 w-9 text-right">
                        {row.count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-700 mb-2.5">
              Top Query Categories
            </h3>
            <div className="space-y-2">
              {analytics.byCategory.slice(0, 4).map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-600 truncate pr-3">{cat.category}</span>
                  <span className="font-mono font-medium text-slate-900 tabular-nums">
                    {cat.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Split: Priority Triage Queue + Agent Performance Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Urgent &amp; Escalated Attention Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Open high-severity queries and SLA-sensitive complaints
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateQueue({ priority: 'Urgent', status: 'Active' })}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              View all urgent
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">ID</th>
                  <th className="py-2.5 px-4">Query &amp; Customer</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">SLA / Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {urgentTickets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                      No urgent active queries right now.
                    </td>
                  </tr>
                ) : (
                  urgentTickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTicket(t.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {t.id}
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-medium text-slate-900 truncate">
                          {t.subject}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {t.customerName} · {t.customerCompany} · {formatRelativeTime(t.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-xs inline-flex items-center gap-1.5 ${getStatusTextClass(t.status)}`}>
                          {t.status === 'Escalated' ? (
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : t.status === 'Resolved' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                        <span
                          className={`text-xs font-mono ${
                            t.slaBreached ? 'text-red-600 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          {formatMinutes(t.responseTimeMinutes)} / {formatMinutes(t.slaTargetMinutes)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Specialist Workload &amp; Response
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active queue distribution across support engineers
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {analytics.agentWorkload.map((agent) => (
              <div
                key={agent.agent}
                className="px-6 py-3.5 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {agent.agent}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                    {agent.resolvedTickets} resolved · Avg {formatMinutes(agent.avgResponseMinutes)}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-sm font-semibold font-mono text-slate-900">
                    {agent.activeTickets}
                  </div>
                  <div className="text-[11px] text-slate-500">active</div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Complaint Pipeline
            </span>
            <button
              type="button"
              onClick={onNavigateComplaints}
              className="font-medium text-blue-700 hover:text-blue-800"
            >
              Inspect {analytics.activeComplaintsCount} active
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
