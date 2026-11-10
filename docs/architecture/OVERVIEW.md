# Enterprise CBT Platform — Architecture Overview

## Style

The platform follows **Domain-Driven Design**, **Clean Architecture**, and **Hexagonal Architecture** in a single-tenant deployment.

## Bounded Contexts

| Context | Responsibility |
|---------|----------------|
| Identity & Access | Users, auth, RBAC, devices, SSO |
| Question Bank | Banks, questions, versions, approval |
| Exam Engine | Templates, sessions, invitations |
| Attempt Runtime | Live attempts, answers, timing |
| Proctoring | Events, flags, cheating score |
| Grading & Results | Scoring, review, certificates |
| Billing | Products, payments, invoices |
| Notifications | Email, SMS, push, webhooks |
| Reporting | Analytics, psychometrics, exports |
| Support | Tickets, activity streams |
| Platform Config | Branding, settings, feature flags |

## Layering

```
interfaces/http|ws  →  application (use cases)  →  domain  →  ports
                              ↓
                     infrastructure adapters (Prisma, local cache, SMTP)
```

## Single-Tenant Model

One organization per deployment. `Department` is an org-chart grouping only. Platform branding, SMTP, SMS, and payment credentials are global (`PlatformSettings` / `Branding`).

## Runtime Topology

- `apps/api` — Fastify REST `/api/v1` + WebSocket + in-process jobs
- `apps/web-admin` — administrative portal
- `apps/web-candidate` — exam-taking portal
- `apps/web-proctor` — live invigilation

## Cross-Cutting

- Audit logging on security-sensitive and domain mutations
- OpenTelemetry traces/metrics (optional)
- In-memory cache + queues (single-node; no Redis required)
- Object storage abstraction (local disk by default)
- Email via console logger or optional SMTP
