export const TICKET_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = [
  'Open',
  'In Progress',
  'Pending Customer',
  'Escalated',
  'Resolved',
  'Closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = [
  'Technical Bug',
  'Billing & Invoices',
  'Account Access',
  'API & Integrations',
  'Service Complaint',
  'Feature Request',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CHANNELS = ['Email', 'Web Portal', 'Live Chat', 'Phone'] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export const COMPLAINT_STAGES = [
  'Intake',
  'Investigation',
  'Remediation',
  'Verified Resolved',
] as const;
export type ComplaintStage = (typeof COMPLAINT_STAGES)[number];

export const CUSTOMER_TIERS = ['Enterprise', 'Growth', 'Standard'] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const CUSTOMER_STATUSES = ['Active', 'At Risk', 'Onboarding'] as const;
export type CustomerAccountStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_REGIONS = [
  'North America',
  'Europe',
  'Asia-Pacific',
  'Latin America',
] as const;
export type CustomerRegion = (typeof CUSTOMER_REGIONS)[number];

export const SUPPORT_AGENTS = [
  'Hannah Lindqvist',
  'Arjun Mehta',
  'Claire Bennett',
  'Mateo Silva',
  'Nadia Kowalski',
  'Unassigned',
] as const;
export type SupportAgent = (typeof SUPPORT_AGENTS)[number];

export const SLA_TARGETS_MINUTES: Record<TicketPriority, number> = {
  Urgent: 60,
  High: 240,
  Medium: 480,
  Low: 1440,
};

export interface Interaction {
  id: string;
  authorType: 'Customer' | 'Agent' | 'System';
  authorName: string;
  message: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  tier: CustomerTier;
  region: CustomerRegion;
  accountStatus: CustomerAccountStatus;
  satisfactionScore: number;
  notes: string;
  createdAt: string;
  lastContactedAt: string;
}

export interface CustomerWithStats extends CustomerRecord {
  totalTickets: number;
  openTickets: number;
  complaintsCount: number;
  avgResponseMinutes: number | null;
}

export interface TicketRecord {
  id: string;
  customerId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  channel: TicketChannel;
  assignedAgent: SupportAgent;
  isComplaint: boolean;
  complaintStage: ComplaintStage | null;
  slaTargetMinutes: number;
  responseTimeMinutes: number | null;
  resolutionTimeMinutes: number | null;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  updatedAt: string;
  interactions: Interaction[];
}

export interface TicketWithCustomer extends TicketRecord {
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  customerTier: CustomerTier;
  slaBreached: boolean;
}

export interface CustomerDetailResponse {
  customer: CustomerWithStats;
  tickets: TicketRecord[];
  timeline: Array<Interaction & { ticketId: string; ticketSubject: string }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AnalyticsSummary {
  totalTickets: number;
  totalCustomers: number;
  openPendingCount: number;
  escalatedCount: number;
  resolvedCount: number;
  activeComplaintsCount: number;
  slaBreachedCount: number;
  avgFirstResponseMinutes: number;
  avgResolutionHours: number;
  slaComplianceRate: number;
  byPriority: Array<{ priority: TicketPriority; count: number; openCount: number }>;
  byStatus: Array<{ status: TicketStatus; count: number }>;
  byCategory: Array<{ category: TicketCategory; count: number }>;
  complaintFunnel: Array<{ stage: ComplaintStage; count: number; avgResponseMinutes: number }>;
  dailyTrend: Array<{ date: string; label: string; created: number; resolved: number }>;
  agentWorkload: Array<{ agent: string; activeTickets: number; resolvedTickets: number; avgResponseMinutes: number }>;
  storageMode: 'mongodb' | 'local-document-store';
}
