# Backend Task Checklist — Expense Claims & Reimbursement Management System

Tracks implementation against `plan-backend.md` (v2: direct approver assignment, Finance approval authority, info-request workflow, receipt uploads). Check items off as completed; keep in delivery order.
Frontend work is tracked separately in `task-frontend.md`.

**Status: backend implementation complete and verified against a real local Postgres instance (40/40 tests passing; server smoke-tested end-to-end over HTTP, and via a real browser through the frontend integration — see `task-frontend.md`). Docker + a Render Blueprint (`render.yaml`) are in place for local dev/test and deployment respectively — see the log below.**

## Decision log

- **Reimbursement dropped entirely** (decided with the user during
  implementation). The frontend this backend serves never implements
  `REIMBURSEMENT_PENDING`/`REIMBURSED` or a `/reimbursements` resource —
  `APPROVED` is its terminal claim status. The backend was built to match
  that actual frontend contract instead of `plan-backend.md`'s original
  text: no `Reimbursement` model, no `ReimbursementMethod` enum, no
  reimbursement statuses, no reimbursement endpoints. See
  `backend/ARCHITECTURE.md`'s "Deviations from plan-backend.md" section.
- **Two endpoints added beyond the plan's §7 list**, both because the
  frontend actually calls them: `DELETE /claims/:id/receipts/:receiptId`
  (used by `EditClaimPage`) and `GET /audit` (global, Finance-only, paginated
  — used by the Finance "Audit Logs" page's `listAllAudit`).
- **Prisma pinned to `6.19.3`**, not the current npm `latest` tag (Prisma
  7, which requires a `prisma.config.ts` + driver-adapter setup instead of
  the classic `datasource { url = env(...) }` block). Not worth the
  migration cost for this POC.
- **Docker dropped, then restored** (decided with the user after initial
  delivery, then reversed a short time later once deployment came up).
  `docker-compose.yml`, `backend/Dockerfile`, and `backend/.dockerignore`
  are back, matching what was originally built. While investigating a
  connection failure to a Render-hosted Postgres instance the user tried
  (`P1001`, isolated to a discrepancy between Prisma's engine and a plain
  `pg` client against the same URL — see chat history, not written up as a
  doc since it wasn't conclusively resolved), a `render.yaml` Blueprint was
  added as the actual fix: deploying both the backend and its database to
  Render together via `render.yaml` keeps them on the same private
  network, avoiding the external-hostname connection path (and its
  SSL/reachability quirks) entirely.
- **Seeding made automatic and self-guarding.** `prisma/seed.ts` now bails
  out immediately if the database already has any users, instead of
  always wiping+recreating claim data. This makes it safe to run
  unconditionally on every container boot (`backend/Dockerfile`'s `CMD`
  now runs `prisma migrate deploy && tsx prisma/seed.ts && node
  dist/server.js`) rather than needing a manual one-time step — important
  because Render's Shell tab, the obvious place to run a one-off command,
  is a paid-plan feature. Also moved `prisma` and `tsx` from
  devDependencies to dependencies in `package.json`, since the production
  Docker stage only installs non-dev deps and both are now needed at
  runtime (`prisma` was already being invoked in the container's `CMD`
  before this change too — that was a latent bug, now fixed alongside
  this). Verified end-to-end against a real Postgres: seeded a fresh DB,
  inserted a claim simulating real usage, re-ran the seed script, and
  confirmed it skipped and the real claim survived.
- **Cross-site auth cookie bug found and fixed.** Deployed against the
  Render backend with a local frontend (`localhost:5173` calling
  `*.onrender.com` — genuinely cross-site, different registrable domains),
  login succeeded but every subsequent request came back
  `UNAUTHENTICATED`. Root cause: the auth cookie was always issued with
  `SameSite=Lax`, which a browser stores fine on the login response but
  then withholds from any later cross-site `fetch`/XHR — indistinguishable
  from a broken session from the outside. `backend/src/lib/cookies.ts` now
  derives `sameSite`/`secure` from `COOKIE_SECURE`: `None`+`Secure` when
  true (any real HTTPS deployment), `Lax`+non-secure when false (local
  HTTP dev, where `None` would be rejected by the browser outright since
  it requires `Secure`, and plain `Lax` already works because same-port
  differences on `localhost` are same-site). Verified by inspecting the
  actual `Set-Cookie` response header in both modes against a real running
  server — confirmed `Secure; SameSite=None` vs. plain `SameSite=Lax`
  exactly as intended.

## 0. Planning
- [x] Inspect repo (empty — greenfield POC)
- [x] Write backend technical implementation plan (`plan-backend.md`, v2)
- [x] Confirm assumptions with stakeholder — reimbursement scope resolved (see Decision log above); no other open assumptions

## 1. Project Setup
- [x] `backend/` scaffold: Express + TS, tsconfig, eslint/prettier — used oxlint (matching the frontend's choice) rather than ESLint/Prettier
- [x] Root `.env.example` documenting all required backend env vars (DB URL, JWT secret, upload dir, etc.) — `backend/.env.example`
- [x] `docker-compose.yml` postgres + backend services, backend Dockerfile — root `docker-compose.yml`, `backend/Dockerfile` (see Decision log — not run end-to-end in this environment, no Docker available; verified another way, see §15)

## 2. Database + Prisma (v2 schema)
- [x] Define Prisma schema: `User`, `Claim` (with `assignedApproverId`, `decidedById`, `decidedAt`, `submissionCycle`), `ClaimItem`, `Receipt`, `ClaimMessage`, `AuditLog` (plan-backend.md §4) — no `ApprovalRule`/`Approval` tables, and (per the reimbursement decision above) no `Reimbursement` table either
- [x] Enums: `Role`, `ClaimStatus{DRAFT,PENDING_APPROVAL,INFO_REQUESTED,REJECTED,APPROVED,CANCELLED}` (no `REIMBURSEMENT_PENDING`/`REIMBURSED` — dropped), `ClaimMessageType`, `AuditAction` (no `ReimbursementMethod` — dropped)
- [x] Indexes + unique constraints per plan-backend.md §4 (including `Claim.assignedApproverId`)
- [x] Initial migration — `backend/prisma/migrations/20260921064744_init` (generated offline via `prisma migrate diff --from-empty`, no live DB was available; applied successfully against a real local Postgres during verification)
- [x] Seed script (`prisma/seed.ts`) with finance/approver/claimant users + sample claims in every status including `INFO_REQUESTED` (spec §24, adapted) — reuses the same seeded emails/credentials the frontend mock already uses, so both sides demo consistently

## 3. Authentication
- [x] Password hashing (bcrypt)
- [x] `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- [x] JWT issuance (httpOnly cookie) + verification middleware `authenticate()`
- [x] `authorize(...roles)` middleware

## 4. RBAC Foundation
- [x] Centralized authorization helpers (`getClaimScopeFilter(user)` — claimant by `claimantId`, approver by `assignedApproverId`, Finance unfiltered-minus-DRAFT) — plan-backend.md §6
- [x] Error response shape + status code conventions (spec §25)

## 5. Claim CRUD + Line Items + Total Integrity
- [x] `POST /claims` (create draft), `GET /claims`, `GET /claims/:id`, `PATCH /claims/:id`
- [x] `POST/PATCH/DELETE /claims/:id/items/:itemId`
- [x] `recalculateClaimTotal(tx, claimId)` service — sole writer of `claim.total`
- [x] Strip/ignore any client-supplied `total` field in DTOs (Zod schemas)
- [x] Validation: amount > 0, valid date, category + description required
- [x] Draft save + immutability rules once submitted, including during `INFO_REQUESTED` (plan-backend.md §5)
- [x] `GET /users/approvers` — active approver list for the assignment dropdown
- [x] `POST /claims/:id/submit` — requires `assignedApproverId`
- [x] `POST /claims/:id/resubmit` — requires `assignedApproverId` (may reassign), bumps `submissionCycle`
- [x] `POST /claims/:id/cancel`

## 6. Receipts
- [x] Storage abstraction interface (local disk impl, swappable for S3 later) — `services/storage/`
- [x] `POST /claims/:id/receipts` (multipart upload; restrict to image/jpeg, image/png, image/webp, application/pdf; size cap ~5MB; optional `claimItemId`)
- [x] Authenticated download endpoint with ownership/assignment checks (no public static serving)
- [x] `DELETE /claims/:id/receipts/:receiptId` — added beyond the original plan; see Decision log

## 7. Approve / Reject / Request Info
- [x] `POST /claims/:id/approve` — actor must be `assignedApproverId` OR Finance; claim must be `PENDING_APPROVAL`/`INFO_REQUESTED`; transactional; audit log
- [x] `POST /claims/:id/reject` — same actor rule, mandatory reason, sets `REJECTED`, audit log
- [x] `POST /claims/:id/request-info` — same actor rule, mandatory message, creates `ClaimMessage`, sets `INFO_REQUESTED`, audit log
- [x] `POST /claims/:id/respond-info` — claimant only, own claim, mandatory message + optional receipt attach, creates `ClaimMessage`, sets status back to `PENDING_APPROVAL`, audit log
- [x] `GET /claims/:id/messages`

## 8. Resubmission
- [x] Edit rejected claim (back to editable item state)
- [x] Resubmit: allow reassigning approver, preserve prior rejection/message/approval history (submission cycle counter)

## 9. Reimbursement — dropped (see Decision log)
- [ ] ~~`APPROVED → REIMBURSEMENT_PENDING → REIMBURSED` transitions~~ — not implemented, by decision
- [ ] ~~`POST /claims/:id/reimburse` (Finance only), `GET /reimbursements`~~ — not implemented, by decision
- [ ] ~~Guard: cannot reimburse before fully approved~~ — n/a

## 10. Audit Trail
- [x] `AuditLog` writes on every action including `CLAIM_INFO_REQUESTED`/`CLAIM_INFO_RESPONDED`, inside the same transaction as the state change
- [x] `GET /audit/claims/:claimId`
- [x] `GET /audit` (global, Finance-only, paginated) — added beyond the original plan; see Decision log

## 11. Finance Export
- [x] `GET /finance/export` — DB-level filtering (date range, status), streamed/generated CSV, no in-memory full-table load (bounded batches of 500 rows)

## 12. Dashboard Endpoints
- [x] Claimant dashboard endpoint (spec §16)
- [x] Approver dashboard endpoint (scoped to `assignedApproverId`) + filters
- [x] Finance dashboard endpoint (global) + filters

## 13. Security & Data-Integrity Tests (mandatory — spec §21, adapted to v2)
All of the following are in `tests/integration/security.test.ts`, run and passing against a real local Postgres.
- [x] Claimant A cannot access Claimant B's claim
- [x] Approver A cannot access/act on a claim assigned to Approver B
- [x] Claimant cannot call approve/reject/request-info endpoints
- [x] Finance CAN approve/reject/request-info on any `PENDING_APPROVAL` claim (v2 change — verify this is allowed, not blocked)
- [x] A claim cannot be submitted without `assignedApproverId`
- [x] Approved claim rejects direct PATCH mutation
- [x] Client-supplied total is ignored / server recalculates (checked against the DB row directly)
- [x] Zero line-item claim cannot be submitted
- [x] Negative/zero amount rejected
- [x] User A cannot fetch User B's receipt
- [x] Claimant cannot edit line items while `INFO_REQUESTED` (can only respond + attach receipts)
- [x] Only the claimant can call `respond-info` on their own claim

## 14. Integration Tests
All in `tests/integration/lifecycle.test.ts` and `rbac.test.ts`, run and passing against a real local Postgres.
- [x] Full lifecycle happy path: draft → submit (assign approver) → approve → reimburse — *(→ approve; reimburse dropped, see Decision log)*
- [x] Info-request round trip: submit → request-info → respond-info → approve
- [x] Reject → edit → resubmit (with reassigned approver) path, history preserved
- [x] Finance decides a claim assigned to an approver; verify approver can no longer act on it afterward
- [x] RBAC matrix smoke tests per role

## 15. Docker
- [ ] `docker compose up` brings up db + backend cleanly after `.env` setup — **written but not run**: no Docker was available in the environment this was built in (typecheck/build/tests were verified another way — a temporary embedded Postgres binary, see `TESTING.md`). **Please run `docker compose up --build` yourself once to confirm the container path itself works.**
- [x] Migration + seed run documented/scripted — see root `README.md` and `backend/DATABASE.md`
- [ ] `render.yaml` Blueprint deploys cleanly on Render — **written but not deployed**: no way to test an actual Render deployment from this environment. Same caveat as Docker above — please try a real Blueprint deploy before relying on it.

## 16. Documentation (deliverables — spec §29, backend-owned docs)
- [x] `ARCHITECTURE.md`
- [x] `API.md`
- [x] `DATABASE.md`
- [x] `AUTHORIZATION.md`
- [x] `TESTING.md`
- [x] `.env.example`
- [x] Backend section of root `README.md` (install, `.env`, migrations, seed, tests, credentials)

## 17. Final Acceptance Criteria (spec §30, adapted to v2)
- [x] All three roles can log in (real JWT auth) — verified over real HTTP with curl
- [x] RBAC enforced server-side end to end (test-proven)
- [x] Claim total cannot be manipulated (test-proven)
- [x] Line-item/date/amount validation enforced
- [x] Draft, submit-with-approver, approve/reject/request-info, rejection reason, info-request response, resubmission all work (test-proven)
- [x] Rejection history and message thread preserved; approved claims immutable (test-proven)
- [ ] ~~Reimbursement workflow complete~~ — dropped by decision, see Decision log
- [x] Audit trail complete and never overwritten (every `AuditLog` write is a `create`, never an `update`)
- [x] Finance filter + CSV export (DB-level filtering)
- [x] Finance can approve/reject/request-info on any pending claim (test-proven)
- [x] Unauthorized API access rejected (test-proven)
- [ ] Docker Compose works end-to-end — **not run in this environment**, see §15
- [ ] Render Blueprint deploys end-to-end — **not run in this environment**, see §15
- [x] Frontend's mock `services/api` layer successfully swapped for real HTTP calls with no other app changes — done and verified in a real browser (see `task-frontend.md`'s "Backend Integration" section)
