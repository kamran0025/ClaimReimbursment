# Frontend Implementation Plan — Expense Claims & Reimbursement Management System

Source spec: `Claude Code Prompt — Expense Claims & Reimbursement Application.md`
Companion: `plan-backend.md` (API/DB plan this UI is built against) · `task-frontend.md` (checklist for this plan)

> **Revision v2.** Amount-based multi-approver routing is replaced with direct approver assignment: the claimant picks one approver when submitting; only that approver (plus Finance, who can now also decide) can act on the claim. Adds an info-request/response workflow and real image/PDF receipt uploads. See `plan-backend.md`'s revision note for the full rationale — this file describes the UI implications only.

## 1. Status

v1 was built UI-first against an in-memory mock API layer mirroring the original spec's routed-approval contract; that mock is now being upgraded to v2 (direct assignment, Finance approval authority, info-requests, file uploads) ahead of the real backend, which will be built to the same v2 contract in `plan-backend.md`.

## 2. Tech Stack

- React + TypeScript + Vite
- React Router v6
- Tailwind CSS
- React Hook Form + Zod (form state + validation)
- TanStack Query (server-state caching, used for both the mock layer today and the real API later)
- Small hand-built UI primitives (`components/ui/`) — no external component library

## 3. Folder Structure

```
src/
├── app/           router, providers (QueryClientProvider, AuthProvider, ToastProvider)
├── components/{ui,forms,common}
├── features/{auth,claims,reimbursements,finance,audit}   (no separate "approvals" feature — actions live on claims)
├── pages/{auth,claimant,approver,finance}
├── hooks/
├── services/      API layer — currently mock, swappable for real HTTP later
├── types/         mirrors the Prisma models/enums from plan-backend.md §4
├── utils/
└── layouts/       role-specific shells with nav
```

## 4. Domain Types (v2)

Mirror `plan-backend.md` §4 exactly as TS types/enums: `Role`, `ClaimStatus{DRAFT,PENDING_APPROVAL,INFO_REQUESTED,REJECTED,APPROVED,REIMBURSEMENT_PENDING,REIMBURSED,CANCELLED}`, `ReimbursementMethod`, `ClaimMessageType{INFO_REQUEST,RESPONSE}`, and the `User`, `Claim` (now with `assignedApproverId`, `decidedById`, `decidedAt`, `submissionCycle`), `ClaimItem`, `Receipt`, `ClaimMessage`, `Reimbursement`, `AuditLog` shapes. `ApprovalRule`/`Approval` types from v1 are removed. Keeping these identical to the backend schema is what makes the later swap safe.

## 5. Mock API Layer (`src/services/`)

- In-memory store seeded per spec §24: `finance@example.com`, `approver1/2/3@example.com`, `employee1/2/3@example.com`, sample claims covering every `ClaimStatus` including `INFO_REQUESTED`.
- No `ApprovalRule` tiers — instead a `GET /users/approvers`-equivalent mock returns the active approver list for the assignment dropdown shown at submit time.
- Mock auth stores current user in memory + localStorage for refresh persistence; function signatures match what the real `/auth/login` etc. calls will look like.
- Every operation enforces the **same** authorization/business rules the real backend will (claimant sees only own claims, approver sees only claims where `assignedApproverId === self`, Finance sees/decides everything, state-machine guards including `INFO_REQUESTED`, server-side total recalculation from line items, mandatory rejection reason, mandatory info-request message, immutable items outside `DRAFT`, no reimbursement before full approval, no submit with zero items or non-positive amounts, no submit without picking an approver) and throws typed `{code, message}` errors matching `plan-backend.md` §7/spec §25 — the UI renders these real error shapes, it does not re-implement the checks only in React.
- Claim total is always derived by summing `ClaimItem` amounts inside the mock service, never trusted from a passed-in value.
- Receipt uploads are handled as real browser `File` objects: validated client-side (type: jpeg/png/webp/pdf, size cap ~5MB) *and* re-validated inside the mock service (mirrors backend behavior), then kept as an in-memory object URL for preview (thumbnail for images, file icon for PDF). Object URLs don't survive a full reload — documented as a known POC limitation until real disk/S3 storage exists on the backend.
- Artificial latency (~300–500ms) on mutations/queries so loading states are real and visible.
- State persists for the session (module-level singleton); resets on full page reload — acceptable for a POC with no backend yet.

## 6. Screens (v2)

**Auth:** Login (seeded users).

**Claimant:**
- Dashboard (status counts + recent claims)
- My Claims (list + filters)
- Create Claim: repeating line-item form (category, description, amount, date, merchant) with a receipt upload (image/PDF) per item; running total; **Submit requires picking an approver** from the active-approver dropdown; Save Draft skips that requirement.
- Claim Details: items + receipts (with thumbnail/PDF preview), assigned approver, decision (if any), the message thread (info-requests + responses), audit history.
- Respond to Info Request: shown inline on Claim Details when status is `INFO_REQUESTED` — a reply textbox plus an optional additional-receipt upload; submitting returns the claim to `PENDING_APPROVAL`.
- Edit Claim (DRAFT/REJECTED only; may reassign approver on resubmit), read-only banner otherwise.
- Reimbursement Status view.

**Approver:**
- Dashboard (pending count assigned to me, approved today, rejected, total pending amount)
- My Queue: claims where `assignedApproverId === self` and status `PENDING_APPROVAL` (no cross-approver visibility) — simple filtered list, not a multi-step "queue"
- Claim Review: full claim + receipts + message thread; three actions — **Approve**, **Reject** (reason required), **Request Info** (message required) — no separate "approve" micro-workflow beyond this single decision point
- Approval History (claims I've decided)

**Finance:**
- Dashboard (global counts + total approved/reimbursed amounts)
- All Claims: global list including every claimant's and every approver's claims, filters (date range/status/claimant/approver/amount)
- Claim Review: **same Approve / Reject / Request Info actions as an approver**, usable on any `PENDING_APPROVAL` claim regardless of assignment
- Claim Details (for non-pending claims — read-only)
- Reimbursements (mark reimbursed with method/reference/date)
- Employees, Audit Logs, Export (CSV, generated client-side from filtered mock data today, same contract as `/finance/export` later)

## 7. Cross-Cutting UX

- Loading, empty, and error states — error states render the backend-style `{success:false, error:{code,message}}` shape, not just happy paths.
- Confirmation dialogs for submit/approve/reject/request-info/delete-item/mark-reimbursed.
- Toast notifications for success/error.
- Zod validation matching backend constraints (amount > 0, valid date, category/description required, ≥1 item to submit, approver required to submit, non-empty rejection reason, non-empty info-request message, receipt file type/size limits).
- Client-side pagination on list views.
- Responsive, professional finance/admin visual style; distinct status badges per `ClaimStatus` (including `INFO_REQUESTED`).

## 8. UX-Only Guards (not a security boundary)

Role-specific layouts/nav and a protected-route wrapper redirect based on the mock-auth user + role, purely for navigation UX. As `plan-backend.md` §6 states, the **real** authorization boundary is server-side; nothing in the frontend should ever be treated as enforcing access control once the real backend exists.

## 9. Delivery Order (v2 upgrade, applied to the existing v1 codebase)

1. Update domain types + mock API layer to v2 schema/rules (drop `ApprovalRule`/`Approval`, add `assignedApproverId`, decision fields, `ClaimMessage`, `INFO_REQUESTED` status)
2. Approver-selection UI on Create/Edit/Resubmit claim forms
3. Receipt upload UI (image/PDF, per item, with preview) replacing the old metadata-only mock
4. Simplify approver UI from "queue"/multi-step to direct claim list + single-decision Claim Review
5. Extend Claim Review with Request Info action; add claimant-side respond-to-info-request UI and message thread display
6. Grant Finance the same decision actions as an approver, on any pending claim
7. Update seed data to include `assignedApproverId` per claim and at least one `INFO_REQUESTED` example
8. Re-verify: type-check clean, dev server boots, manual smoke test of the full v2 lifecycle across all three roles

Detailed step checklist tracked in `task-frontend.md`.
