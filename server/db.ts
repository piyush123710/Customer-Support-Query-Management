import fs from 'fs';
import path from 'path';
import { MongoClient, type Collection, type Db } from 'mongodb';
import {
  COMPLAINT_STAGES,
  SLA_TARGETS_MINUTES,
  SUPPORT_AGENTS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AnalyticsSummary,
  type ComplaintStage,
  type CustomerAccountStatus,
  type CustomerDetailResponse,
  type CustomerRecord,
  type CustomerTier,
  type CustomerWithStats,
  type Interaction,
  type PaginatedResponse,
  type SupportAgent,
  type TicketCategory,
  type TicketChannel,
  type TicketPriority,
  type TicketRecord,
  type TicketStatus,
  type TicketWithCustomer,
} from '../src/types/support.ts';
import { generateSeedData } from './seed.ts';

interface LocalDatabaseSchema {
  customers: CustomerRecord[];
  tickets: TicketRecord[];
}

export interface TicketQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: TicketStatus | 'Active';
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedAgent?: SupportAgent;
  complaintsOnly?: boolean;
  complaintStage?: ComplaintStage;
  slaBreached?: boolean;
  sortBy: 'createdAt' | 'priority' | 'responseTimeMinutes' | 'status';
  sortDir: 'asc' | 'desc';
}

export interface CustomerQueryParams {
  page: number;
  limit: number;
  search?: string;
  tier?: CustomerTier;
  accountStatus?: CustomerAccountStatus;
}

const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function computeSlaBreached(ticket: TicketRecord, nowMs: number): boolean {
  if (ticket.responseTimeMinutes !== null) {
    return ticket.responseTimeMinutes > ticket.slaTargetMinutes;
  }
  if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
    return false;
  }
  const elapsedMinutes = Math.round(
    (nowMs - new Date(ticket.createdAt).getTime()) / 60_000
  );
  return elapsedMinutes > ticket.slaTargetMinutes;
}

class SupportRepository {
  private storageMode: 'mongodb' | 'local-document-store' = 'local-document-store';
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private customersCol: Collection<CustomerRecord> | null = null;
  private ticketsCol: Collection<TicketRecord> | null = null;
  private dataFilePath: string;
  private cache: LocalDatabaseSchema = { customers: [], tickets: [] };
  private initialized = false;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    this.dataFilePath = path.resolve(dataDir, 'support_db.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const mongoUri = process.env.MONGODB_URI?.trim();
    const dbName = process.env.MONGODB_DB_NAME?.trim() || 'relaydesk_support';

    if (mongoUri) {
      try {
        const client = new MongoClient(mongoUri, {
          serverSelectionTimeoutMS: 4000,
        });
        await client.connect();
        const db = client.db(dbName);
        this.mongoClient = client;
        this.mongoDb = db;
        this.customersCol = db.collection<CustomerRecord>('customers');
        this.ticketsCol = db.collection<TicketRecord>('tickets');

        await this.customersCol.createIndex({ id: 1 }, { unique: true });
        await this.customersCol.createIndex({ email: 1 }, { unique: true });
        await this.ticketsCol.createIndex({ id: 1 }, { unique: true });
        await this.ticketsCol.createIndex({ customerId: 1 });
        await this.ticketsCol.createIndex({ status: 1, priority: 1 });

        const existingCount = await this.ticketsCol.countDocuments();
        if (existingCount === 0) {
          const seed = generateSeedData();
          await this.customersCol.insertMany(seed.customers);
          await this.ticketsCol.insertMany(seed.tickets);
        }

        this.storageMode = 'mongodb';
        this.initialized = true;
        return;
      } catch (err) {
        console.warn(
          '[RelayDesk] MongoDB connection unavailable; falling back to local persistent document store.',
          err instanceof Error ? err.message : ''
        );
      }
    }

    // Local persistent document store
    const dataDir = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(this.dataFilePath)) {
      try {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as LocalDatabaseSchema;
        if (
          Array.isArray(parsed.customers) &&
          Array.isArray(parsed.tickets) &&
          parsed.customers.length > 0 &&
          parsed.tickets.length > 0
        ) {
          this.cache = parsed;
          this.initialized = true;
          return;
        }
      } catch {
        // Re-seed if file is corrupted
      }
    }

    this.cache = generateSeedData();
    this.persistLocal();
    this.initialized = true;
  }

  private persistLocal(): void {
    const tmpPath = `${this.dataFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.cache, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.dataFilePath);
  }

  private async getAllCollections(): Promise<LocalDatabaseSchema> {
    if (this.storageMode === 'mongodb' && this.customersCol && this.ticketsCol) {
      const [customers, tickets] = await Promise.all([
        this.customersCol.find({}, { projection: { _id: 0 } }).toArray(),
        this.ticketsCol.find({}, { projection: { _id: 0 } }).toArray(),
      ]);
      return { customers, tickets };
    }
    return this.cache;
  }

  async getHealth(): Promise<{
    status: 'ok';
    storage: 'mongodb' | 'local-document-store';
    counts: { customers: number; tickets: number };
  }> {
    const { customers, tickets } = await this.getAllCollections();
    return {
      status: 'ok',
      storage: this.storageMode,
      counts: {
        customers: customers.length,
        tickets: tickets.length,
      },
    };
  }

  async listTickets(
    params: TicketQueryParams
  ): Promise<PaginatedResponse<TicketWithCustomer>> {
    const { customers, tickets } = await this.getAllCollections();
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const nowMs = Date.now();

    let enriched: TicketWithCustomer[] = tickets.map((t) => {
      const customer = customerMap.get(t.customerId);
      return {
        ...t,
        customerName: customer?.fullName ?? 'Unknown Customer',
        customerEmail: customer?.email ?? '',
        customerCompany: customer?.company ?? 'Unknown Account',
        customerTier: customer?.tier ?? 'Standard',
        slaBreached: computeSlaBreached(t, nowMs),
      };
    });

    if (params.search) {
      const q = params.search.toLowerCase();
      enriched = enriched.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.customerEmail.toLowerCase().includes(q) ||
          t.customerCompany.toLowerCase().includes(q)
      );
    }

    if (params.status === 'Active') {
      enriched = enriched.filter(
        (t) => t.status !== 'Resolved' && t.status !== 'Closed'
      );
    } else if (params.status) {
      enriched = enriched.filter((t) => t.status === params.status);
    }

    if (params.priority) {
      enriched = enriched.filter((t) => t.priority === params.priority);
    }

    if (params.category) {
      enriched = enriched.filter((t) => t.category === params.category);
    }

    if (params.assignedAgent) {
      enriched = enriched.filter((t) => t.assignedAgent === params.assignedAgent);
    }

    if (params.complaintsOnly) {
      enriched = enriched.filter((t) => t.isComplaint);
    }

    if (params.complaintStage) {
      enriched = enriched.filter((t) => t.complaintStage === params.complaintStage);
    }

    if (params.slaBreached) {
      enriched = enriched.filter((t) => t.slaBreached);
    }

    enriched.sort((a, b) => {
      let cmp = 0;
      if (params.sortBy === 'priority') {
        cmp = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      } else if (params.sortBy === 'responseTimeMinutes') {
        const aVal = a.responseTimeMinutes ?? Number.MAX_SAFE_INTEGER;
        const bVal = b.responseTimeMinutes ?? Number.MAX_SAFE_INTEGER;
        cmp = aVal - bVal;
      } else if (params.sortBy === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return params.sortDir === 'asc' ? cmp : -cmp;
    });

    const total = enriched.length;
    const totalPages = Math.max(1, Math.ceil(total / params.limit));
    const safePage = Math.min(Math.max(1, params.page), totalPages);
    const start = (safePage - 1) * params.limit;
    const items = enriched.slice(start, start + params.limit);

    return {
      items,
      total,
      page: safePage,
      limit: params.limit,
      totalPages,
    };
  }

  async getTicketById(id: string): Promise<{
    ticket: TicketWithCustomer;
    customer: CustomerWithStats | null;
  } | null> {
    const { customers, tickets } = await this.getAllCollections();
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return null;

    const nowMs = Date.now();
    const customer = customers.find((c) => c.id === ticket.customerId) ?? null;

    let customerWithStats: CustomerWithStats | null = null;
    if (customer) {
      const cTickets = tickets.filter((t) => t.customerId === customer.id);
      const responded = cTickets.filter((t) => t.responseTimeMinutes !== null);
      customerWithStats = {
        ...customer,
        totalTickets: cTickets.length,
        openTickets: cTickets.filter(
          (t) => t.status !== 'Resolved' && t.status !== 'Closed'
        ).length,
        complaintsCount: cTickets.filter((t) => t.isComplaint).length,
        avgResponseMinutes:
          responded.length > 0
            ? Math.round(
                responded.reduce((sum, t) => sum + (t.responseTimeMinutes ?? 0), 0) /
                  responded.length
              )
            : null,
      };
    }

    return {
      ticket: {
        ...ticket,
        customerName: customer?.fullName ?? 'Unknown Customer',
        customerEmail: customer?.email ?? '',
        customerCompany: customer?.company ?? 'Unknown Account',
        customerTier: customer?.tier ?? 'Standard',
        slaBreached: computeSlaBreached(ticket, nowMs),
      },
      customer: customerWithStats,
    };
  }

  async createTicket(input: {
    customerId: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    channel: TicketChannel;
    assignedAgent: SupportAgent;
    isComplaint: boolean;
  }): Promise<TicketWithCustomer> {
    const { customers, tickets } = await this.getAllCollections();
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) {
      throw new Error('Customer record not found');
    }

    const maxNumeric = tickets.reduce((max, t) => {
      const n = Number.parseInt(t.id.replace('TKT-', ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 1000);

    const nowIso = new Date().toISOString();
    const newId = `TKT-${maxNumeric + 1}`;
    const newTicket: TicketRecord = {
      id: newId,
      customerId: customer.id,
      subject: input.subject,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: 'Open',
      channel: input.channel,
      assignedAgent: input.assignedAgent,
      isComplaint: input.isComplaint,
      complaintStage: input.isComplaint ? 'Intake' : null,
      slaTargetMinutes: SLA_TARGETS_MINUTES[input.priority],
      responseTimeMinutes: null,
      resolutionTimeMinutes: null,
      createdAt: nowIso,
      firstResponseAt: null,
      resolvedAt: null,
      updatedAt: nowIso,
      interactions: [
        {
          id: `INT-${newId}-1`,
          authorType: 'Customer',
          authorName: customer.fullName,
          message: input.description,
          isInternalNote: false,
          createdAt: nowIso,
        },
      ],
    };

    if (this.storageMode === 'mongodb' && this.ticketsCol && this.customersCol) {
      await this.ticketsCol.insertOne({ ...newTicket });
      await this.customersCol.updateOne(
        { id: customer.id },
        { $set: { lastContactedAt: nowIso } }
      );
    } else {
      this.cache.tickets.unshift(newTicket);
      customer.lastContactedAt = nowIso;
      this.persistLocal();
    }

    return {
      ...newTicket,
      customerName: customer.fullName,
      customerEmail: customer.email,
      customerCompany: customer.company,
      customerTier: customer.tier,
      slaBreached: false,
    };
  }

  async updateTicket(
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
  ): Promise<TicketWithCustomer | null> {
    const { customers, tickets } = await this.getAllCollections();
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return null;

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const changes: string[] = [];

    if (updates.status && updates.status !== ticket.status) {
      changes.push(`Status changed from ${ticket.status} to ${updates.status}`);
      ticket.status = updates.status;

      if (updates.status === 'Resolved' || updates.status === 'Closed') {
        if (!ticket.resolvedAt) {
          ticket.resolvedAt = nowIso;
          ticket.resolutionTimeMinutes = Math.max(
            1,
            Math.round((nowMs - new Date(ticket.createdAt).getTime()) / 60_000)
          );
        }
        if (ticket.isComplaint) {
          ticket.complaintStage = 'Verified Resolved';
        }
      } else {
        ticket.resolvedAt = null;
        ticket.resolutionTimeMinutes = null;
      }
    }

    if (updates.priority && updates.priority !== ticket.priority) {
      changes.push(`Priority changed from ${ticket.priority} to ${updates.priority}`);
      ticket.priority = updates.priority;
      ticket.slaTargetMinutes = SLA_TARGETS_MINUTES[updates.priority];
    }

    if (updates.category && updates.category !== ticket.category) {
      changes.push(`Category updated to ${updates.category}`);
      ticket.category = updates.category;
    }

    if (updates.assignedAgent && updates.assignedAgent !== ticket.assignedAgent) {
      changes.push(`Assigned to ${updates.assignedAgent}`);
      ticket.assignedAgent = updates.assignedAgent;
    }

    if (typeof updates.isComplaint === 'boolean' && updates.isComplaint !== ticket.isComplaint) {
      ticket.isComplaint = updates.isComplaint;
      if (updates.isComplaint && !ticket.complaintStage) {
        ticket.complaintStage = 'Intake';
        changes.push('Flagged as formal complaint workflow (Intake)');
      } else if (!updates.isComplaint) {
        ticket.complaintStage = null;
        changes.push('Removed complaint workflow flag');
      }
    }

    if (updates.complaintStage !== undefined && updates.complaintStage !== ticket.complaintStage) {
      ticket.complaintStage = updates.complaintStage;
      if (updates.complaintStage) {
        ticket.isComplaint = true;
        changes.push(`Complaint stage moved to ${updates.complaintStage}`);
      }
    }

    if (changes.length > 0) {
      ticket.updatedAt = nowIso;
      ticket.interactions.push({
        id: `INT-${ticket.id}-${ticket.interactions.length + 1}`,
        authorType: 'System',
        authorName: updates.actorName || 'Workflow Engine',
        message: `${changes.join('; ')}.`,
        isInternalNote: false,
        createdAt: nowIso,
      });

      if (this.storageMode === 'mongodb' && this.ticketsCol) {
        await this.ticketsCol.updateOne(
          { id: ticket.id },
          {
            $set: {
              status: ticket.status,
              priority: ticket.priority,
              category: ticket.category,
              assignedAgent: ticket.assignedAgent,
              isComplaint: ticket.isComplaint,
              complaintStage: ticket.complaintStage,
              slaTargetMinutes: ticket.slaTargetMinutes,
              resolvedAt: ticket.resolvedAt,
              resolutionTimeMinutes: ticket.resolutionTimeMinutes,
              updatedAt: ticket.updatedAt,
              interactions: ticket.interactions,
            },
          }
        );
      } else {
        this.persistLocal();
      }
    }

    const customer = customers.find((c) => c.id === ticket.customerId);
    return {
      ...ticket,
      customerName: customer?.fullName ?? 'Unknown Customer',
      customerEmail: customer?.email ?? '',
      customerCompany: customer?.company ?? 'Unknown Account',
      customerTier: customer?.tier ?? 'Standard',
      slaBreached: computeSlaBreached(ticket, nowMs),
    };
  }

  async addInteraction(
    ticketId: string,
    input: {
      authorType: 'Customer' | 'Agent';
      authorName: string;
      message: string;
      isInternalNote: boolean;
      nextStatus?: TicketStatus;
    }
  ): Promise<TicketWithCustomer | null> {
    const { customers, tickets } = await this.getAllCollections();
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return null;

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const interaction: Interaction = {
      id: `INT-${ticket.id}-${ticket.interactions.length + 1}`,
      authorType: input.authorType,
      authorName: input.authorName,
      message: input.message,
      isInternalNote: input.isInternalNote,
      createdAt: nowIso,
    };

    ticket.interactions.push(interaction);
    ticket.updatedAt = nowIso;

    // Record first response SLA if this is a public Agent reply
    if (input.authorType === 'Agent' && !input.isInternalNote && !ticket.firstResponseAt) {
      ticket.firstResponseAt = nowIso;
      ticket.responseTimeMinutes = Math.max(
        1,
        Math.round((nowMs - new Date(ticket.createdAt).getTime()) / 60_000)
      );
      if (ticket.status === 'Open') {
        ticket.status = 'In Progress';
      }
    }

    if (input.nextStatus && input.nextStatus !== ticket.status) {
      ticket.status = input.nextStatus;
      if (input.nextStatus === 'Resolved' || input.nextStatus === 'Closed') {
        ticket.resolvedAt = nowIso;
        ticket.resolutionTimeMinutes = Math.max(
          1,
          Math.round((nowMs - new Date(ticket.createdAt).getTime()) / 60_000)
        );
        if (ticket.isComplaint) {
          ticket.complaintStage = 'Verified Resolved';
        }
      } else {
        ticket.resolvedAt = null;
        ticket.resolutionTimeMinutes = null;
      }
    }

    const customer = customers.find((c) => c.id === ticket.customerId);
    if (customer) {
      customer.lastContactedAt = nowIso;
    }

    if (this.storageMode === 'mongodb' && this.ticketsCol && this.customersCol) {
      await this.ticketsCol.updateOne(
        { id: ticket.id },
        {
          $set: {
            status: ticket.status,
            firstResponseAt: ticket.firstResponseAt,
            responseTimeMinutes: ticket.responseTimeMinutes,
            resolvedAt: ticket.resolvedAt,
            resolutionTimeMinutes: ticket.resolutionTimeMinutes,
            complaintStage: ticket.complaintStage,
            updatedAt: ticket.updatedAt,
            interactions: ticket.interactions,
          },
        }
      );
      if (customer) {
        await this.customersCol.updateOne(
          { id: customer.id },
          { $set: { lastContactedAt: nowIso } }
        );
      }
    } else {
      this.persistLocal();
    }

    return {
      ...ticket,
      customerName: customer?.fullName ?? 'Unknown Customer',
      customerEmail: customer?.email ?? '',
      customerCompany: customer?.company ?? 'Unknown Account',
      customerTier: customer?.tier ?? 'Standard',
      slaBreached: computeSlaBreached(ticket, nowMs),
    };
  }

  async deleteTicket(id: string): Promise<boolean> {
    if (this.storageMode === 'mongodb' && this.ticketsCol) {
      const res = await this.ticketsCol.deleteOne({ id });
      return res.deletedCount > 0;
    }
    const idx = this.cache.tickets.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.cache.tickets.splice(idx, 1);
    this.persistLocal();
    return true;
  }

  async listCustomers(
    params: CustomerQueryParams
  ): Promise<PaginatedResponse<CustomerWithStats>> {
    const { customers, tickets } = await this.getAllCollections();

    const statsByCustomer = new Map<
      string,
      { total: number; open: number; complaints: number; respSum: number; respCount: number }
    >();

    for (const t of tickets) {
      let s = statsByCustomer.get(t.customerId);
      if (!s) {
        s = { total: 0, open: 0, complaints: 0, respSum: 0, respCount: 0 };
        statsByCustomer.set(t.customerId, s);
      }
      s.total += 1;
      if (t.status !== 'Resolved' && t.status !== 'Closed') s.open += 1;
      if (t.isComplaint) s.complaints += 1;
      if (t.responseTimeMinutes !== null) {
        s.respSum += t.responseTimeMinutes;
        s.respCount += 1;
      }
    }

    let enriched: CustomerWithStats[] = customers.map((c) => {
      const s = statsByCustomer.get(c.id);
      return {
        ...c,
        totalTickets: s?.total ?? 0,
        openTickets: s?.open ?? 0,
        complaintsCount: s?.complaints ?? 0,
        avgResponseMinutes:
          s && s.respCount > 0 ? Math.round(s.respSum / s.respCount) : null,
      };
    });

    if (params.search) {
      const q = params.search.toLowerCase();
      enriched = enriched.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.fullName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q)
      );
    }

    if (params.tier) {
      enriched = enriched.filter((c) => c.tier === params.tier);
    }

    if (params.accountStatus) {
      enriched = enriched.filter((c) => c.accountStatus === params.accountStatus);
    }

    enriched.sort(
      (a, b) =>
        new Date(b.lastContactedAt).getTime() - new Date(a.lastContactedAt).getTime()
    );

    const total = enriched.length;
    const totalPages = Math.max(1, Math.ceil(total / params.limit));
    const safePage = Math.min(Math.max(1, params.page), totalPages);
    const start = (safePage - 1) * params.limit;

    return {
      items: enriched.slice(start, start + params.limit),
      total,
      page: safePage,
      limit: params.limit,
      totalPages,
    };
  }

  async getCustomerById(id: string): Promise<CustomerDetailResponse | null> {
    const { customers, tickets } = await this.getAllCollections();
    const customer = customers.find((c) => c.id === id);
    if (!customer) return null;

    const cTickets = tickets
      .filter((t) => t.customerId === id)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const responded = cTickets.filter((t) => t.responseTimeMinutes !== null);
    const customerWithStats: CustomerWithStats = {
      ...customer,
      totalTickets: cTickets.length,
      openTickets: cTickets.filter(
        (t) => t.status !== 'Resolved' && t.status !== 'Closed'
      ).length,
      complaintsCount: cTickets.filter((t) => t.isComplaint).length,
      avgResponseMinutes:
        responded.length > 0
          ? Math.round(
              responded.reduce((sum, t) => sum + (t.responseTimeMinutes ?? 0), 0) /
                responded.length
            )
          : null,
    };

    const timeline = cTickets
      .flatMap((t) =>
        t.interactions.map((int) => ({
          ...int,
          ticketId: t.id,
          ticketSubject: t.subject,
        }))
      )
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return {
      customer: customerWithStats,
      tickets: cTickets,
      timeline,
    };
  }

  async createCustomer(input: {
    fullName: string;
    email: string;
    phone: string;
    company: string;
    tier: CustomerTier;
    region: CustomerRecord['region'];
    accountStatus: CustomerAccountStatus;
    notes: string;
  }): Promise<CustomerWithStats> {
    const { customers } = await this.getAllCollections();
    const normalizedEmail = input.email.toLowerCase();
    if (customers.some((c) => c.email.toLowerCase() === normalizedEmail)) {
      throw new Error('A customer profile with this email already exists');
    }

    const maxNumeric = customers.reduce((max, c) => {
      const n = Number.parseInt(c.id.replace('CUS-', ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 1000);

    const nowIso = new Date().toISOString();
    const record: CustomerRecord = {
      id: `CUS-${maxNumeric + 1}`,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      company: input.company,
      tier: input.tier,
      region: input.region,
      accountStatus: input.accountStatus,
      satisfactionScore: 5.0,
      notes: input.notes,
      createdAt: nowIso,
      lastContactedAt: nowIso,
    };

    if (this.storageMode === 'mongodb' && this.customersCol) {
      await this.customersCol.insertOne({ ...record });
    } else {
      this.cache.customers.unshift(record);
      this.persistLocal();
    }

    return {
      ...record,
      totalTickets: 0,
      openTickets: 0,
      complaintsCount: 0,
      avgResponseMinutes: null,
    };
  }

  async updateCustomer(
    id: string,
    updates: Partial<
      Pick<
        CustomerRecord,
        'fullName' | 'phone' | 'company' | 'tier' | 'region' | 'accountStatus' | 'notes'
      >
    >
  ): Promise<CustomerRecord | null> {
    const { customers } = await this.getAllCollections();
    const customer = customers.find((c) => c.id === id);
    if (!customer) return null;

    if (updates.fullName) customer.fullName = updates.fullName;
    if (updates.phone) customer.phone = updates.phone;
    if (updates.company) customer.company = updates.company;
    if (updates.tier) customer.tier = updates.tier;
    if (updates.region) customer.region = updates.region;
    if (updates.accountStatus) customer.accountStatus = updates.accountStatus;
    if (typeof updates.notes === 'string') customer.notes = updates.notes;

    if (this.storageMode === 'mongodb' && this.customersCol) {
      await this.customersCol.updateOne(
        { id },
        {
          $set: {
            fullName: customer.fullName,
            phone: customer.phone,
            company: customer.company,
            tier: customer.tier,
            region: customer.region,
            accountStatus: customer.accountStatus,
            notes: customer.notes,
          },
        }
      );
    } else {
      this.persistLocal();
    }

    return customer;
  }

  async getAnalytics(): Promise<AnalyticsSummary> {
    const { customers, tickets } = await this.getAllCollections();
    const nowMs = Date.now();

    const openPendingCount = tickets.filter(
      (t) => t.status !== 'Resolved' && t.status !== 'Closed'
    ).length;
    const escalatedCount = tickets.filter((t) => t.status === 'Escalated').length;
    const resolvedCount = tickets.filter(
      (t) => t.status === 'Resolved' || t.status === 'Closed'
    ).length;
    const activeComplaintsCount = tickets.filter(
      (t) => t.isComplaint && t.status !== 'Resolved' && t.status !== 'Closed'
    ).length;

    const slaBreachedCount = tickets.filter((t) =>
      computeSlaBreached(t, nowMs)
    ).length;

    const responded = tickets.filter((t) => t.responseTimeMinutes !== null);
    const avgFirstResponseMinutes =
      responded.length > 0
        ? Math.round(
            responded.reduce((sum, t) => sum + (t.responseTimeMinutes ?? 0), 0) /
              responded.length
          )
        : 0;

    const resolved = tickets.filter((t) => t.resolutionTimeMinutes !== null);
    const avgResolutionHours =
      resolved.length > 0
        ? Number(
            (
              resolved.reduce((sum, t) => sum + (t.resolutionTimeMinutes ?? 0), 0) /
              resolved.length /
              60
            ).toFixed(1)
          )
        : 0;

    const slaComplianceRate =
      tickets.length > 0
        ? Number(
            (((tickets.length - slaBreachedCount) / tickets.length) * 100).toFixed(1)
          )
        : 100;

    const byPriority = TICKET_PRIORITIES.map((priority) => ({
      priority,
      count: tickets.filter((t) => t.priority === priority).length,
      openCount: tickets.filter(
        (t) =>
          t.priority === priority &&
          t.status !== 'Resolved' &&
          t.status !== 'Closed'
      ).length,
    }));

    const byStatus = TICKET_STATUSES.map((status) => ({
      status,
      count: tickets.filter((t) => t.status === status).length,
    }));

    const byCategory = TICKET_CATEGORIES.map((category) => ({
      category,
      count: tickets.filter((t) => t.category === category).length,
    })).sort((a, b) => b.count - a.count);

    const complaintFunnel = COMPLAINT_STAGES.map((stage) => {
      const matched = tickets.filter((t) => t.isComplaint && t.complaintStage === stage);
      const withResp = matched.filter((t) => t.responseTimeMinutes !== null);
      return {
        stage,
        count: matched.length,
        avgResponseMinutes:
          withResp.length > 0
            ? Math.round(
                withResp.reduce((s, t) => s + (t.responseTimeMinutes ?? 0), 0) /
                  withResp.length
              )
            : 0,
      };
    });

    // 14-day daily trend
    const dailyTrend: AnalyticsSummary['dailyTrend'] = [];
    for (let offset = 13; offset >= 0; offset--) {
      const d = new Date(nowMs - offset * 86400_000);
      const isoDate = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const created = tickets.filter((t) => t.createdAt.slice(0, 10) === isoDate).length;
      const resolvedOnDay = tickets.filter(
        (t) => t.resolvedAt && t.resolvedAt.slice(0, 10) === isoDate
      ).length;
      dailyTrend.push({
        date: isoDate,
        label,
        created,
        resolved: resolvedOnDay,
      });
    }

    const agentWorkload = SUPPORT_AGENTS.filter((a) => a !== 'Unassigned').map(
      (agent) => {
        const assigned = tickets.filter((t) => t.assignedAgent === agent);
        const agentResp = assigned.filter((t) => t.responseTimeMinutes !== null);
        return {
          agent,
          activeTickets: assigned.filter(
            (t) => t.status !== 'Resolved' && t.status !== 'Closed'
          ).length,
          resolvedTickets: assigned.filter(
            (t) => t.status === 'Resolved' || t.status === 'Closed'
          ).length,
          avgResponseMinutes:
            agentResp.length > 0
              ? Math.round(
                  agentResp.reduce((s, t) => s + (t.responseTimeMinutes ?? 0), 0) /
                    agentResp.length
                )
              : 0,
        };
      }
    );

    return {
      totalTickets: tickets.length,
      totalCustomers: customers.length,
      openPendingCount,
      escalatedCount,
      resolvedCount,
      activeComplaintsCount,
      slaBreachedCount,
      avgFirstResponseMinutes,
      avgResolutionHours,
      slaComplianceRate,
      byPriority,
      byStatus,
      byCategory,
      complaintFunnel,
      dailyTrend,
      agentWorkload,
      storageMode: this.storageMode,
    };
  }
}

export const supportRepo = new SupportRepository();
