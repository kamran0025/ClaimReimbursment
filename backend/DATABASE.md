# Database

PostgreSQL via Prisma ORM. Schema: `prisma/schema.prisma`. Single migration
so far: `prisma/migrations/20260921064744_init`.

## Models

| Model | Purpose |
|---|---|
| `User` | All three roles (`FINANCE`, `APPROVER`, `CLAIMANT`) in one table, distinguished by `role`. `isActive` soft-disables a login without deleting history. |
| `Claim` | One row per claim. `total` is derived/cached (§ below) — never client-writable. `assignedApproverId` is null until first submit. `decidedById`/`decidedAt` record whoever (the assigned approver, or any Finance user) resolved the current submission cycle. `submissionCycle` increments on each resubmit; nothing is deleted on rejection/resubmit, so cycle history stays queryable via `AuditLog`. |
| `ClaimItem` | Line items. `amount` is `Decimal(10,2)` — never a float — to avoid rounding drift across repeated add/edit/delete cycles. |
| `Receipt` | One row per uploaded file. `storagePath` is an opaque key into the `Storage` abstraction (a random filename on local disk today), never the client-supplied filename. `claimItemId` is nullable — a receipt can be tied to a specific line item or stand alone (e.g. an info-request attachment). |
| `ClaimMessage` | The info-request/response thread. `type` distinguishes an approver/Finance question (`INFO_REQUEST`) from a claimant reply (`RESPONSE`). `attachedReceiptId` optionally points at a `Receipt` uploaded alongside a response. |
| `AuditLog` | Append-only. One row per state-changing action, written inside the same transaction as the change (`oldStatus`/`newStatus` captured explicitly rather than diffed after the fact). `metadata` is a free-form JSON bag for action-specific detail (e.g. `{reason}` on a rejection). |

Enums: `Role`, `ClaimStatus` (`DRAFT` → `PENDING_APPROVAL`/`INFO_REQUESTED` →
`APPROVED`/`REJECTED`/`CANCELLED` — see `AUTHORIZATION.md` for the full
transition table), `ClaimMessageType`, `AuditAction`.

**Not modeled:** `ApprovalRule`/`ApprovalStep` (v1's amount-tiered
multi-approver chain — dropped in v2 for direct assignment) and
`Reimbursement` (dropped during backend implementation because the
frontend never implements it — see `ARCHITECTURE.md`'s deviations section).

## Claim total integrity

`claim.total` is a cached column, recomputed — never accepted — on every
write path:

- Every request DTO (`createClaimSchema`, item schemas, etc.) simply has no
  `total` field, so a client-supplied value in the raw JSON body is dropped
  by Zod's default behavior of stripping unknown keys.
- `recalculateClaimTotal(tx, claimId)` (`services/claimTotalService.ts`) is
  the **only** code path that writes `Claim.total`. It re-reads every
  `ClaimItem` for the claim inside the current transaction and sums with
  `Prisma.Decimal` arithmetic (`sumAmounts`, unit-tested in isolation —
  `tests/unit/claimTotalService.test.ts` — specifically to catch the
  classic `0.1 + 0.2` float drift that a plain JS sum would reintroduce).
- Every `ClaimItem` create/update/delete calls it before the transaction
  commits.
- `submitClaim`/`resubmitClaim` recompute the total one more time and would
  reject with `CLAIM_TOTAL_MISMATCH` (409) if it ever disagreed with a fresh
  sum of items — this is a defensive assertion; it should be unreachable by
  construction since nothing else can write `total`.

## Indexes

`Claim.claimantId`, `Claim.status`, `Claim.assignedApproverId`,
`Claim.createdAt`, `ClaimItem.claimId`, `Receipt.claimId`,
`Receipt.claimItemId`, `ClaimMessage.claimId`, `AuditLog.claimId`,
`User.role`. Unique: `User.email`.

## Cascade behavior

`ClaimItem`, `Receipt`, `ClaimMessage`, `AuditLog` all cascade-delete with
their parent `Claim` (claims are never actually deleted by any endpoint in
this app, but this keeps the schema consistent for, e.g., test cleanup).
`Receipt.claimItemId` is `SET NULL` on item delete at the FK level, but in
practice `claimMutationService.deleteItem` explicitly deletes any receipts
attached to that item first (and removes their underlying files via
`Storage.delete`) rather than relying on orphaned receipts sticking around
with a null `claimItemId` — matching the product intent ("any receipt
attached to this item goes with it").

## Migrations

Generated once, offline (no live database was available while building
this), via:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Going forward, use the normal Prisma workflow against a running dev
database: `npm run prisma:migrate` (i.e. `prisma migrate dev`) to create and
apply new migrations as the schema evolves, `npm run prisma:deploy` in
CI/production to apply pending migrations without prompting.

## Seeding

`prisma/seed.ts` — reuses the exact same 7 demo identities (same ids,
emails, names) as the frontend's mock `services/api/db.ts`, all with
password `password123`, so logging in against the real backend and against
the mock look identical. Seeds one claim in every `ClaimStatus`, including
`INFO_REQUESTED` and a resubmitted (`submissionCycle: 2`) example.

Guarded to run at most once: it checks `User` count first and does nothing
if the database already has any users (whether from a prior seed run, or
real usage). This makes it safe to invoke unconditionally on every
container boot — see `backend/Dockerfile`'s `CMD` — without risk of
wiping real data on a redeploy. Manual invocation still works the same way
against a genuinely empty database:

```bash
npm run prisma:seed
```
