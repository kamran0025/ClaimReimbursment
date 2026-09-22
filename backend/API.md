# API Reference

Base URL: `http://localhost:4000` (dev). All requests/responses are JSON
except file upload (`multipart/form-data`) and file/CSV download
(binary/`text/csv`). Auth is a single httpOnly cookie (`access_token`) set
by `POST /auth/login` — the SPA must send `credentials: 'include'` (or
`withCredentials: true`) on every request.

## Envelope

Every response is one of:

```ts
{ success: true, data: T }
{ success: false, error: { code: string, message: string, details?: object } }
```

See `services/errors.ts` for the full `ErrorCode` list and its HTTP status
mapping (mirrors `frontend/src/services/api/errors.ts` exactly — this is
the contract the frontend's mock layer was built against).

## Auth

| Method & Path | Auth | Body | Notes |
|---|---|---|---|
| `POST /auth/login` | none | `{ email, password }` | Sets the `access_token` cookie. Returns the `User`. |
| `POST /auth/logout` | none | — | Clears the cookie. |
| `GET /auth/me` | any | — | Returns the current `User`. |

## Users

| Method & Path | Auth | Notes |
|---|---|---|
| `GET /users/approvers` | any authenticated | Active `APPROVER` users, for the "assign an approver" dropdown. |
| `GET /users/employees` | `FINANCE` | Every `CLAIMANT`/`APPROVER` user (employee directory). |

## Claims

| Method & Path | Auth | Body / Query | Notes |
|---|---|---|---|
| `GET /claims` | any | query: `status`, `claimantId`, `assignedApproverId`, `decidedById`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`, `search`, `page`, `pageSize` | Scoped per role (see `AUTHORIZATION.md`). Returns `Paginated<Claim>`. |
| `POST /claims` | `CLAIMANT` | `{ title }` | Creates a `DRAFT`. |
| `GET /claims/:id` | scoped | — | Returns `ClaimDetail` (`Claim` + `items`, `receipts`, `messages`). |
| `PATCH /claims/:id` | owner | `{ title? }` | Only while `DRAFT`/`REJECTED`. |
| `POST /claims/:id/submit` | owner | `{ assignedApproverId }` | `DRAFT`/`REJECTED` → `PENDING_APPROVAL`. Requires ≥1 item, all positive amounts, a valid active approver. |
| `POST /claims/:id/resubmit` | owner | `{ assignedApproverId }` | Same guards as submit; only legal from `REJECTED`. Bumps `submissionCycle`, may reassign approver. |
| `POST /claims/:id/cancel` | owner | — | Legal from `DRAFT`, or `PENDING_APPROVAL` before a decision. |

### Line items

| Method & Path | Auth | Body |
|---|---|---|
| `POST /claims/:id/items` | owner, claim editable | `{ expenseDate, category, description, amount, merchant? }` |
| `PATCH /claims/:id/items/:itemId` | owner, claim editable | same shape |
| `DELETE /claims/:id/items/:itemId` | owner, claim editable | — |

All three return the updated `ClaimDetail` with `total` freshly
recalculated server-side. `amount` must be `> 0`; `expenseDate` must parse
and not be more than 24h in the future.

### Receipts

| Method & Path | Auth | Notes |
|---|---|---|
| `POST /claims/:id/receipts` | owner | `multipart/form-data`, field `file` (image/jpeg, image/png, image/webp, or application/pdf; ≤5MB), optional field `claimItemId`. Legal while `DRAFT`/`REJECTED` (any `claimItemId`), or `INFO_REQUESTED` with **no** `claimItemId` (existing items stay locked). |
| `GET /claims/:id/receipts/:receiptId` | scoped (owner, assigned approver, or Finance) | Streams the file with its original `Content-Type` and `Content-Disposition: attachment`. Never served as a static file. |
| `DELETE /claims/:id/receipts/:receiptId` | owner | Same editability rule as upload. *(Not in the original plan's endpoint list — added to match the frontend's `EditClaimPage`, which does call this.)* |

### Decisions

| Method & Path | Auth | Body |
|---|---|---|
| `POST /claims/:id/approve` | assigned approver or Finance | — |
| `POST /claims/:id/reject` | assigned approver or Finance | `{ reason }` (non-empty) |
| `POST /claims/:id/request-info` | assigned approver or Finance | `{ message }` (non-empty) |
| `POST /claims/:id/respond-info` | claimant, own claim | `{ message, attachedReceiptId? }` |
| `GET /claims/:id/messages` | scoped | Returns `ClaimMessage[]`. |

All decision endpoints require the claim to be `PENDING_APPROVAL` or
`INFO_REQUESTED` (`isInReview`). `respond-info` moves `INFO_REQUESTED` back
to `PENDING_APPROVAL`; if called while already `PENDING_APPROVAL` (a
proactive message), the status doesn't change.

> **Integration note for whoever swaps the frontend's mock `services/api`
> for real HTTP calls:** the mock's `respondToInfoRequest(claimId, {message,
> receiptFile})` does a file upload *and* posts the response message in one
> call. The real backend keeps these as two separate REST calls per the
> original plan (`POST /claims/:id/receipts` to get a `Receipt.id`, then
> `POST /claims/:id/respond-info` with that id as `attachedReceiptId`). The
> real `services/api/claimsService.ts` implementation of
> `respondToInfoRequest` needs to orchestrate both calls in sequence; the
> exported function signature and resulting `ClaimDetail` shape don't
> change.

## Audit

| Method & Path | Auth | Notes |
|---|---|---|
| `GET /audit/claims/:claimId` | scoped (same as claim detail) | Full audit trail for one claim, oldest first. |
| `GET /audit` | `FINANCE` | Global, paginated. Query: `claimId?`, `action?`, `page?`, `pageSize?`. *(Not in the original plan's endpoint list — added because the frontend's Finance "Audit Logs" page calls `listAllAudit`.)* |

## Finance

| Method & Path | Auth | Query |
|---|---|---|
| `GET /finance/export` | `FINANCE` | `dateFrom?`, `dateTo?`, `status?` (repeatable) | Streams `text/csv`, DB-filtered and pulled in bounded batches (never the whole `Claim` table in memory at once). |

## Dashboards

| Method & Path | Auth | Returns |
|---|---|---|
| `GET /dashboards/claimant` | `CLAIMANT` | `{ counts, recentClaims }` |
| `GET /dashboards/approver` | `APPROVER` | `{ pendingCount, infoRequestedCount, approvedToday, rejectedCount, totalPendingAmount, pendingClaims }` |
| `GET /dashboards/finance` | `FINANCE` | `{ counts, totalApprovedAmount, totalClaims }` |

## Reimbursement — dropped

`plan-backend.md` originally specced `GET /reimbursements` and
`POST /claims/:id/reimburse`. These were **not implemented**: the frontend
this backend serves dropped the whole reimbursement workflow (no
`REIMBURSEMENT_PENDING`/`REIMBURSED` statuses, `APPROVED` is terminal). See
`ARCHITECTURE.md`'s deviations section.
