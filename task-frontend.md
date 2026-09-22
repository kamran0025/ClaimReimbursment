# Frontend Task Checklist — Expense Claims & Reimbursement Management System

Tracks implementation against `plan-frontend.md`. Check items off as completed; keep in delivery order.
Backend work is tracked separately in `task-backend.md`.

Status: **v1 complete and verified** (mock-API-first build, amount-routed approval chain). **v2 upgrade complete and verified** — direct approver assignment, Finance approval authority, info-request workflow, real receipt uploads. See `plan-frontend.md` revision note. **Backend integration complete and verified** — `services/api` now calls the real backend over HTTP; see the section below.

## v1 (done)
- [x] Vite/React/TS/Tailwind scaffold, providers, folder structure
- [x] Domain types + mock API layer + seed data (v1 amount-routed model)
- [x] Auth (login, session, protected routes)
- [x] Layouts + role-based navigation
- [x] Claimant pages (dashboard, my claims, create/edit, details, reimbursement status)
- [x] Approver pages (dashboard, approval queue, claim review, approval history)
- [x] Finance pages (dashboard, all claims, details, reimbursements, employees, audit logs, export)
- [x] Cross-cutting UX (loading/empty/error/confirm/toast/pagination/responsive)
- [x] Verified: clean type-check/build, full lifecycle smoke test, mobile viewport check

## v2 Upgrade — complete and verified

### 1. Domain Types + Mock API Layer
- [x] Update `ClaimStatus` enum: drop `SUBMITTED`, add `INFO_REQUESTED`
- [x] Remove `ApprovalRule`/`Approval` types; add `assignedApproverId`, `decidedById`, `decidedAt`, `submissionCycle` to `Claim`
- [x] Add `ClaimMessage` type (`INFO_REQUEST` | `RESPONSE`, message, optional attached receipt)
- [x] Add "list active approvers" mock endpoint for the assignment dropdown
- [x] Rewrite mock authorization: approver scope = `assignedApproverId === self`; Finance can decide any `PENDING_APPROVAL` claim
- [x] Mock state-machine guards for `request-info` / `respond-info` transitions
- [x] Receipt upload: accept real `File` objects (image/png/jpeg/webp, application/pdf), validate type + size (~5MB) both client-side and in the mock service, store as object URL for preview
- [x] Update seed data: every seeded claim gets an `assignedApproverId`; add at least one `INFO_REQUESTED` example claim with a message thread

### 2. Claim Creation / Editing
- [x] Approver-selection dropdown, required to Submit (not required to Save Draft)
- [x] Per-line-item receipt upload control (image/PDF) with thumbnail/PDF-icon preview and remove action
- [x] Resubmit flow allows reassigning the approver

### 3. Approver Experience
- [x] Replace "Approval Queue" (multi-step framing) with a simple filtered list of claims assigned to me
- [x] Claim Review: Approve / Reject (reason required) / Request Info (message required) — three clear actions, no step/queue language
- [x] Show message thread (info-requests + claimant responses) on Claim Review

### 4. Claimant Response to Info Requests
- [x] Claim Details shows an inline "respond" panel when status is `INFO_REQUESTED`
- [x] Reply textbox (required) + optional additional receipt upload
- [x] Submitting returns claim to `PENDING_APPROVAL` and appends to the message thread/audit log

### 5. Finance Approval Authority
- [x] Finance's Claim Details view gains the same Approve / Reject / Request Info actions as an approver, enabled for any `PENDING_APPROVAL` claim
- [x] All Claims list/filters still show every claim (unchanged) but now also link into the decision actions

### 6. Status & Badge Updates
- [x] Add `INFO_REQUESTED` status badge (distinct color) everywhere statuses are shown
- [x] Remove `SUBMITTED`-specific UI (transient status no longer exists in v2)
- [x] Dashboards: replace any "current step"/approval-chain-position language with "assigned approver" / "awaiting response" as appropriate

### 7. Verification
- [x] `tsc --noEmit` / `vite build` clean
- [x] Dev server boots without runtime errors
- [x] Manual smoke test: create claim with receipt upload → assign approver → submit → approver requests info → claimant responds → approver approves → finance reimburses
- [x] Manual smoke test: Finance approves a claim assigned to a different approver
- [x] Manual smoke test: Approver B cannot see/act on a claim assigned to Approver A
- [x] Manual smoke test: reject → edit → resubmit with a different approver
- [x] Mobile viewport check on updated screens (file upload control, message thread)

## Backend Integration — complete and verified

- [x] Swap `services/api` mock implementation for real HTTP calls against the live v2 backend contract — every function in `authService.ts`, `usersService.ts`, `claimsService.ts`, `auditService.ts`, `financeService.ts`, `dashboardService.ts` rewritten to call the real backend via a new `httpClient.ts` (`fetch` + `credentials:'include'`, parses the `{success,data}`/`{success,error}` envelope). Exported names/params/return shapes unchanged — `services/api/index.ts` (the "one boundary") didn't need to change at all.
- [x] Real file upload wired to backend storage instead of object URLs — `addReceipt` now posts real `multipart/form-data` to `POST /claims/:id/receipts`; `Receipt.url` (backend-relative) is absolutized to the API origin so `<img src>`/`<a href>` in `ReceiptPreview` resolve correctly (verified in-browser: a real uploaded file's thumbnail rendered for both the uploading claimant and the reviewing approver).
- [x] Remove mock store/seed data from production build path — `services/api/db.ts`, `session.ts`, `latency.ts`, `scope.ts` deleted (mock-only; nothing else imported them). `stateMachine.ts` trimmed to the two pure predicates (`isEditableStatus`, `isInReview`) still used for UI gating — enforcement now lives entirely server-side. `AuthContext` no longer bootstraps from `localStorage`; it calls `GET /auth/me` and relies on the httpOnly cookie, same as a real backend requires.
- [x] `authService.listSeededLogins()`/`DEMO_PASSWORD` kept, but hardcoded client-side (mirroring `backend/prisma/seed.ts`'s fixed identities) rather than fetched — the real backend deliberately has no unauthenticated "list every user" endpoint (that would be a real info-disclosure hole).
- [x] `respondToInfoRequest(claimId, {message, receiptFile})` — the mock did this in one call; the real backend keeps upload and respond-info as two separate REST calls (per plan-backend.md §7), so the function now orchestrates both while keeping its own signature/return shape identical. See `backend/API.md`'s integration note.
- [x] Added `frontend/.env.example` (`VITE_API_BASE_URL`, default `http://localhost:4000`) and `src/vite-env.d.ts` typing it.
- [x] `tsc -b` / `vite build` / oxlint all clean after the swap.
- [x] Re-ran a real end-to-end smoke test — not just typecheck — against a real (temporary, embedded) Postgres + the actual backend server + the actual Vite dev server, driven by headless Chromium (Playwright, since `chromium-cli` wasn't available in this environment): logged in as a claimant, viewed the dashboard/claims list/claim detail with real seeded data, created a new claim, added a line item with a real image receipt upload, submitted it with an assigned approver, then logged in as that approver and approved it — all through the real HTTP stack, screenshots confirmed correct rendering (including the uploaded receipt's thumbnail), no unexpected console/network errors. Reimbursement not exercised — dropped from scope, see `task-backend.md`'s decision log.
