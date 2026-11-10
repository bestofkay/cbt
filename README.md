# CBT Platform

Enterprise single-tenant Computer Based Test platform.

## Stack

- **API:** Fastify + TypeScript + Prisma + MySQL + WebSocket (in-process jobs; no Redis)
- **Apps:** `web-admin`, `web-candidate`, `web-proctor` (React 19 + Vite + Tailwind)
- **Email:** Console logger by default (optional real SMTP)

## Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 8 (local install or any hosted MySQL)

No Docker, Redis, or Mailpit is required.

## Quick start

```bash
cp .env.example .env
# Edit DATABASE_URL to point at your MySQL instance

pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed

pnpm --filter @cbt/api dev
pnpm --filter @cbt/web-admin dev
pnpm --filter @cbt/web-candidate dev
pnpm --filter @cbt/web-proctor dev
```

| App | URL |
|-----|-----|
| Admin | http://localhost:5173 |
| Candidate | http://localhost:5174 |
| Proctor | http://localhost:5175 |
| API / OpenAPI | http://localhost:4000/docs |

Default admin after seed: `admin@cbt.local` / `ChangeMe!Admin1`

### Demo data (after `pnpm db:seed`)

All demo users share password `ChangeMe!Demo1`:

| Account | Role / purpose |
|---------|----------------|
| `manager@cbt.local` | Exam manager |
| `author@cbt.local` | Question author |
| `reviewer@cbt.local` | Question review queue |
| `proctor@cbt.local` | Live proctoring monitor |
| `finance@cbt.local` | Billing & invoices |
| `support@cbt.local` | Support tickets |
| `candidate1@cbt.local` | Graded result + certificate |
| `candidate2@cbt.local` | In-progress proctored attempt |
| `candidate3@cbt.local` | Essay awaiting manual grading |

Public certificate verification: `/certificates/verify/DEMO-VERIFY-2026`

## Docs

- Architecture: [docs/architecture/OVERVIEW.md](docs/architecture/OVERVIEW.md)
- Production checklist: [docs/PRODUCTION.md](docs/PRODUCTION.md)
- ERD: [docs/erd/ERD.md](docs/erd/ERD.md)
- OpenAPI: `http://localhost:4000/docs` (disabled in production unless `ENABLE_API_DOCS=true`)

## Deployment

See [docs/PRODUCTION.md](docs/PRODUCTION.md). Run the API and three Vite/static apps against a managed MySQL database. Background jobs (grading, notifications, webhooks) run inside the API process.
