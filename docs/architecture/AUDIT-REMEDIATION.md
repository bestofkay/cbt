# Audit Remediation Log (2026-07-30)

## Critical gaps found

1. Frontend API paths did not match backend (`/question-banks` vs `/banks`, `/admin/*`, `/candidate/*`, `/proctor/*`)
2. Auth refresh returned tokens without `user` → reload always logged out
3. Register returned no tokens; 2FA returned 200 body instead of error FE expected
4. Error envelope `{ error: { message } }` not parsed by FE clients
5. Attempt/result/proctor response shapes mismatched UI interfaces
6. Double grading on submit; proctor auto-flag spam
7. No WebSocket proxy; no candidate proctoring event emission
8. Offline sync duplicated rows and never purged

## Fixes applied

### Backend
- Refresh + register now return `user` (+ tokens on register)
- Compat route layer for frontend path aliases + DTO mappers
- Mapped attempt/lobby/dashboard/results/proctor/branding/invoice/ticket payloads
- PUT `/questions/:id`, PATCH navigate, singular bookmark/flag aliases
- Proctor session grouping endpoints for live UI
- Results staff check uses roles (candidates see own only)
- Manual review upsert guard; proctor flag dedupe
- Seed English language fixed UUID for question forms

### Frontends
- Nested API error parsing in all three apps
- Auth boot: refresh → user (or `/me` fallback)
- Admin 2FA via `OtpRequiredError` on `requires2fa`
- Candidate start uses `attemptId || id`
- Offline sync: stable keys, delete on sync, mount sync, continue on item failure
- Vite `/ws` proxy; exam countdown WS + proctoring guards
- MCQ answers send `{ choiceId }`
