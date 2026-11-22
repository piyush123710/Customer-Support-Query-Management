# RelayDesk — Customer Support & Query Management System

RelayDesk is a full-stack **Customer Support & Query Management System** built with **React**, **TypeScript**, **Node.js**, **Express.js**, and **MongoDB**. It provides support operations teams with ticket triage, priority-based SLA tracking, customer profile management with unified interaction histories, and a multi-stage complaint resolution workflow.

---

## Core Capabilities

- **Ticket Queue & Priority Categorization (325+ Queries)**
  - Manages 325 seeded customer queries (plus live creation, updates, and deletion) categorized across `Technical Bug`, `Billing & Invoices`, `Account Access`, `API & Integrations`, `Service Complaint`, and `Feature Request`.
  - Priority-based SLA targets (`Urgent`: 60m, `High`: 240m, `Medium`: 480m, `Low`: 1440m) with automatic first-response, resolution duration, and breach calculation.
  - Server-side paginated, searchable, filterable, and sortable ticket queue (`Open`, `In Progress`, `Pending Customer`, `Escalated`, `Resolved`, `Closed`).

- **Customer Records & Unified Interaction History (215+ Profiles)**
  - Directory of 215 customer profiles across `Enterprise`, `Growth`, and `Standard` tiers and 4 global regions (`North America`, `Europe`, `Asia-Pacific`, `Latin America`).
  - Editable customer account records (`phone`, `tier`, `accountStatus`, internal `notes`) paired with aggregated ticket telemetry and a chronological cross-ticket interaction timeline.
  - Slide-over ticket workspace supporting public customer replies, internal staff notes, status transitions, and automatic SLA response recording.

- **Complaint Tracking Workflow & SLA Analytics**
  - Dedicated 4-stage complaint resolution pipeline (`Intake` → `Investigation` → `Remediation` → `Verified Resolved`) with one-click stage progression and SLA breach filtering.
  - Executive operations overview featuring KPI counters, a 14-day created vs. resolved throughput chart, priority distribution, top categories, and specialist workload metrics.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide Icons |
| **Backend** | Node.js, Express.js, REST API |
| **Database** | MongoDB (`mongodb` official driver) with automatic local persistent document-store fallback (`./data/support_db.json`) |
| **Build & Tooling** | Vite, `tsx`, TypeScript |

---

## Project Structure

```text
├── server.ts                       # Express REST API server & Vite/static middleware entry point
├── server/
│   ├── db.ts                       # Unified MongoDB + persistent local document-store repository
│   └── seed.ts                     # Deterministic seed generator (215 customers, 325 tickets)
├── src/
│   ├── App.tsx                     # Application shell, navigation sidebar, and workspace router
│   ├── main.tsx                    # React DOM entry point
│   ├── index.css                   # Tailwind CSS v4 theme & typography tokens
│   ├── api/
│   │   └── client.ts               # Typed REST API fetch client
│   ├── types/
│   │   └── support.ts              # Shared TypeScript interfaces & domain enums
│   ├── utils/
│   │   └── format.ts               # Duration, timestamp, and semantic formatting helpers
│   └── components/
│       ├── OverviewView.tsx        # Executive SLA metrics, 14-day trend chart & triage table
│       ├── TicketQueueView.tsx     # Paginated, searchable & filterable ticket table
│       ├── ComplaintsWorkflowView.tsx # 4-stage complaint resolution pipeline
│       ├── CustomersDirectoryView.tsx # Customer directory, profile editor & timeline
│       ├── TicketDetailDrawer.tsx  # Slide-over ticket editor & reply/note composer
│       └── CreateModals.tsx        # Modals for creating tickets and customer profiles
├── .env.example                    # Environment variable template
├── package.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- **Node.js** `v20+` (tested on `v22.23.2`)
- **npm** (or **bun**)
- *(Optional)* **MongoDB** connection string (`MONGODB_URI`). If omitted, RelayDesk automatically persists all collections to `./data/support_db.json` and seeds 215 customer profiles and 325 support queries on first boot.

### Installation & Local Development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables (optional)**

   Copy `.env.example` to `.env` if you want to connect an external MongoDB instance:

   ```bash
   cp .env.example .env
   ```

   ```env
   MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net"
   MONGODB_DB_NAME="relaydesk_support"
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   The Express server and Vite middleware run together at `http://localhost:3000`.

### Build, Lint & Production

```bash
# Type-check the TypeScript codebase
npm run lint

# Build the production frontend bundle into dist/
npm run build

# Run the production server (serves API + built dist/)
NODE_ENV=production npm start
```

---

## REST API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service status, active storage backend (`mongodb` or `local-document-store`), and record counts |
| `GET` | `/api/analytics` | Aggregated SLA compliance, response times, 14-day trend, priority breakdown, and complaint funnel |
| `GET` | `/api/tickets` | Paginated ticket list supporting `page`, `limit`, `search`, `status`, `priority`, `category`, `assignedAgent`, `complaintsOnly`, `complaintStage`, `slaBreached`, `sortBy`, `sortDir` |
| `GET` | `/api/tickets/:id` | Single ticket details paired with linked customer telemetry |
| `POST` | `/api/tickets` | Create a new customer query or complaint ticket |
| `PATCH` | `/api/tickets/:id` | Update ticket `status`, `priority`, `category`, `assignedAgent`, or `complaintStage` with automatic audit log |
| `DELETE` | `/api/tickets/:id` | Delete a ticket record |
| `POST` | `/api/tickets/:id/interactions` | Append a customer message, agent reply, or internal note and record first-response SLA timing |
| `GET` | `/api/customers` | Paginated customer directory supporting `page`, `limit`, `search`, `tier`, `accountStatus` |
| `GET` | `/api/customers/:id` | Customer profile, ticket history, and chronological cross-ticket interaction timeline |
| `POST` | `/api/customers` | Create a new customer profile |
| `PATCH` | `/api/customers/:id` | Update customer contact info, tier, account status, and profile notes |

---

## Data Security & Validation

- All route IDs (`TKT-*`, `CUS-*`), enum fields, pagination bounds, and string inputs are validated server-side against strict allowlists before querying or mutating records.
- Database connection secrets (`MONGODB_URI`) are read strictly from server-side environment variables and are never exposed to the browser bundle.
- Client views render user-supplied text exclusively via safe React JSX bindings.
