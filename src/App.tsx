import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Inbox,
  Menu,
  Plus,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { fetchAnalytics, fetchTickets } from './api/client.ts';
import {
  NewCustomerModal,
  NewTicketModal,
} from './components/CreateModals.tsx';
import { ComplaintsWorkflowView } from './components/ComplaintsWorkflowView.tsx';
import { CustomersDirectoryView } from './components/CustomersDirectoryView.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { TicketDetailDrawer } from './components/TicketDetailDrawer.tsx';
import { TicketQueueView } from './components/TicketQueueView.tsx';
import type { AnalyticsSummary, TicketWithCustomer } from './types/support.ts';

type WorkspaceTab = 'overview' | 'tickets' | 'complaints' | 'customers';

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'tickets', label: 'Ticket Queue', icon: Inbox },
  { id: 'complaints', label: 'Complaints & SLA', icon: ShieldAlert },
  { id: 'customers', label: 'Customers', icon: Users },
];

const TAB_TITLES: Record<WorkspaceTab, string> = {
  overview: 'Support Operations Overview',
  tickets: 'Customer Query & Ticket Queue',
  complaints: 'Complaint Tracking Workflow',
  customers: 'Customer Records & History',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [urgentTickets, setUrgentTickets] = useState<TicketWithCustomer[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [queuePreset, setQueuePreset] = useState<
    { status?: string; priority?: string; slaBreached?: boolean } | undefined
  >(undefined);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const loadOverviewData = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const [summary, urgentRes] = await Promise.all([
        fetchAnalytics(),
        fetchTickets({
          page: 1,
          limit: 6,
          status: 'Active',
          sortBy: 'priority',
          sortDir: 'desc',
        }),
      ]);
      setAnalytics(summary);
      setUrgentTickets(urgentRes.items);
    } catch (err) {
      setOverviewError(
        err instanceof Error ? err.message : 'Unable to reach support API'
      );
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData, refreshKey]);

  const handleGlobalMutated = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleNavigateQueue = (preset?: {
    status?: string;
    priority?: string;
    slaBreached?: boolean;
  }) => {
    setQueuePreset(preset ? { ...preset } : undefined);
    setActiveTab('tickets');
    setMobileNavOpen(false);
  };

  const handleOpenCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customers');
    setMobileNavOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand Mark */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
            setMobileNavOpen(false);
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          RelayDesk
        </a>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Workspace Navigation */}
      <nav aria-label="Workspace navigation" className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          let countLabel: number | undefined;
          if (analytics) {
            if (item.id === 'tickets') countLabel = analytics.openPendingCount;
            if (item.id === 'complaints') countLabel = analytics.activeComplaintsCount;
            if (item.id === 'customers') countLabel = analytics.totalCustomers;
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileNavOpen(false);
              }}
              className={`w-full h-10 px-3 flex items-center justify-between text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </span>
              {countLabel !== undefined && (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    active ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {countLabel}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Operator Profile */}
      <div className="p-4 border-t border-slate-200 flex items-center gap-3 shrink-0">
        {avatarFailed ? (
          <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            HL
          </div>
        ) : (
          <img
            src="/src/assets/images/avatar_support_lead_1795330010391.jpg"
            alt="Hannah Lindqvist, Support Operations Lead"
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
          />
        )}
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 truncate">
            Hannah Lindqvist
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            Support Operations Lead
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-slate-900/30"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="w-64 h-full" onClick={(e) => e.stopPropagation()}>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Contextual Breadcrumb + Single Primary CTA */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                Workspace
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNewTicketOpen(true)}
              className="h-9 px-4 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New Ticket
            </button>
          </div>
        </header>

        {/* Active Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              analytics={analytics}
              urgentTickets={urgentTickets}
              loading={overviewLoading}
              error={overviewError}
              onRetry={loadOverviewData}
              onSelectTicket={(id) => setSelectedTicketId(id)}
              onNavigateQueue={handleNavigateQueue}
              onNavigateComplaints={() => setActiveTab('complaints')}
            />
          )}

          {activeTab === 'tickets' && (
            <TicketQueueView
              initialFilters={queuePreset}
              refreshKey={refreshKey}
              onSelectTicket={(id) => setSelectedTicketId(id)}
              onCreateTicket={() => setNewTicketOpen(true)}
            />
          )}

          {activeTab === 'complaints' && (
            <ComplaintsWorkflowView
              analytics={analytics}
              refreshKey={refreshKey}
              onSelectTicket={(id) => setSelectedTicketId(id)}
              onTicketMutated={handleGlobalMutated}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersDirectoryView
              selectedCustomerId={selectedCustomerId}
              refreshKey={refreshKey}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
              onSelectTicket={(id) => setSelectedTicketId(id)}
              onCreateCustomer={() => setNewCustomerOpen(true)}
              onCustomerUpdated={handleGlobalMutated}
            />
          )}
        </main>
      </div>

      {/* Interactive Ticket Detail & Interaction Drawer */}
      <TicketDetailDrawer
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        onMutated={handleGlobalMutated}
        onOpenCustomer={handleOpenCustomer}
      />

      {/* Creation Modals */}
      <NewTicketModal
        open={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
        onCreated={(id) => {
          handleGlobalMutated();
          setSelectedTicketId(id);
        }}
      />

      <NewCustomerModal
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        onCreated={(id) => {
          handleGlobalMutated();
          setSelectedCustomerId(id);
        }}
      />
    </div>
  );
}
