import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  X,
} from 'lucide-react';
import { fetchTickets } from '../api/client.ts';
import {
  SUPPORT_AGENTS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type PaginatedResponse,
  type SupportAgent,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TicketWithCustomer,
} from '../types/support.ts';
import {
  formatMinutes,
  formatRelativeTime,
  getPriorityTextClass,
  getStatusTextClass,
} from '../utils/format.ts';

interface TicketQueueViewProps {
  initialFilters?: {
    status?: string;
    priority?: string;
    slaBreached?: boolean;
  };
  refreshKey: number;
  onSelectTicket: (ticketId: string) => void;
  onCreateTicket: () => void;
}

const STATUS_TABS: Array<{ label: string; value: TicketStatus | 'Active' | '' }> = [
  { label: 'All Queries', value: '' },
  { label: 'Active', value: 'Active' },
  { label: 'Open', value: 'Open' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Pending Customer', value: 'Pending Customer' },
  { label: 'Escalated', value: 'Escalated' },
  { label: 'Resolved', value: 'Resolved' },
];

export function TicketQueueView({
  initialFilters,
  refreshKey,
  onSelectTicket,
  onCreateTicket,
}: TicketQueueViewProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'Active' | ''>(
    (initialFilters?.status as TicketStatus | 'Active' | '') ?? ''
  );
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>(
    (initialFilters?.priority as TicketPriority | '') ?? ''
  );
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | ''>('');
  const [agentFilter, setAgentFilter] = useState<SupportAgent | ''>('');
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(
    Boolean(initialFilters?.slaBreached)
  );
  const [sortBy, setSortBy] = useState<
    'createdAt' | 'priority' | 'responseTimeMinutes' | 'status'
  >('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedResponse<TicketWithCustomer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilters) {
      setStatusFilter((initialFilters.status as TicketStatus | 'Active' | '') ?? '');
      setPriorityFilter((initialFilters.priority as TicketPriority | '') ?? '');
      setSlaBreachedOnly(Boolean(initialFilters.slaBreached));
      setPage(1);
    }
  }, [initialFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchTickets({
      page,
      limit: 25,
      search: debouncedSearch,
      status: statusFilter,
      priority: priorityFilter,
      category: categoryFilter,
      assignedAgent: agentFilter,
      slaBreached: slaBreachedOnly,
      sortBy,
      sortDir,
    })
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load tickets');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    page,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    categoryFilter,
    agentFilter,
    slaBreachedOnly,
    sortBy,
    sortDir,
    refreshKey,
  ]);

  const toggleSort = (field: 'createdAt' | 'priority' | 'responseTimeMinutes') => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setAgentFilter('');
    setSlaBreachedOnly(false);
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    Boolean(statusFilter) ||
    Boolean(priorityFilter) ||
    Boolean(categoryFilter) ||
    Boolean(agentFilter) ||
    slaBreachedOnly;

  const startItem = data && data.total > 0 ? (data.page - 1) * data.limit + 1 : 0;
  const endItem = data ? Math.min(data.page * data.limit, data.total) : 0;

  return (
    <div className="space-y-4">
      {/* Status Segmented Tabs + Search & Dropdown Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter tickets by status"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 tabular-nums">
            {data ? `${data.total} matching queries` : 'Loading queue...'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ticket ID, subject, customer, email..."
              aria-label="Search tickets"
              className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value as TicketPriority | '');
              setPage(1);
            }}
            aria-label="Filter by priority"
            className="h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Priorities</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as TicketCategory | '');
              setPage(1);
            }}
            aria-label="Filter by category"
            className="h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Categories</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={agentFilter}
            onChange={(e) => {
              setAgentFilter(e.target.value as SupportAgent | '');
              setPage(1);
            }}
            aria-label="Filter by assigned agent"
            className="h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Assignees</option>
            {SUPPORT_AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSlaBreachedOnly((prev) => !prev);
                setPage(1);
              }}
              className={`flex-1 h-10 px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                slaBreachedOnly
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              SLA Breached
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                aria-label="Reset all filters"
                className="h-10 px-2.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Queue Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-900">Error loading ticket queue</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              type="button"
              onClick={() => setPage((p) => p)}
              className="mt-3 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">Ticket ID</th>
                  <th className="py-3 px-4">Subject &amp; Customer</th>
                  <th className="py-3 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('priority')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Priority
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('responseTimeMinutes')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Response / SLA
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Assignee</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('createdAt')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Created
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
                        <div className="h-3 w-44 bg-slate-50 rounded mt-1.5 animate-pulse" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-14 bg-slate-100 rounded animate-pulse" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-16 ml-auto bg-slate-100 rounded animate-pulse" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-14 ml-auto bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 px-4 text-center">
                      <p className="text-sm font-medium text-slate-900">
                        No support queries match your current filters
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Clear active filters or create a new customer support ticket.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-3">
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                          >
                            Reset Filters
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onCreateTicket}
                          className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                          New Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.items.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => onSelectTicket(ticket.id)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {ticket.id}
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-medium text-slate-900 truncate">
                          {ticket.subject}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {ticket.customerName} · {ticket.customerCompany} · {ticket.channel}
                          {ticket.isComplaint ? ' · Formal Complaint' : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {ticket.category}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span className={getPriorityTextClass(ticket.priority)}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 ${getStatusTextClass(ticket.status)}`}>
                          {ticket.status === 'Escalated' ? (
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                        <span
                          className={`font-mono text-xs ${
                            ticket.slaBreached
                              ? 'text-red-600 font-semibold'
                              : 'text-slate-700'
                          }`}
                        >
                          {formatMinutes(ticket.responseTimeMinutes)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {' '}
                          / {formatMinutes(ticket.slaTargetMinutes)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {ticket.assignedAgent}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {formatRelativeTime(ticket.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.total > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
            <div className="tabular-nums">
              Showing {startItem}–{endItem} of {data.total} queries
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2.5 inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Previous
              </button>
              <span className="px-2 font-mono tabular-nums">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="h-8 px-2.5 inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
