# NexCRM — Full-Stack IT Services Lead-to-Delivery CRM

NexCRM is a clean, fast, full-stack CRM application purpose-built for small IT services startups and software consultancies. It tracks the entire client engagement lifecycle manually from initial enquiry to project delivery:

**Lead &rarr; Conversion Decision &rarr; Client &rarr; Project &rarr; Manual Project Timeline**

---

## 1. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons (with responsive desktop/mobile layout, Light & Dark mode, CSV export, modals, and drawers)
- **Backend**: Node.js, Express, TypeScript, REST API, Zod validation
- **Database & ORM**: Prisma ORM with SQLite (`file:./dev.db`) configured out of the box for zero-config local execution (easily switchable to PostgreSQL via `DATABASE_URL`)
- **Authentication**: JWT + `bcryptjs` hashed passwords with `ADMIN` and `MEMBER` roles
- **Testing**: Vitest + Supertest integration test suite verifying the Lead &rarr; Conversion &rarr; automatic Client creation workflow

---

## 2. Folder Structure

```text
NexCRM/
├── .env.example
├── README.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma       # Relational schema (User, Lead, LeadNote, Conversion, Client, ClientNote, Project, TimelineEntry)
│   │   └── seed.ts             # Realistic IT startup seed data (11 leads, 7 conversions, 5 clients, 6 projects, 19 timeline entries)
│   └── src/
│       ├── index.ts            # Server entry point (port 4000)
│       ├── app.ts              # Express app & middleware configuration
│       ├── lib/
│       │   └── prisma.ts       # PrismaClient singleton
│       ├── middleware/
│       │   └── auth.ts         # JWT verification & role guards
│       ├── routes/
│       │   ├── auth.ts         # Login, register, current user, team directory
│       │   ├── dashboard.ts    # KPI cards, follow-ups due this week, ending soon projects, charts
│       │   ├── leads.ts        # Leads CRUD, activity notes, move-to-conversion
│       │   ├── conversions.ts  # Conversion outcome updates, history log, auto Client creation
│       │   ├── clients.ts      # Clients CRUD, cascade protection, client notes
│       │   ├── projects.ts     # Projects CRUD, manual status & progress override
│       │   └── timeline.ts     # Timeline entries CRUD, reordering, auto progress calculation
│       └── __tests__/
│           └── conversion.test.ts # Automated tests for Lead -> Conversion -> Client creation
└── frontend/
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx             # Responsive shell, 6-module sidebar, light/dark mode
        ├── index.css
        ├── types/
        │   └── crm.ts          # Shared TypeScript interfaces
        ├── lib/
        │   ├── api.ts          # Authenticated fetch wrapper
        │   └── utils.ts        # Date/currency formatters, badge styles, CSV exporter
        ├── components/ui/
        │   ├── Modal.tsx       # Modal & slide-over Drawer components
        │   ├── ConfirmDialog.tsx
        │   ├── Toast.tsx
        │   ├── Pagination.tsx
        │   └── EmptyState.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            ├── LeadsPage.tsx
            ├── LeadConversionPage.tsx
            ├── ClientsPage.tsx
            ├── ProjectsPage.tsx
            └── TimelinePage.tsx
```

---

## 3. Quick Start & Setup Instructions

### Prerequisites
- **Node.js** v18+ and **npm** v9+

### Step 1: Set up the Backend & Seed Database

```bash
cd backend
cp .env.example .env
npm install
npm run setup
```
> `npm run setup` runs `prisma generate`, pushes the schema to SQLite (`prisma db push`), and seeds the database (`tsx prisma/seed.ts`) with 4 users, 11 leads, 7 conversions, 5 clients, 6 projects, and timeline entries.

Start the backend API server (runs on `http://localhost:4000`):

```bash
npm run dev
```

### Step 2: Set up and Run the Frontend

Open a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 4. Seeded Login Credentials

You can also click the **Quick Demo Credentials** buttons directly on the login screen:

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Admin** | NexInt AI admin | `admin@nexcrm.io` | `Admin123!` |
| **Member** | Sarah Chen | `sarah@nexcrm.io` | `Member123!` |
| **Member** | Marcus Vance | `marcus@nexcrm.io` | `Member123!` |
| **Member** | Priya Nair | `priya@nexcrm.io` | `Member123!` |

---

## 5. Running Automated Tests

To run the backend integration test suite verifying the Lead &rarr; Conversion &rarr; automatic Client creation logic:

```bash
cd backend
npm test
```

