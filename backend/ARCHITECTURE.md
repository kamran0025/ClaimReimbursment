# Backend Architecture

Express + TypeScript API backing the Expense Claims & Reimbursement
Management System (v2 — direct approver assignment, Finance blanket
approval, info-request workflow). See `../plan-backend.md` for the original
design plan; this document describes what was actually built and where it
diverges.

## Layers

```
routes/          HTTP layer: param/query parsing, calls one service function, shapes the response.
middleware/       authenticate, authorize, validate (Zod), upload (multer), errorHandler.
services/         business logic, transactions, authorization scoping. This is where the rules live.
validation/       Zod schemas for request bodies/queries.
lib/               env, prisma client singleton, cookie helpers.
types/             the {success,data}/{success,error} wire envelope, Express Request augmentation.
```

Routes are thin. A route handler: validates input shape (via a `validateBody`/`validateQuery`
middleware), extracts `{id, role}` from `req.user`, calls exactly one service
function, and wraps the result in `ok(...)`. Every business rule — ownership,
state-machine legality, who may decide what — lives in `services/`, never in
a route or in Prisma `where` clauses assembled ad hoc at the call site.

Repositories were folded into the service files rather than kept as a
separate layer: for this POC's scale, a dedicated repository layer added a
level of indirection without a second consumer to justify it (every service
is Prisma-specific already, and there is exactly one caller per query
shape). `services/claimQueryService.ts` centralizes the read-side `include`
shapes so at least that part isn't duplicated across services.

## The one security boundary

`services/claimScope.ts` — `getClaimScopeFilter(user)` builds the Prisma
`where` clause every claim list/detail query is scoped by, and
`assertClaimInScope` / `assertOwner` gate single-claim reads and mutations.
No route or service ever fetches a claim and filters it in JS after the
fact — the scope is always applied at the query itself (list) or asserted
against the loaded row before any further logic runs (detail/mutate).

## State machine

`services/claimStateMachine.ts` holds every transition guard
(`assertEditable`, `assertSubmittable`, `assertCancellable`, `assertDecidable`,
`assertRespondable`). Every mutation in `claimMutationService.ts` calls the
relevant guard before touching `status` — no route or service sets `status`
from a raw request body.

## Transactions

Every multi-step mutation (submit/resubmit, approve, reject, request-info,
respond-info, item add/update/delete) runs inside one `prisma.$transaction`:
read-then-guard, apply the change, recompute `claim.total` if items changed,
write one `AuditLog` row — all atomically. See `services/auditLogService.ts`
(`recordAudit`) and `services/claimTotalService.ts`
(`recalculateClaimTotal` — the sole writer of `claim.total`).

## Storage abstraction

`services/storage/storage.ts` defines a minimal `Storage` interface
(`save`/`read`/`delete`); `localDiskStorage.ts` is the only implementation
today, writing under `UPLOAD_DIR` with a random filename (never the
client-supplied name, so path traversal via a crafted filename is
structurally impossible). Swapping to S3 later means writing one new class
against the same interface — no caller changes.

## Deviations from `plan-backend.md`

- **Reimbursement dropped entirely.** The frontend this backend serves
  never implements the `REIMBURSEMENT_PENDING`/`REIMBURSED` statuses or a
  `/reimbursements` resource — `APPROVED` is its terminal claim status. Per
  a decision made during implementation (see `task-backend.md`'s decision
  log), the backend matches the frontend's actual v2 contract instead of
  the plan's older text: no `Reimbursement` model, no reimbursement
  statuses, no reimbursement endpoints.
- **`DELETE /claims/:id/receipts/:receiptId` added.** The plan's §7 endpoint
  list omitted this, but the frontend's `EditClaimPage` calls it (removing a
  receipt from a still-editable claim) — added to match actual frontend
  usage.
- **`GET /audit` (global, Finance-only, paginated) added.** Also omitted
  from the plan's endpoint list but required by the frontend's Finance audit
  log page (`listAllAudit`).
- **Prisma pinned to `6.19.3`**, not the `latest` npm dist-tag. Prisma 7
  removed the classic `datasource { url = env(...) }` schema config in favor
  of a `prisma.config.ts` + driver-adapter setup; for a POC of this size
  that migration cost wasn't worth taking on, so the schema stays on the
  last 6.x line (which also happens to be the version `npm audit` already
  recommended, clearing an unrelated `mysql2` advisory pulled in by the
  Prisma CLI's multi-database config support).
