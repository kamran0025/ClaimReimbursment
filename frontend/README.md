# Expense Claims & Reimbursement Management System — Frontend (POC)

A React SPA for an expense claims and reimbursement workflow. Originally
built against an in-memory mock API layer (ahead of the backend); now
wired to the real backend in [`../backend`](../backend) over HTTP — see
[The "one boundary"](#the-one-boundary) below for how that swap worked and
what's still worth knowing about it.

## Stack

- Vite + React + TypeScript
- Tailwind CSS (v4, via `@tailwindcss/vite`)
- React Router v6
- TanStack Query v5
- React Hook Form + Zod
- Hand-rolled UI primitives in `src/components/ui/` (no component library)

## Running it

Needs the backend running first (see `../backend/README.md` or the root
`README.md`'s quick start) — this SPA has no data of its own.

```bash
cp .env.example .env   # VITE_API_BASE_URL, defaults to http://localhost:4000
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

```bash
npm run build      # tsc -b && vite build — type-checks and produces dist/
npm run preview    # serve the production build locally
```

## Logging in

The login screen lets you type credentials or pick from 7 seeded demo
users (hardcoded here — see below for why — mirroring
`backend/prisma/seed.ts`). Every seeded account uses the password:

```
password123
```

| Email | Role | Name |
|---|---|---|
| finance@example.com | FINANCE | Neha Kulkarni |
| approver1@example.com | APPROVER | Arjun Mehta |
| approver2@example.com | APPROVER | Kavita Rao |
| approver3@example.com | APPROVER | Sanjay Iyer |
| employee1@example.com | CLAIMANT | Rahul Sharma |
| employee2@example.com | CLAIMANT | Ananya Gupta |
| employee3@example.com | CLAIMANT | Vikram Singh |

The backend is seeded with sample claims covering every `ClaimStatus`
(draft, pending approval, info requested, rejected, approved, cancelled —
there's no reimbursement status; see `../backend/ARCHITECTURE.md`'s
deviations section) spread across the three claimants, so every screen has
real data to show on first load — run `npm run prisma:seed` in `../backend`
if it looks empty.

## The "one boundary"

Everything under `src/services/api/` is the single place that talks to the
backend. Each resource has its own service module (`authService.ts`,
`usersService.ts`, `claimsService.ts`, `auditService.ts`,
`financeService.ts`, `dashboardService.ts`), all re-exported from
`src/services/api/index.ts`, plus `httpClient.ts` (the actual `fetch`
wrapper — builds query strings, parses the `{success,data}` /
`{success,error}` envelope, throws a typed `ApiError` on failure) and
`errors.ts` (that error type). No other file in `features/`, `pages/`, or
`hooks/` talks to the network directly.

This was originally an in-memory mock (enforcing the same
role/ownership/state-machine rules a real backend would, so swapping it
out wouldn't change any calling code) and has since been swapped for the
real thing — every exported function in the service modules above kept its
name, parameters, and return shape; only their internals changed from
in-memory array operations to `fetch` calls. Worth knowing about that swap:

- **The auth cookie does the session work now.** `AuthContext` no longer
  persists anything to `localStorage` — it just calls `GET /auth/me` on
  load and trusts the httpOnly cookie the backend set at login.
- **`respondToInfoRequest`'s file upload is two backend calls under one
  function.** The backend keeps "upload a receipt" and "post a response
  referencing it" as separate REST endpoints; this function still uploads
  then responds in one client-side call, so nothing calling it changed.
- **Receipt URLs get made absolute.** The backend returns a
  backend-relative download path; `claimsService.ts` prefixes it with
  `VITE_API_BASE_URL` before it reaches `<img>`/`<a>` tags.
- **`stateMachine.ts` shrank to two pure predicates**
  (`isEditableStatus`, `isInReview`) — everything that used to *enforce* a
  transition (throwing on an illegal one) was mock-only; the backend is the
  actual state machine now. What's left is only used for UI gating
  (disabling a button, choosing which panel to show) — never relied on for
  security, exactly like `ProtectedRoute` below.
- **The "pick a seeded user" login list is still hardcoded**, not fetched —
  the real backend has no unauthenticated "list every user" endpoint (that
  would be a real info-disclosure hole, not just a POC shortcut).

## Folder structure

```
src/
├── app/            router, providers (QueryClient/Auth/Toast)
├── components/
│   ├── ui/         generic primitives (Button, Input, Modal, Table, ...)
│   └── common/      domain-flavored shared bits (StatusBadge, ProtectedRoute, ...)
├── features/        one folder per domain area, each with hooks/ and components/
│   ├── auth/ claims/ finance/ audit/
├── pages/          route-level screens, grouped by role
│   ├── auth/ claimant/ approver/ finance/
├── layouts/         role-aware app shell + auth shell
├── services/api/    the backend client (see above)
├── types/           enums + models mirrored from the backend schema
└── utils/           formatting, CSV export, pagination, etc.
```

## Notable product decisions / deviations

- **Route guards are UX only.** `ProtectedRoute` redirects based on the
  logged-in role so you don't see the wrong screen, but it is not a
  security boundary — the backend re-checks role/ownership/assignment on
  every request regardless of what the UI would have allowed.
- **CSV export streams from the backend** (`GET /finance/export`,
  DB-filtered, pulled in bounded batches server-side) — the frontend just
  reads the response body as text and triggers a browser download.
- **No reimbursement UI.** Dropped from scope on the backend too — see
  `../backend/ARCHITECTURE.md`'s deviations section. `APPROVED` is a
  claim's terminal status.
