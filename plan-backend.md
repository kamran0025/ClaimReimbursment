# Backend Implementation Plan — Expense Claims & Reimbursement Management System

Source spec: `Claude Code Prompt — Expense Claims & Reimbursement Application.md`
Companion: `plan-frontend.md` (UI plan) · `task-backend.md` (checklist for this plan)

> **Revision v2.** The original spec's amount-based, multi-step approval-chain routing (spec §9) has been replaced at the user's request with **direct approver assignment**: the claimant picks a single approver per claim, that approver (plus Finance, who now also has approval authority) decides it directly — no queue, no chain, no per-tier approver count. A new **info-request** workflow lets an approver/Finance ask the claimant a question or request more documents without a full rejection. Receipts are now a first-class upload (image/PDF) done while adding claim items. Everything below reflects v2; sections superseded from v1 are noted where relevant so the reasoning isn't lost.
>
> **Implementation note (backend build).** During backend implementation, reimbursement (§1, §4, §7, §8's `Reimbursement` model, `REIMBURSEMENT_PENDING`/`REIMBURSED` statuses, `/reimbursements` endpoints) was **dropped from scope**, decided with the user: the frontend built against this plan never implemented it (no reimbursement UI/service; `APPROVED` is its terminal claim status), so the backend was built to match the frontend's actual contract instead. See `task-backend.md`'s decision log and `backend/ARCHITECTURE.md` for the full rationale. Everything else below still reflects what was actually built.

## 1. Assumptions

- Currency is INR (₹) for display purposes only; amounts stored using Prisma `Decimal` (2 decimal places) to avoid float rounding errors.
- Single-tenant POC (no multi-company/org support).
- Local disk storage for receipts and info-request attachments under a gitignored `uploads/` directory, behind an authenticated download endpoint — never served as static files.
- **Approval is direct, not routed.** Each claim has exactly one `assignedApproverId`, chosen by the claimant from the list of active approvers at submit time. There is no amount-based tiering and no multi-step chain — v1's `ApprovalRule`/multi-row `ApprovalStep` design is dropped entirely.
- **Finance has blanket approval authority.** In addition to seeing every claim, Finance can approve, reject, or request info on *any* claim regardless of `assignedApproverId` — a Finance decision and the assigned approver's decision are the same action or (whichever happens first wins; the other becomes moot since the claim leaves `PENDING_APPROVAL`).
- Only one decision-maker acts per submission cycle (whoever decides first), so a single `decidedById/decidedAt` pair on `Claim` is enough — no separate approval-steps table is needed to track "who's turn is it," since v2 has no turns.
- No email/notification system in POC scope (out of scope per "do not overengineer").

## 2. Tech Stack

- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- Auth: JWT (access token via httpOnly cookie), bcrypt for password hashing
- Testing: Vitest + Supertest
- Infra: Docker + Docker Compose (local dev/test), Render Blueprint (`render.yaml`) for deployment

## 3. High-Level Architecture

```
React (Vite SPA)  [see plan-frontend.md]
   ↓ REST/JSON
Express API (TS)
   ├── routes/          HTTP layer, input parsing
   ├── middleware/       authenticate, authorize, error handler
   ├── services/         business logic, transactions, authorization checks
   ├── repositories/     Prisma queries (thin, scoped by caller identity)
   └── validation/       Zod schemas (shape shared conceptually with frontend types)
   ↓ Prisma Client
PostgreSQL
```

Key principle: **routes are thin, services own business rules and authorization scoping, repositories never trust caller-supplied filters beyond what the service explicitly passes**.

## 4. Database Schema (Prisma models, summary)

```
User            id, name, email(unique), passwordHash, role(enum), isActive, timestamps
Claim           id, claimantId(FK), title, status(enum), total(Decimal, derived),
                assignedApproverId(FK -> User, nullable until submit),
                decidedById(FK -> User, nullable), decidedAt(nullable),
                rejectionReason, rejectedById, rejectedAt,
                submittedAt, submissionCycle(int, default 0), timestamps
ClaimItem       id, claimId(FK), expenseDate, category, description, amount(Decimal), merchant, timestamps
Receipt         id, claimId(FK), claimItemId(FK, nullable), fileName, mimeType, fileSize, storagePath, uploadedById, timestamps
ClaimMessage    id, claimId(FK), senderId(FK -> User), type(enum: INFO_REQUEST | RESPONSE), message(text),
                attachedReceiptId(FK -> Receipt, nullable), createdAt
Reimbursement   id, claimId(FK unique), amount, method(enum), referenceNumber, reimbursedAt, processedById, timestamps
AuditLog        id, claimId(FK), actorId(FK nullable for system), action(enum), oldStatus, newStatus, metadata(Json), createdAt
```

**Dropped from v1:** `ApprovalRule` (amount-tier config) and the multi-row `ApprovalStep`/`Approval` table — no longer needed once there is exactly one decision per submission cycle. If a future requirement reintroduces multi-approver chains, reintroduce a steps table then; don't build it speculatively now.

Enums: `Role{FINANCE,APPROVER,CLAIMANT}`, `ClaimStatus{DRAFT,PENDING_APPROVAL,INFO_REQUESTED,REJECTED,APPROVED,REIMBURSEMENT_PENDING,REIMBURSED,CANCELLED}`, `ReimbursementMethod{BANK_TRANSFER,PAYROLL,CASH,OTHER}`, `ClaimMessageType{INFO_REQUEST,RESPONSE}`, `AuditAction{CLAIM_CREATED,CLAIM_UPDATED,CLAIM_SUBMITTED,CLAIM_INFO_REQUESTED,CLAIM_INFO_RESPONDED,CLAIM_REJECTED,CLAIM_RESUBMITTED,CLAIM_APPROVED,REIMBURSEMENT_PENDING,REIMBURSED,CLAIM_CANCELLED}`.

Receipt `mimeType` is restricted server-side to `image/jpeg`, `image/png`, `image/webp`, `application/pdf`; `fileSize` capped (e.g. 5MB) — both enforced in the upload handler, not just the frontend `accept` attribute.

Indexes: `Claim.claimantId`, `Claim.status`, `Claim.assignedApproverId`, `Claim.createdAt`, `ClaimMessage.claimId`, `AuditLog.claimId`. Unique on `Reimbursement.claimId`.

### 4.1 Claim Total Integrity Design

Unchanged from v1 — this rule is independent of the approval-routing change:

- `claim.total` is a **cached/derived column**, never accepted from client input on any write path (create/update DTOs strip it).
- Every mutation that touches `ClaimItem` rows (create/update/delete) runs inside a Prisma `$transaction` that: (1) applies the item mutation, (2) recomputes `SUM(ClaimItem.amount)` for that claim within the same transaction, (3) writes the result back to `claim.total`.
- A single service function `recalculateClaimTotal(tx, claimId)` is the only code path allowed to write `claim.total`. All item mutations call it before commit.
- Submission validates `claim.total === SUM(items)` as a defensive assertion and rejects with 409 if violated.
- Tests: client-supplied `total` in any request body → ignored; recompute correctness after add/edit/delete cycles.

## 5. State Machine (v2)

```
DRAFT ──(submit, must pick assignedApproverId)──→ PENDING_APPROVAL
                                                        │
                        ┌───────────────────────────────┼───────────────────────────┐
                        │                                │                           │
                 (approve)                        (request info)              (reject, reason required)
                        │                                │                           │
                        ▼                                ▼                           ▼
                    APPROVED                     INFO_REQUESTED                  REJECTED
                        │                                │                           │
             REIMBURSEMENT_PENDING            (claimant responds)               (claimant edits)
                        │                                │                           │
                    REIMBURSED                  back to PENDING_APPROVAL          DRAFT
                                                                                       │
                                                                             (resubmit, may reassign approver)
                                                                                       ▼
                                                                              PENDING_APPROVAL (new cycle)

DRAFT / PENDING_APPROVAL (before a decision) → CANCELLED (claimant only)
```

Rules enforced centrally in `claimStateMachine.ts` (a transition table: `{from, to, allowedRoles, guard}`), consulted by every service method that changes `status`. No route ever sets `status` directly from request body.

- **Who can act:** the current `assignedApproverId` OR any Finance user can approve/reject/request-info while a claim is `PENDING_APPROVAL`. Whichever of them acts first decides it; the claim leaves `PENDING_APPROVAL` so there's no race to resolve beyond normal transaction isolation on the row update.
- **Immutability while pending/info-requested:** once a claim leaves `DRAFT`, the claimant cannot edit line items, amounts, or receipts on existing items until the claim is `REJECTED` (spec §10/§13 principle, preserved). While `INFO_REQUESTED`, the claimant may only post a text `ClaimMessage` response and optionally attach one or more *additional* receipts (new `Receipt` rows) — existing items stay locked. If the approver/Finance decides real changes to amounts/items are needed, they must `REJECT` with a reason instead of endlessly requesting info; this keeps the total-integrity invariant simple (line items only ever change in `DRAFT`).
- **Resubmission:** approver may be reassigned to someone else on resubmit; `submissionCycle` increments; prior `ClaimMessage`/`AuditLog`/rejection history is retained, never deleted, and stays queryable per cycle.
- No `SUBMITTED` transient status in v2 — submit goes straight to `PENDING_APPROVAL` since there's no chain to build first.

## 6. Authorization Matrix (v2)

| Action | Claimant | Approver | Finance |
|---|---|---|---|
| Create/edit own DRAFT claim | ✅ (own) | ❌ | ❌ |
| View claim | ✅ own only | ✅ only if `assignedApproverId === self` | ✅ all |
| Submit/resubmit (choose approver) | ✅ own only | ❌ | ❌ |
| Approve / Reject / Request info | ❌ | ✅ only if assigned to self AND status `PENDING_APPROVAL` | ✅ any claim in `PENDING_APPROVAL` |
| Respond to an info request | ✅ own claim only | ❌ | ❌ |
| View / upload receipts | ✅ own claim's | ✅ assigned claim's (view only) | ✅ all |
| Mark reimbursed | ❌ | ❌ | ✅ |
| CSV export | ❌ | ❌ | ✅ |
| View audit log / message thread | ✅ own claim | ✅ assigned claim | ✅ all |

Implementation: every service query that lists/fetches a claim takes `currentUser` and applies a `WHERE` scope at the Prisma query level (never fetch-then-filter-in-JS for authorization). A single `getClaimScopeFilter(user)` helper builds the Prisma `where` clause per role: claimants filter by `claimantId`, approvers filter by `assignedApproverId`, Finance gets no filter.

This is the **only real security boundary**. The frontend's route guards and disabled buttons (see `plan-frontend.md`) are UX conveniences only and must never be relied upon.

## 7. API Contract (see API.md deliverable for full docs)

```
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /users/approvers               (active approver list, for the assignment dropdown)

GET    /claims
POST   /claims
GET    /claims/:id
PATCH  /claims/:id
POST   /claims/:id/submit             { assignedApproverId }
POST   /claims/:id/resubmit           { assignedApproverId }
POST   /claims/:id/cancel

POST   /claims/:id/items
PATCH  /claims/:id/items/:itemId
DELETE /claims/:id/items/:itemId

POST   /claims/:id/receipts           (multipart, image/pdf; optional claimItemId)
GET    /claims/:id/receipts/:receiptId  (download, authenticated + scoped)

POST   /claims/:id/approve            (assigned approver or Finance)
POST   /claims/:id/reject             { reason }
POST   /claims/:id/request-info       { message }
POST   /claims/:id/respond-info       { message, attachedReceiptId? }   (claimant)
GET    /claims/:id/messages

GET    /reimbursements
POST   /claims/:id/reimburse

GET    /audit/claims/:claimId

GET    /finance/export
GET    /dashboards/claimant | /approver | /finance
```

**Dropped from v1:** the `/approvals` resource (list/get/approve/reject against a separate approval-step entity) — actions now hang directly off `/claims/:id` since there's no step to address independently of the claim.

All mutating endpoints require `authenticate()` + role-specific `authorize(...)`; ownership/assignment checks happen inside the service layer (403 `CLAIM_NOT_OWNED` / `CLAIM_NOT_ASSIGNED`). Error shape and status codes per spec §25 (`{success:false, error:{code,message}}`).

**Frontend coupling note:** the frontend was built first (and has now been updated to v2) against a mock implementation of this exact contract (see `plan-frontend.md` §Mock API Layer). When implementing each real endpoint, match its request/response shape and error codes exactly so the frontend's `services/api` module can be swapped from mock to real with no other changes.

## 8. Transactions (spec §26)

Wrap in `prisma.$transaction`:
1. Submit/resubmit claim — recompute total, set `assignedApproverId`, set status `PENDING_APPROVAL`, bump `submissionCycle` on resubmit, audit log.
2. Approve — validate actor is assigned approver or Finance, validate state, set `decidedById/decidedAt`, status `APPROVED`, audit log.
3. Reject — set rejection fields, status `REJECTED`, audit log.
4. Request info — create `ClaimMessage`, status `INFO_REQUESTED`, audit log.
5. Respond info — create `ClaimMessage` (+ optional `Receipt`), status back to `PENDING_APPROVAL`, audit log.
6. Reimburse — validate `APPROVED`/`REIMBURSEMENT_PENDING`, create `Reimbursement`, set `REIMBURSED`, audit log.
7. Item mutation — apply change + `recalculateClaimTotal`.

## 9. Testing Strategy

- Unit: state machine transition table, total-recalculation service.
- Integration (Supertest + test DB): full lifecycle happy path (draft → submit → approve → reimburse); info-request round trip (request-info → respond-info → approve); every case in spec §21 security test list adapted to v2 (e.g. "Approver A tries to act on a claim assigned to Approver B" → rejected; "Finance can approve any pending claim" → allowed); RBAC matrix smoke tests per role.
- Run against a dedicated `docker-compose` Postgres test DB (Prisma against a real Postgres test schema — no SQLite substitution, since it changes constraint/enum behavior).

## 10. Delivery Order

1. Project setup (backend half of monorepo)
2. Prisma schema/migrations (v2 schema)
3. Authentication
4. RBAC middleware + authorization helpers
5. Claim CRUD + line items + total integrity
6. Receipts (image/PDF upload + validation)
7. Direct approver assignment on submit/resubmit
8. Approve / reject / request-info / respond-info
9. Resubmission
10. Reimbursement
11. Audit trail + message thread
12. Finance export
13. Dashboard endpoints
14. Security test suite
15. Integration tests
16. Docker Compose (backend + db services); Render Blueprint (`render.yaml`) for deployment
17. Documentation (ARCHITECTURE.md, API.md, DATABASE.md, AUTHORIZATION.md, TESTING.md)

Detailed step checklist tracked in `task-backend.md`.
