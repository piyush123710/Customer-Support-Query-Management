import {
  COMPLAINT_STAGES,
  CUSTOMER_REGIONS,
  CUSTOMER_STATUSES,
  CUSTOMER_TIERS,
  SLA_TARGETS_MINUTES,
  SUPPORT_AGENTS,
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type ComplaintStage,
  type CustomerRecord,
  type Interaction,
  type TicketCategory,
  type TicketPriority,
  type TicketRecord,
  type TicketStatus,
} from '../src/types/support.ts';

// Deterministic PRNG so initial seed data is consistent and realistic
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const FIRST_NAMES = [
  'Elena', 'Marcus', 'Priya', 'David', 'Sophia', 'Lucas', 'Amara', 'Henrik',
  'Mei', 'Carlos', 'Isabella', 'Tariq', 'Chloe', 'Samuel', 'Amina', 'Julian',
  'Yuki', 'Daniel', 'Nora', 'Rafael', 'Hannah', 'Vikram', 'Claire', 'Owen',
  'Fatima', 'Ethan', 'Maya', 'Sebastian', 'Leila', 'Benjamin', 'Zara', 'Noah',
  'Ananya', 'Gabriel', 'Sienna', 'Kieran', 'Camille', 'Liam', 'Hana', 'Adrian',
];

const LAST_NAMES = [
  'Rostova', 'Vance', 'Nair', 'Chen', 'Lindholm', 'Moreau', 'Okafor', 'Bergstrom',
  'Tanaka', 'Mendoza', 'Conti', 'Al-Mansoor', 'Whitaker', 'Kowalski', 'Diallo', 'Mercer',
  'Sato', 'Brooks', 'Alvarez', 'Patel', 'Sorensen', 'Gallagher', 'Nakamura', 'Ferreira',
  'Khoury', 'Harrington', 'Subramanian', 'Delgado', 'Novak', 'Fitzgerald', 'Ibrahim', 'Cho',
  'Bhattacharya', 'Richter', 'Castillo', 'OConnor', 'Beaumont', 'Keller', 'Varga', 'Sinclair',
];

const COMPANIES = [
  'Northstar Logistics', 'Helios Cloud Systems', 'Meridian Retail Group', 'Vanguard FinTech',
  'Kestrel BioLabs', 'Borealis Energy', 'Stratos Freight', 'Aurelia Health',
  'Cobalt Manufacturing', 'Lumen Commerce', 'Cascadia Supply', 'Solstice Media',
  'Veridian Analytics', 'Harborline Financial', 'Atlas Robotics', 'Redwood Partners',
  'Crestview Hospitality', 'Monarch Insurance', 'Summit Telecom', 'Ironclad Security',
  'Pacific Maritime', 'Clearwater Labs', 'Keystone Real Estate', 'Horizon Aviation',
  'Silverline Mobility', 'Granite Construction', 'Oakridge Education', 'Beacon Healthcare',
];

const SUBJECT_TEMPLATES: Record<TicketCategory, string[]> = {
  'Technical Bug': [
    'Dashboard export CSV truncates multi-byte UTF-8 customer names',
    'Webhook retry queue stalling on 502 responses in eu-west-1',
    'Scheduled report PDF generation timing out after 30 seconds',
    'Two-factor SMS verification code delayed beyond 5-minute window',
    'Bulk ticket import fails silently when custom field exceeds 255 chars',
    'Session refresh token revoking active workspace tabs unexpectedly',
    'Search index lagging by 20 minutes on newly created customer records',
  ],
  'Billing & Invoices': [
    'Duplicate monthly seat charge on invoice #INV-8842',
    'Requesting updated VAT tax ID on Q4 enterprise billing statement',
    'Annual renewal quote mismatch against contracted tier discount',
    'Corporate Visa payment declined despite valid authorization hold',
    'Prorated credit missing after downgrading 12 inactive seats',
    'Need itemized breakdown for October API overage usage fee',
  ],
  'Account Access': [
    'SSO SAML assertion failing after Okta certificate rotation',
    'Locked out of primary organization admin account after MFA reset',
    'New regional manager cannot inherit workspace read-write role',
    'Audit log access restricted for delegated compliance reviewer',
    'Unable to transfer organization ownership to incoming VP Ops',
    'Password reset link returning expired token immediately on click',
  ],
  'API & Integrations': [
    'REST API rate limit 429 triggered below documented 600 req/min',
    'Salesforce bi-directional contact sync dropping custom phone fields',
    'Slack escalation webhook missing ticket priority payload property',
    'OAuth2 refresh flow returning invalid_grant on sandbox tenant',
    'Paginated /customers endpoint returning duplicate cursor offset',
    'Jira issue link integration failing to attach customer transcript',
  ],
  'Service Complaint': [
    'Formal escalation: P1 outage response exceeded 4-hour enterprise SLA',
    'Unresolved billing dispute open for 9 days without specialist follow-up',
    'Repeated misrouting of EU data residency compliance inquiries',
    'Dissatisfied with premature ticket closure before fix verification',
    'Account onboarding delayed two weeks due to missing provisioning call',
    'Customer data export request missed regulatory 72-hour turnaround',
  ],
  'Feature Request': [
    'Support custom SLA business-hour calendars per regional office',
    'Add bulk status transition shortcut in ticket queue table view',
    'Need read-only auditor role scoped strictly to billing statements',
    'Requesting webhook event trigger on complaint stage change',
    'Allow exporting filtered interaction transcripts in JSON format',
  ],
};

const AGENT_REPLIES = [
  'Thank you for flagging this. I have reproduced the behavior in your workspace environment and escalated the diagnostic trace to our platform engineering team.',
  'I reviewed the transaction ledger and issued a full credit adjustment for the duplicate charge. You will see the updated statement reflected within 1 business day.',
  'We refreshed the SAML metadata fingerprint on our end and verified test authentication succeeds. Could you confirm your team can sign in cleanly now?',
  'I have reassigned this case to our senior compliance specialist and prioritized remediation under our SLA escalation track. Expect an update within 2 hours.',
  'Our patch for the pagination cursor boundary has been deployed to production. Please re-run your sync job and let us know if any records remain out of alignment.',
  'Thank you for your patience. We updated your organization role permissions and verified audit access for the designated reviewer account.',
];

const CUSTOMER_FOLLOWUPS = [
  'Thanks for the quick turnaround. We tested on two accounts and the issue appears resolved, though one regional manager still sees a cached error.',
  'Following up here—our finance team still needs the revised PDF invoice before Friday close.',
  'Confirmed, SAML login is working across all 45 seats now. Appreciate the rapid investigation.',
  'This is impacting our live customer operations; please treat this as urgent and share an ETA.',
  'Attaching the exact request IDs from our API logs so your engineers can trace the 502 spike.',
];

export function generateSeedData(referenceTimeMs = Date.now()): {
  customers: CustomerRecord[];
  tickets: TicketRecord[];
} {
  const rng = createRng(20261121);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

  // 1. Generate 215 realistic customer profiles
  const customers: CustomerRecord[] = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < 215; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7 + Math.floor(i / FIRST_NAMES.length)) % LAST_NAMES.length];
    const fullName = `${first} ${last}`;
    const company = COMPANIES[i % COMPANIES.length];
    const domain = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.io';

    let email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
    if (usedEmails.has(email)) {
      email = `${first.toLowerCase()}.${last.toLowerCase()}${i + 1}@${domain}`;
    }
    usedEmails.add(email);

    const tierRoll = rng();
    const tier =
      tierRoll < 0.24
        ? CUSTOMER_TIERS[0]
        : tierRoll < 0.62
          ? CUSTOMER_TIERS[1]
          : CUSTOMER_TIERS[2];

    const statusRoll = rng();
    const accountStatus =
      statusRoll < 0.78
        ? CUSTOMER_STATUSES[0]
        : statusRoll < 0.91
          ? CUSTOMER_STATUSES[1]
          : CUSTOMER_STATUSES[2];

    const createdDaysAgo = 30 + Math.floor(rng() * 500);
    const createdAt = new Date(referenceTimeMs - createdDaysAgo * 86400_000).toISOString();
    const lastContactDaysAgo = Math.floor(rng() * 28);
    const lastContactedAt = new Date(referenceTimeMs - lastContactDaysAgo * 86400_000).toISOString();

    const area = 210 + Math.floor(rng() * 780);
    const mid = 200 + Math.floor(rng() * 799);
    const tail = 1000 + Math.floor(rng() * 8999);

    customers.push({
      id: `CUS-${1001 + i}`,
      fullName,
      email,
      phone: `+1 (${area}) ${mid}-${tail}`,
      company,
      tier,
      region: pick(CUSTOMER_REGIONS),
      accountStatus,
      satisfactionScore: Number((3.6 + rng() * 1.4).toFixed(1)),
      notes:
        tier === 'Enterprise'
          ? 'Dedicated enterprise SLA agreement; primary technical contact for quarterly reviews.'
          : accountStatus === 'At Risk'
            ? 'Recent unresolved complaint escalated; monitor response times closely.'
            : 'Standard account profile with verified billing and support contacts.',
      createdAt,
      lastContactedAt,
    });
  }

  // 2. Generate 325 simulated customer queries / tickets
  const tickets: TicketRecord[] = [];
  const activeAgents = SUPPORT_AGENTS.slice(0, 5);

  for (let i = 0; i < 325; i++) {
    const customer = customers[Math.floor(rng() * customers.length)];
    const category = pick(TICKET_CATEGORIES);
    const templates = SUBJECT_TEMPLATES[category];
    const baseSubject = templates[Math.floor(rng() * templates.length)];
    const subject =
      i % 4 === 0 ? `${baseSubject} (${customer.company})` : baseSubject;

    // Weight priorities realistically
    const pRoll = rng();
    let priority: TicketPriority = 'Medium';
    if (category === 'Service Complaint') {
      priority = pRoll < 0.35 ? 'Urgent' : pRoll < 0.78 ? 'High' : 'Medium';
    } else if (pRoll < 0.14) {
      priority = 'Urgent';
    } else if (pRoll < 0.42) {
      priority = 'High';
    } else if (pRoll < 0.8) {
      priority = 'Medium';
    } else {
      priority = 'Low';
    }

    // Spread created timestamps across last 45 days, with denser volume in last 14 days
    const daysAgo = rng() < 0.68 ? Math.floor(rng() * 14) : 14 + Math.floor(rng() * 31);
    const hoursOffset = Math.floor(rng() * 23);
    const minsOffset = Math.floor(rng() * 59);
    const createdMs =
      referenceTimeMs - daysAgo * 86400_000 - hoursOffset * 3600_000 - minsOffset * 60_000;
    const createdAt = new Date(createdMs).toISOString();

    // Status distribution depending on age
    let status: TicketStatus;
    if (daysAgo <= 2) {
      const sRoll = rng();
      status =
        sRoll < 0.36
          ? 'Open'
          : sRoll < 0.64
            ? 'In Progress'
            : sRoll < 0.8
              ? 'Pending Customer'
              : sRoll < 0.9
                ? 'Escalated'
                : 'Resolved';
    } else if (daysAgo <= 7) {
      const sRoll = rng();
      status =
        sRoll < 0.14
          ? 'Open'
          : sRoll < 0.32
            ? 'In Progress'
            : sRoll < 0.48
              ? 'Pending Customer'
              : sRoll < 0.58
                ? 'Escalated'
                : sRoll < 0.85
                  ? 'Resolved'
                  : 'Closed';
    } else {
      const sRoll = rng();
      status =
        sRoll < 0.05
          ? 'Escalated'
          : sRoll < 0.12
            ? 'Pending Customer'
            : sRoll < 0.62
              ? 'Resolved'
              : 'Closed';
    }

    const isComplaint =
      category === 'Service Complaint' || status === 'Escalated' || rng() < 0.14;

    let complaintStage: ComplaintStage | null = null;
    if (isComplaint) {
      if (status === 'Resolved' || status === 'Closed') {
        complaintStage = 'Verified Resolved';
      } else if (status === 'Pending Customer') {
        complaintStage = 'Remediation';
      } else if (status === 'In Progress' || status === 'Escalated') {
        complaintStage = rng() < 0.5 ? 'Investigation' : 'Remediation';
      } else {
        complaintStage = 'Intake';
      }
    }

    const slaTargetMinutes = SLA_TARGETS_MINUTES[priority];
    const assignedAgent =
      status === 'Open' && rng() < 0.28 ? 'Unassigned' : pick(activeAgents);

    // Calculate response & resolution metrics
    let firstResponseAt: string | null = null;
    let responseTimeMinutes: number | null = null;
    let resolvedAt: string | null = null;
    let resolutionTimeMinutes: number | null = null;

    const hasAgentResponded = status !== 'Open' || rng() < 0.35;
    if (hasAgentResponded) {
      // Occasionally simulate an SLA breach (roughly 13% of tickets)
      const shouldBreach = rng() < 0.13;
      const respMins = shouldBreach
        ? slaTargetMinutes + 25 + Math.floor(rng() * 180)
        : Math.max(8, Math.floor(slaTargetMinutes * (0.15 + rng() * 0.65)));

      const respMs = Math.min(referenceTimeMs - 60_000, createdMs + respMins * 60_000);
      if (respMs > createdMs) {
        firstResponseAt = new Date(respMs).toISOString();
        responseTimeMinutes = Math.round((respMs - createdMs) / 60_000);
      }
    }

    if (status === 'Resolved' || status === 'Closed') {
      const baseResp = responseTimeMinutes ?? 45;
      const resMins = baseResp + 60 + Math.floor(rng() * 960);
      const resMs = Math.min(referenceTimeMs - 30_000, createdMs + resMins * 60_000);
      resolvedAt = new Date(Math.max(createdMs + 300_000, resMs)).toISOString();
      resolutionTimeMinutes = Math.round(
        (new Date(resolvedAt).getTime() - createdMs) / 60_000
      );
    }

    // Build chronological interaction history
    const interactions: Interaction[] = [
      {
        id: `INT-${i}-1`,
        authorType: 'Customer',
        authorName: customer.fullName,
        message: `Hello team, we are encountering the following issue on our ${customer.tier} workspace (${customer.company}): ${subject}. This is impacting our daily workflow and we need confirmation on next steps.`,
        isInternalNote: false,
        createdAt,
      },
    ];

    if (firstResponseAt && assignedAgent !== 'Unassigned') {
      interactions.push({
        id: `INT-${i}-2`,
        authorType: 'Agent',
        authorName: assignedAgent,
        message: pick(AGENT_REPLIES),
        isInternalNote: false,
        createdAt: firstResponseAt,
      });

      const baseAfterResp = new Date(firstResponseAt).getTime();
      if (rng() < 0.65 && baseAfterResp + 1800_000 < referenceTimeMs) {
        interactions.push({
          id: `INT-${i}-3`,
          authorType: 'Customer',
          authorName: customer.fullName,
          message: pick(CUSTOMER_FOLLOWUPS),
          isInternalNote: false,
          createdAt: new Date(baseAfterResp + 1800_000).toISOString(),
        });
      }

      if (isComplaint && baseAfterResp + 2400_000 < referenceTimeMs) {
        interactions.push({
          id: `INT-${i}-4`,
          authorType: 'Agent',
          authorName: 'Hannah Lindqvist',
          message:
            'Internal review: Verified account SLA terms and linked incident root-cause ticket for weekly quality audit.',
          isInternalNote: true,
          createdAt: new Date(baseAfterResp + 2400_000).toISOString(),
        });
      }
    }

    if (resolvedAt) {
      interactions.push({
        id: `INT-${i}-5`,
        authorType: 'System',
        authorName: 'Workflow Engine',
        message: `Ticket marked as ${status}${isComplaint ? ' and complaint stage updated to Verified Resolved' : ''}.`,
        isInternalNote: false,
        createdAt: resolvedAt,
      });
    }

    const lastInteraction = interactions[interactions.length - 1];
    tickets.push({
      id: `TKT-${1001 + i}`,
      customerId: customer.id,
      subject,
      description: interactions[0].message,
      category,
      priority,
      status,
      channel: pick(TICKET_CHANNELS),
      assignedAgent,
      isComplaint,
      complaintStage,
      slaTargetMinutes,
      responseTimeMinutes,
      resolutionTimeMinutes,
      createdAt,
      firstResponseAt,
      resolvedAt,
      updatedAt: lastInteraction.createdAt,
      interactions,
    });
  }

  return { customers, tickets };
}
