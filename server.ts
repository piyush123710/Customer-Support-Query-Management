import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  COMPLAINT_STAGES,
  CUSTOMER_REGIONS,
  CUSTOMER_STATUSES,
  CUSTOMER_TIERS,
  SUPPORT_AGENTS,
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type ComplaintStage,
  type CustomerAccountStatus,
  type CustomerRegion,
  type CustomerTier,
  type SupportAgent,
  type TicketCategory,
  type TicketChannel,
  type TicketPriority,
  type TicketStatus,
} from './src/types/support.ts';
import { supportRepo } from './server/db.ts';

function asCleanString(val: unknown, maxLen = 500): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function asEnumValue<T extends string>(
  val: unknown,
  allowed: readonly T[]
): T | undefined {
  if (typeof val !== 'string') return undefined;
  return (allowed as readonly string[]).includes(val) ? (val as T) : undefined;
}

function asPositiveInt(val: unknown, fallback: number, max: number): number {
  if (typeof val !== 'string' && typeof val !== 'number') return fallback;
  const parsed = Number.parseInt(String(val), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function validateIdParam(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^[A-Z]+-\d+$/.test(trimmed)) return null;
  return trimmed;
}

async function startServer() {
  await supportRepo.init();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health & Storage Mode
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const health = await supportRepo.getHealth();
      res.json(health);
    } catch {
      res.status(500).json({ error: 'Unable to retrieve service health' });
    }
  });

  // Executive & SLA Analytics
  app.get('/api/analytics', async (_req: Request, res: Response) => {
    try {
      const summary = await supportRepo.getAnalytics();
      res.json(summary);
    } catch {
      res.status(500).json({ error: 'Unable to compute support analytics' });
    }
  });

  // Ticket Queue List (Paginated, Filtered, Sorted)
  app.get('/api/tickets', async (req: Request, res: Response) => {
    try {
      const page = asPositiveInt(req.query.page, 1, 500);
      const limit = asPositiveInt(req.query.limit, 25, 100);
      const search = asCleanString(req.query.search, 120);
      const statusRaw = req.query.status;
      const status =
        statusRaw === 'Active'
          ? 'Active'
          : asEnumValue<TicketStatus>(statusRaw, TICKET_STATUSES);
      const priority = asEnumValue<TicketPriority>(
        req.query.priority,
        TICKET_PRIORITIES
      );
      const category = asEnumValue<TicketCategory>(
        req.query.category,
        TICKET_CATEGORIES
      );
      const assignedAgent = asEnumValue<SupportAgent>(
        req.query.assignedAgent,
        SUPPORT_AGENTS
      );
      const complaintStage = asEnumValue<ComplaintStage>(
        req.query.complaintStage,
        COMPLAINT_STAGES
      );
      const complaintsOnly = req.query.complaintsOnly === 'true';
      const slaBreached = req.query.slaBreached === 'true';

      const sortBy =
        asEnumValue(req.query.sortBy, [
          'createdAt',
          'priority',
          'responseTimeMinutes',
          'status',
        ] as const) ?? 'createdAt';
      const sortDir =
        asEnumValue(req.query.sortDir, ['asc', 'desc'] as const) ?? 'desc';

      const data = await supportRepo.listTickets({
        page,
        limit,
        search,
        status,
        priority,
        category,
        assignedAgent,
        complaintsOnly,
        complaintStage,
        slaBreached,
        sortBy,
        sortDir,
      });

      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to load ticket queue' });
    }
  });

  // Single Ticket Details
  app.get('/api/tickets/:id', async (req: Request, res: Response) => {
    const id = validateIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid ticket ID format' });
      return;
    }

    try {
      const detail = await supportRepo.getTicketById(id);
      if (!detail) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.json(detail);
    } catch {
      res.status(500).json({ error: 'Failed to fetch ticket details' });
    }
  });

  // Create Ticket
  app.post('/api/tickets', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const customerId = validateIdParam(body.customerId);
    const subject = asCleanString(body.subject, 180);
    const description = asCleanString(body.description, 4000);
    const category = asEnumValue<TicketCategory>(body.category, TICKET_CATEGORIES);
    const priority = asEnumValue<TicketPriority>(body.priority, TICKET_PRIORITIES);
    const channel =
      asEnumValue<TicketChannel>(body.channel, TICKET_CHANNELS) ?? 'Web Portal';
    const assignedAgent =
      asEnumValue<SupportAgent>(body.assignedAgent, SUPPORT_AGENTS) ?? 'Unassigned';
    const isComplaint = Boolean(body.isComplaint) || category === 'Service Complaint';

    if (!customerId || !subject || !description || !category || !priority) {
      res.status(400).json({
        error:
          'Missing or invalid required fields: customerId, subject, description, category, and priority are required.',
      });
      return;
    }

    try {
      const created = await supportRepo.createTicket({
        customerId,
        subject,
        description,
        category,
        priority,
        channel,
        assignedAgent,
        isComplaint,
      });
      res.status(201).json(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create ticket';
      res.status(400).json({ error: message });
    }
  });

  // Update Ticket Status / Priority / Assignment / Complaint Workflow
  app.patch('/api/tickets/:id', async (req: Request, res: Response) => {
    const id = validateIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid ticket ID format' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const status = asEnumValue<TicketStatus>(body.status, TICKET_STATUSES);
    const priority = asEnumValue<TicketPriority>(body.priority, TICKET_PRIORITIES);
    const category = asEnumValue<TicketCategory>(body.category, TICKET_CATEGORIES);
    const assignedAgent = asEnumValue<SupportAgent>(
      body.assignedAgent,
      SUPPORT_AGENTS
    );
    const isComplaint =
      typeof body.isComplaint === 'boolean' ? body.isComplaint : undefined;
    const complaintStage =
      body.complaintStage === null
        ? null
        : asEnumValue<ComplaintStage>(body.complaintStage, COMPLAINT_STAGES);
    const actorName = asCleanString(body.actorName, 80);

    try {
      const updated = await supportRepo.updateTicket(id, {
        status,
        priority,
        category,
        assignedAgent,
        isComplaint,
        complaintStage,
        actorName,
      });
      if (!updated) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Failed to update ticket' });
    }
  });

  // Append Interaction (Agent Reply / Customer Follow-up / Internal Note)
  app.post('/api/tickets/:id/interactions', async (req: Request, res: Response) => {
    const id = validateIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid ticket ID format' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const authorType =
      asEnumValue(body.authorType, ['Customer', 'Agent'] as const) ?? 'Agent';
    const authorName = asCleanString(body.authorName, 80) ?? 'Hannah Lindqvist';
    const message = asCleanString(body.message, 4000);
    const isInternalNote = Boolean(body.isInternalNote);
    const nextStatus = asEnumValue<TicketStatus>(body.nextStatus, TICKET_STATUSES);

    if (!message) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    try {
      const updated = await supportRepo.addInteraction(id, {
        authorType,
        authorName,
        message,
        isInternalNote,
        nextStatus,
      });
      if (!updated) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.status(201).json(updated);
    } catch {
      res.status(500).json({ error: 'Failed to record interaction' });
    }
  });

  // Delete Ticket
  app.delete('/api/tickets/:id', async (req: Request, res: Response) => {
    const id = validateIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid ticket ID format' });
      return;
    }
    try {
      const deleted = await supportRepo.deleteTicket(id);
      if (!deleted) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.json({ deleted: true, id });
    } catch {
      res.status(500).json({ error: 'Failed to delete ticket' });
    }
  });

  // Customer Directory (Paginated, Filtered)
  app.get('/api/customers', async (req: Request, res: Response) => {
    try {
      const page = asPositiveInt(req.query.page, 1, 500);
      const limit = asPositiveInt(req.query.limit, 25, 250);
      const search = asCleanString(req.query.search, 120);
      const tier = asEnumValue<CustomerTier>(req.query.tier, CUSTOMER_TIERS);
      const accountStatus = asEnumValue<CustomerAccountStatus>(
        req.query.accountStatus,
        CUSTOMER_STATUSES
      );

      const data = await supportRepo.listCustomers({
        page,
        limit,
        search,
        tier,
        accountStatus,
      });
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to load customer directory' });
    }
  });

  // Single Customer Profile + Full Interaction Timeline
  app.get('/api/customers/:id', async (req: Request, res: Response) => {
    const id = validateIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid customer ID format' });
      return;
    }

    try {
      const detail = await supportRepo.getCustomerById(id);
      if (!detail) {
        res.status(404).json({ error: 'Customer profile not found' });
        return;
      }
      res.json(detail);
    } catch {
      res.status(500).json({ error: 'Failed to load customer profile' });
    }
  });

  // Create Customer Profile
  app.post('/api/customers', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const fullName = asCleanString(body.fullName, 100);
    const email = asCleanString(body.email, 140);
    const phone = asCleanString(body.phone, 40) ?? '+1 (555) 010-0000';
    const company = asCleanString(body.company, 120);
    const tier = asEnumValue<CustomerTier>(body.tier, CUSTOMER_TIERS) ?? 'Standard';
    const region =
      asEnumValue<CustomerRegion>(body.region, CUSTOMER_REGIONS) ?? 'North America';
    const accountStatus =
      asEnumValue<CustomerAccountStatus>(body.accountStatus, CUSTOMER_STATUSES) ??
      'Active';
    const notes = asCleanString(body.notes, 1000) ?? '';

    if (!fullName || !email || !company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        error: 'Valid fullName, email, and company name are required.',
      });
      return;
    }

    try {
      const created = await supportRepo.createCustomer({
        fullName,
        email,
        phone,
        company,
        tier,
        region,
        accountStatus,
        notes,
      });
      res.status(201).json(created);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to create customer profile';
      res.status(400).json({ error: message });
    }
  });

  // Update Customer Profile
  app.patch('/api/customers/:id', async (req: Request, res: Response) => {
    const id = validateIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid customer ID format' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const fullName = asCleanString(body.fullName, 100);
    const phone = asCleanString(body.phone, 40);
    const company = asCleanString(body.company, 120);
    const tier = asEnumValue<CustomerTier>(body.tier, CUSTOMER_TIERS);
    const region = asEnumValue<CustomerRegion>(body.region, CUSTOMER_REGIONS);
    const accountStatus = asEnumValue<CustomerAccountStatus>(
      body.accountStatus,
      CUSTOMER_STATUSES
    );
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : undefined;

    try {
      const updated = await supportRepo.updateCustomer(id, {
        fullName,
        phone,
        company,
        tier,
        region,
        accountStatus,
        notes,
      });
      if (!updated) {
        res.status(404).json({ error: 'Customer profile not found' });
        return;
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Failed to update customer profile' });
    }
  });

  // Vite dev middleware vs Production static serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distDir, 'index.html'));
      });
    }
  }

  const port = Number.parseInt(process.env.PORT || '3000', 10);
  app.listen(port, '0.0.0.0', () => {
    console.log(`[RelayDesk] Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[RelayDesk] Fatal startup error:', err);
  process.exit(1);
});
