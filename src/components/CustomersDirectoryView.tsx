import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Save,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import {
  fetchCustomerDetail,
  fetchCustomers,
  updateCustomer,
} from '../api/client.ts';
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TIERS,
  type CustomerAccountStatus,
  type CustomerDetailResponse,
  type CustomerTier,
  type CustomerWithStats,
  type PaginatedResponse,
} from '../types/support.ts';
import {
  formatDateTime,
  formatMinutes,
  formatRelativeTime,
  getPriorityTextClass,
  getStatusTextClass,
} from '../utils/format.ts';

interface CustomersDirectoryViewProps {
  selectedCustomerId: string | null;
  refreshKey: number;
  onSelectCustomer: (customerId: string | null) => void;
  onSelectTicket: (ticketId: string) => void;
  onCreateCustomer: () => void;
  onCustomerUpdated: () => void;
}

export function CustomersDirectoryView({
  selectedCustomerId,
  refreshKey,
  onSelectCustomer,
  onSelectTicket,
  onCreateCustomer,
  onCustomerUpdated,
}: CustomersDirectoryViewProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<CustomerTier | ''>('');
  const [statusFilter, setStatusFilter] = useState<CustomerAccountStatus | ''>('');
  const [page, setPage] = useState(1);

  const [listData, setListData] = useState<PaginatedResponse<CustomerWithStats> | null>(
    null
  );
  const [listLoading, setListLoading] = useState(true);

  const [detail, setDetail] = useState<CustomerDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Editable customer form state
  const [editPhone, setEditPhone] = useState('');
  const [editTier, setEditTier] = useState<CustomerTier>('Standard');
  const [editStatus, setEditStatus] = useState<CustomerAccountStatus>('Active');
  const [editNotes, setEditNotes] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setListLoading(true);
    fetchCustomers({
      page,
      limit: 20,
      search: debouncedSearch,
      tier: tierFilter,
      accountStatus: statusFilter,
    })
      .then((res) => {
        if (active) setListData(res);
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, debouncedSearch, tierFilter, statusFilter, refreshKey]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setSaveMessage(null);
    fetchCustomerDetail(selectedCustomerId)
      .then((res) => {
        if (!active) return;
        setDetail(res);
        setEditPhone(res.customer.phone);
        setEditTier(res.customer.tier);
        setEditStatus(res.customer.accountStatus);
        setEditNotes(res.customer.notes);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCustomerId, refreshKey]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSavingProfile(true);
    setSaveMessage(null);
    try {
      await updateCustomer(detail.customer.id, {
        phone: editPhone,
        tier: editTier,
        accountStatus: editStatus,
        notes: editNotes,
      });
      setSaveMessage('Customer record saved');
      onCustomerUpdated();
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save changes');
    } finally {
      setSavingProfile(false);
    }
  };

  const startItem =
    listData && listData.total > 0 ? (listData.page - 1) * listData.limit + 1 : 0;
  const endItem = listData
    ? Math.min(listData.page * listData.limit, listData.total)
    : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Customer Directory Table */}
      <div
        className={`${
          selectedCustomerId ? 'xl:col-span-7' : 'xl:col-span-12'
        } space-y-4`}
      >
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-64">
              <div className="relative flex-1 min-w-56">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search customer ID, name, email, or company..."
                  aria-label="Search customers"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => {
                  setTierFilter(e.target.value as CustomerTier | '');
                  setPage(1);
                }}
                aria-label="Filter by customer tier"
                className="h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="">All Tiers</option>
                {CUSTOMER_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as CustomerAccountStatus | '');
                  setPage(1);
                }}
                aria-label="Filter by account status"
                className="h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="">All Account States</option>
                {CUSTOMER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onCreateCustomer}
              className="h-10 px-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add Customer
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">Profile ID</th>
                  <th className="py-3 px-4">Customer &amp; Organization</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tier</th>
                  <th className="py-3 px-4 whitespace-nowrap">Account State</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Queries</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Last Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {listLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-4 px-4">
                        <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : !listData || listData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      No customer profiles match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  listData.items.map((c) => {
                    const isSelected = c.id === selectedCustomerId;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onSelectCustomer(c.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {c.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{c.fullName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {c.company} · {c.email}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                          {c.tier}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <span
                            className={
                              c.accountStatus === 'At Risk'
                                ? 'text-red-600 font-semibold'
                                : c.accountStatus === 'Onboarding'
                                  ? 'text-blue-700 font-medium'
                                  : 'text-emerald-700 font-medium'
                            }
                          >
                            {c.accountStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-mono tabular-nums whitespace-nowrap">
                          <span className="text-slate-900 font-medium">
                            {c.totalTickets}
                          </span>
                          {c.openTickets > 0 && (
                            <span className="text-blue-700"> ({c.openTickets} open)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {formatRelativeTime(c.lastContactedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {listData && listData.total > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600 tabular-nums">
              <span>
                Showing {startItem}–{endItem} of {listData.total} profiles
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={listData.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Previous
                </button>
                <span className="font-mono">
                  {listData.page} / {listData.totalPages}
                </span>
                <button
                  type="button"
                  disabled={listData.page >= listData.totalPages}
                  onClick={() => setPage((p) => Math.min(listData.totalPages, p + 1))}
                  className="h-8 px-2.5 inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Customer Record & Unified Interaction History */}
      {selectedCustomerId && (
        <aside
          aria-label="Customer record inspector"
          className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden"
        >
          {detailLoading || !detail ? (
            <div className="p-6 space-y-4">
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
              <div className="h-32 w-full bg-slate-50 rounded animate-pulse" />
            </div>
          ) : (
            <div>
              <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                    <span>{detail.customer.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{detail.customer.region}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                    {detail.customer.fullName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {detail.customer.company} · {detail.customer.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectCustomer(null)}
                  aria-label="Close customer profile"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Aggregated Account Telemetry */}
              <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/50 text-center">
                <div className="py-3 px-2">
                  <div className="text-[11px] text-slate-500">Queries</div>
                  <div className="text-sm font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
                    {detail.customer.totalTickets}
                  </div>
                </div>
                <div className="py-3 px-2">
                  <div className="text-[11px] text-slate-500">Open</div>
                  <div className="text-sm font-semibold font-mono text-blue-700 tabular-nums mt-0.5">
                    {detail.customer.openTickets}
                  </div>
                </div>
                <div className="py-3 px-2">
                  <div className="text-[11px] text-slate-500">Complaints</div>
                  <div className="text-sm font-semibold font-mono text-amber-700 tabular-nums mt-0.5">
                    {detail.customer.complaintsCount}
                  </div>
                </div>
                <div className="py-3 px-2">
                  <div className="text-[11px] text-slate-500">Avg Resp</div>
                  <div className="text-sm font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
                    {formatMinutes(detail.customer.avgResponseMinutes)}
                  </div>
                </div>
              </div>

              {/* Editable Profile Details */}
              <form
                onSubmit={handleSaveProfile}
                className="p-6 border-b border-slate-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    Account Record
                  </h3>
                  {saveMessage && (
                    <span className="text-xs text-emerald-700 font-medium">
                      {saveMessage}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Account Tier
                    </label>
                    <select
                      value={editTier}
                      onChange={(e) => setEditTier(e.target.value as CustomerTier)}
                      className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    >
                      {CUSTOMER_TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Account State
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) =>
                        setEditStatus(e.target.value as CustomerAccountStatus)
                      }
                      className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    >
                      {CUSTOMER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Account Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                    {savingProfile ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </form>

              {/* Ticket History */}
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-700 mb-3">
                  Support Tickets ({detail.tickets.length})
                </h3>
                {detail.tickets.length === 0 ? (
                  <p className="text-xs text-slate-500">No support queries logged yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {detail.tickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTicket(t.id)}
                        className="w-full py-2.5 text-left hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-slate-500">{t.id}</span>
                          <div className="flex items-center gap-2">
                            <span className={getPriorityTextClass(t.priority)}>
                              {t.priority}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className={getStatusTextClass(t.status)}>
                              {t.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs font-medium text-slate-900 truncate mt-1">
                          {t.subject}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Unified Cross-Ticket Interaction Timeline */}
              <div className="p-6">
                <h3 className="text-xs font-semibold text-slate-700 mb-3">
                  Interaction History ({detail.timeline.length})
                </h3>
                {detail.timeline.length === 0 ? (
                  <p className="text-xs text-slate-500">No interactions recorded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {detail.timeline.map((item) => (
                      <div
                        key={`${item.ticketId}-${item.id}`}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-md"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="font-medium text-slate-800">
                            {item.authorName} ({item.authorType}
                            {item.isInternalNote ? ' · Internal' : ''})
                          </span>
                          <span className="tabular-nums">
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                          {item.message}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectTicket(item.ticketId)}
                          className="mt-1.5 text-[11px] font-mono text-blue-700 hover:underline"
                        >
                          {item.ticketId} · {item.ticketSubject}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
