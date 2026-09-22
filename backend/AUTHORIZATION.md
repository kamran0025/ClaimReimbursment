# Authorization

Three roles: `CLAIMANT`, `APPROVER`, `FINANCE`. No permission flags, no
per-org scoping (single-tenant POC).

## The one real security boundary

`services/claimScope.ts`:

- `getClaimScopeFilter(user)` → a Prisma `where` clause, applied to every
  claim **list** query:
  - `CLAIMANT` → `{ claimantId: user.id }`
  - `APPROVER` → `{ assignedApproverId: user.id }`
  - `FINANCE` → `{ status: { not: 'DRAFT' } }` (Finance sees every
    submitted-or-further claim, but never another user's unsubmitted draft)
- `assertClaimInScope(user, claim)` → the same decision, applied to a
  single already-loaded claim (detail reads, receipt download, audit
  reads), throwing `CLAIM_NOT_ASSIGNED` (approver) or `CLAIM_NOT_OWNED`
  (claimant/finance) — both 403 — if it fails.
- `assertOwner(user, claim)` → `claimantId === user.id`, used by every
  claimant-only mutation (create/edit claim, items, receipts,
  submit/resubmit/cancel, respond-info).

Every query that lists or fetches a claim takes the *caller's identity* and
applies this at the Prisma query level — never "fetch everything, then
filter in JS." The frontend's route guards and disabled buttons are UX
conveniences only; they enforce nothing on their own.

## Route-level role gates

`middleware/authorize.ts` — a coarse first gate before a request reaches
the service layer:

| Route | Gate |
|---|---|
| `POST /claims/:id/approve` \| `reject` \| `request-info` | `authorizeDecisionMaker` → `APPROVER` or `FINANCE` |
| `GET /audit` (global) | `FINANCE` |
| `GET /finance/export` | `FINANCE` |
| `GET /users/employees` | `FINANCE` |
| `GET /dashboards/claimant` \| `approver` \| `finance` | matching role only |

Everything else (create claim, items, receipts upload, submit/cancel,
respond-info) has **no** route-level role gate — the service layer's
ownership check (`assertOwner`) is the actual boundary, because ownership
already implies "this is a claimant, and it's their claim" (only a
`CLAIMANT` can ever be a claim's `claimantId`, since `createClaim` itself
is gated to `CLAIMANT` — see below).

## Decision matrix (v2)

| Action | Claimant | Approver | Finance |
|---|---|---|---|
| Create / edit own DRAFT or REJECTED claim | ✅ own only | ❌ | ❌ |
| View claim | ✅ own only | ✅ only if `assignedApproverId === self` | ✅ any non-DRAFT |
| Submit / resubmit (choose approver) | ✅ own only | ❌ | ❌ |
| Approve / Reject / Request info | ❌ | ✅ only if assigned to self **and** status is `PENDING_APPROVAL`/`INFO_REQUESTED` | ✅ any claim in that state, regardless of assignment |
| Respond to an info request | ✅ own claim only | ❌ | ❌ |
| Upload receipt | ✅ own claim's | ❌ | ❌ |
| View / download receipt | ✅ own claim's | ✅ assigned claim's | ✅ any non-DRAFT claim's |
| Delete receipt | ✅ own claim's, while editable | ❌ | ❌ |
| Cancel claim | ✅ own only, before a decision | ❌ | ❌ |
| CSV export / global audit log / employee directory | ❌ | ❌ | ✅ |

Enforced by, respectively: `createClaim`'s explicit role check;
`getClaimScopeFilter`/`assertClaimInScope`; `assertOwner` +
`assertSubmittable`; `assertDecidable` (checks `isInReview(status)` **and**
`role === FINANCE || assignedApproverId === user.id`); `assertRespondable`
(`isInReview(status) && claimantId === user.id`); `assertOwner` (+ the
`INFO_REQUESTED`-specific "no existing item may be touched" rule) for
receipts; `assertCancellable`.

## "Whoever decides first wins"

Finance has blanket approval authority *in addition to* the assigned
approver — there's no queue or turn order. Both `approveClaim`,
`rejectClaim`, and `requestInfo` re-check `assertDecidable` **inside the
same transaction** that reads the claim's current status, so if two
decision-makers race on the same claim, the loser's transaction sees the
already-updated status and fails with `CLAIM_NOT_PENDING_APPROVAL` (409) —
normal Postgres transaction isolation on the row update, no extra locking
needed. Covered by
`tests/integration/lifecycle.test.ts`'s "Finance can decide a claim
assigned to an approver" case.

## Error codes → HTTP status

See `services/errors.ts` (`STATUS_BY_CODE`) for the authoritative mapping.
Authorization-relevant ones: `UNAUTHENTICATED` → 401, `FORBIDDEN_ROLE` /
`CLAIM_NOT_OWNED` / `CLAIM_NOT_ASSIGNED` → 403, `CLAIM_NOT_FOUND` /
`ITEM_NOT_FOUND` / `RECEIPT_NOT_FOUND` → 404, everything state-machine
related (`CLAIM_NOT_EDITABLE`, `CLAIM_NOT_PENDING_APPROVAL`,
`CLAIM_NOT_CANCELLABLE`, `CLAIM_INVALID_TRANSITION`, `CLAIM_EMPTY_ITEMS`,
`CLAIM_TOTAL_MISMATCH`) → 409.
