import type {
  AnalyticsSummary,
  ComplaintStage,
  CustomerAccountStatus,
  CustomerDetailResponse,
  CustomerRecord,
  CustomerRegion,
  CustomerTier,
  CustomerWithStats,
  PaginatedResponse,
  SupportAgent,
  TicketCategory,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketWithCustomer,
} from '../types/support.ts';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // Ignore parse failure
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export interface FetchTicketsOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: TicketStatus | 'Active' | '';
  priority?: TicketPriority | '';
  category?: TicketCategory | '';
  assignedAgent?: SupportAgent | '';
  complaintsOnly?: boolean;
  complaintStage?: ComplaintStage | '';
  slaBreached?: boolean;
  sortBy?: 'createdAt' | 'priority' | 'responseTimeMinutes' | 'status';
  sortDir?: 'asc' | 'desc';
}

export function fetchAnalytics(): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>('/api/analytics');
}

export function fetchTickets(
  opts: FetchTicketsOptions = {}
): Promise<PaginatedResponse<TicketWithCustomer>> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.search) params.set('search', opts.search);
  if (opts.status) params.set('status', opts.status);
  if (opts.priority) params.set('priority', opts.priority);
  if (opts.category) params.set('category', opts.category);
  if (opts.assignedAgent) params.set('assignedAgent', opts.assignedAgent);
  if (opts.complaintsOnly) params.set('complaintsOnly', 'true');
  if (opts.complaintStage) params.set('complaintStage', opts.complaintStage);
  if (opts.slaBreached) params.set('slaBreached', 'true');
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.sortDir) params.set('sortDir', opts.sortDir);

  return request<PaginatedResponse<TicketWithCustomer>>(
    `/api/tickets?${params.toString()}`
  );
}

export function fetchTicketDetail(id: string): Promise<{
  ticket: TicketWithCustomer;
  customer: CustomerWithStats | null;
}> {
  return request(`/api/tickets/${encodeURIComponent(id)}`);
}

export function createTicket(input: {
  customerId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  channel: TicketChannel;
  assignedAgent: SupportAgent;
  isComplaint: boolean;
}): Promise<TicketWithCustomer> {
  return request<TicketWithCustomer>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTicket(
  id: string,
  updates: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignedAgent?: SupportAgent;
    isComplaint?: boolean;
    complaintStage?: ComplaintStage | null;
    actorName?: string;
  }
): Promise<TicketWithCustomer> {
  return request<TicketWithCustomer>(`/api/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function addTicketInteraction(
  ticketId: string,
  input: {
    authorType: 'Customer' | 'Agent';
    authorName: string;
    message: string;
    isInternalNote: boolean;
    nextStatus?: TicketStatus;
  }
): Promise<TicketWithCustomer> {
  return request<TicketWithCustomer>(
    `/api/tickets/${encodeURIComponent(ticketId)}/interactions`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export function deleteTicket(id: string): Promise<{ deleted: boolean; id: string }> {
  return request(`/api/tickets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function fetchCustomers(opts: {
  page?: number;
  limit?: number;
  search?: string;
  tier?: CustomerTier | '';
  accountStatus?: CustomerAccountStatus | '';
} = {}): Promise<PaginatedResponse<CustomerWithStats>> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.search) params.set('search', opts.search);
  if (opts.tier) params.set('tier', opts.tier);
  if (opts.accountStatus) params.set('accountStatus', opts.accountStatus);
  return request<PaginatedResponse<CustomerWithStats>>(
    `/api/customers?${params.toString()}`
  );
}

export function fetchCustomerDetail(id: string): Promise<CustomerDetailResponse> {
  return request<CustomerDetailResponse>(
    `/api/customers/${encodeURIComponent(id)}`
  );
}

export function createCustomer(input: {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  tier: CustomerTier;
  region: CustomerRegion;
  accountStatus: CustomerAccountStatus;
  notes: string;
}): Promise<CustomerWithStats> {
  return request<CustomerWithStats>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCustomer(
  id: string,
  updates: Partial<
    Pick<
      CustomerRecord,
      'fullName' | 'phone' | 'company' | 'tier' | 'region' | 'accountStatus' | 'notes'
    >
  >
): Promise<CustomerRecord> {
  return request<CustomerRecord>(`/api/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
