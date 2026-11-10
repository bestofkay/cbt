# Production readiness

This platform is **demo / staging ready**. Treat the checklist below as required before a real production cutover.

## Verdict

| Area | Status |
|------|--------|
| Core CBT flows (exams, attempts, grading, results) | Ready |
| Admin / candidate / proctor UIs | Ready |
| Full anti-cheat stack (browser + IP/geo) | Ready (requires HTTPS + user consent) |
| Auth hardening (JWT, 2FA, OAuth gating) | Ready with env constraints |
| Payments | Simulated only unless Stripe is wired |
| Object storage | Local disk by default |
| Background jobs | In-process (no Redis/BullMQ) |
| Observability | Basic `/health`, `/ready`, `/metrics` |

## Required production environment

Set strong unique values (boot **fails** if placeholders remain when `NODE_ENV=production`):

```bash
NODE_ENV=production
COOKIE_SECURE=true
JWT_ACCESS_SECRET=<random ≥32 chars>
JWT_REFRESH_SECRET=<random ≥32 chars>
ENCRYPTION_KEY=<64 hex chars>
DATABASE_URL=mysql://...
WEB_ADMIN_URL=https://admin.example.com
WEB_CANDIDATE_URL=https://exams.example.com
WEB_PROCTOR_URL=https://proctor.example.com
APP_URL=https://exams.example.com
SMTP_MODE=smtp
SMTP_HOST=...
SMTP_FROM=noreply@example.com
```

Optional:

- `ENABLE_API_DOCS=true` — expose `/docs` (off by default in production)
- `ALLOW_SIMULATED_PAYMENTS=true` — allow `sim_*` payments (off by default in production)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — when real payments are implemented
- Google / Microsoft OAuth client IDs — buttons stay hidden until configured

## Deploy steps

1. Provision MySQL 8.
2. Set production secrets (above).
3. `pnpm install && pnpm db:generate && pnpm db:migrate:deploy`
4. Build/start `apps/api` and the three web apps (static build or Vite preview behind a reverse proxy).
5. Run `pnpm db:seed` once for roles/permissions. **Change the default admin password immediately.**
6. Put TLS in front of all three web apps and the API (NGINX / load balancer).
7. Confirm `/ready` returns 200 after MySQL is up.

## Security notes

- Swagger UI is **disabled** in production unless `ENABLE_API_DOCS=true`.
- Simulated payments are **blocked** in production unless explicitly allowed.
- Exam submit is atomic (`updateMany` on status) to prevent double-submit races.
- Admin user create enforces the same password policy as registration.
- Proctoring media (camera/mic/screen) requires a secure context (HTTPS or localhost).
- Email defaults to console logging unless `SMTP_MODE=smtp` and a real host are configured.

## Known gaps (not blockers for CBT delivery)

1. **Stripe** — mark invoice paid only after PaymentIntent confirmation (currently simulated in non-prod).
2. **S3 driver** — local disk storage is used by default.
3. **LDAP/SAML** — flags exist; no full IdP login flow.
4. **Face detection** — uses Chromium `FaceDetector` when available; heuristic fallback elsewhere (not ML-grade).
5. **Horizontal scaling** — in-memory queues/pub-sub are per process; use a single API instance or add an external broker later if you scale out.

## Post-deploy smoke test

- [ ] Admin login + create exam + publish + session + invite
- [ ] Candidate register/login + start REAL exam + consent + submit
- [ ] Proctor sees live session + risk events
- [ ] Password reset email appears in API logs (console) or real SMTP inbox
- [ ] `/health` and `/ready` healthy behind the load balancer
