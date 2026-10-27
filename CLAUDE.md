# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Expense Claims & Reimbursement Management POC. Two independent npm projects (no root `package.json`, no workspaces):

- `backend/` — Express + TypeScript + Prisma 6 (pinned to `6.19.3`, don't upgrade to 7) + PostgreSQL
- `frontend/` — Vite + React 19 + TypeScript SPA (Tailwind v4, TanStack Query, React Hook Form + Zod, React Router)

Design history lives in `plan-*.md` (original plan) and `task-*.md` (delivery checklists + decision log). The backend has detailed docs: `backend/ARCHITECTURE.md`, `API.md`, `DATABASE.md`, `AUTHORIZATION.md`, `TESTING.md`. Where the plan and the code disagree, the code and `ARCHITECTURE.md`'s "Deviations" section win (e.g. reimbursement was dropped entirely — `APPROVED` is terminal).

## Commands

Run each from its own directory.

**Backend** (`cd backend`, needs `.env` copied from `.env.example`):
```bash
docker compose up -d db          # from repo root: dev Postgres on :5432
npm run dev                      # tsx watch, http://localhost:4000
npm run build / npm run typecheck / npm run lint   # lint = oxlint
npm run prisma:migrate           # create + apply migration (dev)
npm run prisma:deploy            # apply pending migrations (CI/prod)
npm run prisma:seed              # idempotent; 7 demo users (password123) + sample claims
```

**Backend tests** (Vitest + Supertest):
```bash
docker compose --profile test up -d db_test     # from repo root: test Postgres on :5433
npm test                                         # vitest run
npx vitest run tests/unit/claimStateMachine.test.ts   # single file
npx vitest run -t "Finance can decide"                # single test by name
```
`vitest.config.ts` maps `TEST_DATABASE_URL` (default `localhost:5433/expense_claims_test`) onto `DATABASE_URL` via `test.env` so it's set before imports. Unit tests need no DB. Integration tests run against real Postgres (never SQLite) with `fileParallelism: false` — they share one DB and `resetTestDb()`/`seedTestUsers()` in `beforeEach`; don't remove that setting. `tests/helpers/testApp.ts`'s `agentAs(userId)` signs a JWT directly instead of logging in.

**Frontend** (`cd frontend`, `.env` sets `VITE_API_BASE_URL`, default `http://localhost:4000`):
```bash
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # oxlint
```
The frontend has no test suite.

## Backend architecture

Layers: `routes/` (thin: validate via `validateBody`/`validateQuery` Zod middleware, pull `{id, role}` from `req.user`, call exactly one service function, wrap in `ok(...)`) → `services/` (all business rules, transactions, authorization) → Prisma. There is no repository layer; `claimQueryService.ts` centralizes read-side `include` shapes. Responses use a `{success, data}` / `{success, error}` envelope (`types/api.ts`).

Key invariants — preserve these when changing claim logic:

- **Authorization boundary is `services/claimScope.ts`.** `getClaimScopeFilter(user)` scopes every claim list query at the Prisma level (CLAIMANT → own, APPROVER → `assignedApproverId`, FINANCE → any non-DRAFT); `assertClaimInScope` / `assertOwner` gate single-claim reads/mutations. Never fetch-then-filter in JS. `middleware/authorize.ts` is only a coarse role gate on a few routes; see `AUTHORIZATION.md` for the full matrix.
- **State machine is `services/claimStateMachine.ts`.** Statuses: `DRAFT, PENDING_APPROVAL, PENDING_FINANCE_APPROVAL, INFO_REQUESTED, REJECTED, APPROVED, CANCELLED`. Every mutation in `claimMutationService.ts` calls the relevant `assert*` guard; never set `status` from request input. The frontend's `services/api/stateMachine.ts` mirrors `isEditableStatus`/`isInReview` for UI gating only — keep them in sync.
- **Approval hierarchy.** Approve/reject/request-info is allowed for the assigned approver *or* Finance (blanket authority, "whoever decides first wins" — guards re-checked inside the transaction). If an approver approves a claim whose total exceeds `FINANCE_APPROVAL_THRESHOLD` (env, INR), it escalates to `PENDING_FINANCE_APPROVAL` and only Finance can finalize (`FINANCE_APPROVAL_REQUIRED` otherwise).
- **Every multi-step mutation runs in one `prisma.$transaction`**: read → guard → change → `recalculateClaimTotal` (sole writer of `claim.total`; client-supplied totals are ignored) → `recordAudit` (one `AuditLog` row).
- **Errors**: throw `ApiError(ErrorCode.X, msg)` from `services/errors.ts`; `STATUS_BY_CODE` there is the authoritative code → HTTP status map, applied by `middleware/errorHandler.ts`.
- **Receipt storage** goes through the `Storage` interface (`services/storage/`). `storage/index.ts` picks `CloudinaryStorage` (private assets) when all `CLOUDINARY_*` env vars are set, else `LocalDiskStorage` under `UPLOAD_DIR` with random filenames. Receipts are never served statically — only via the authenticated download endpoint.
- Auth is a JWT in an httpOnly cookie (`lib/cookies.ts`); `COOKIE_SECURE=true` makes it `SameSite=None; Secure` for cross-origin deployments. `CORS_ORIGIN` is a comma-separated exact-match list. All env parsing is in `lib/env.ts`.

## Frontend architecture

- **`src/services/api/` is the only network boundary** — per-resource service modules re-exported from `index.ts`, built on `httpClient.ts` (fetch with `credentials: 'include'`, envelope parsing, throws typed `ApiError`). Nothing in `features/`, `pages/`, or hooks calls `fetch` directly. It was originally an in-memory mock; function signatures were kept stable across the swap.
- Some service functions orchestrate multiple backend calls (e.g. `respondToInfoRequest` uploads a receipt then posts the response); receipt URLs are made absolute with `VITE_API_BASE_URL`.
- `AuthContext` restores the session via `GET /auth/me` (no localStorage). `ProtectedRoute` and disabled buttons are UX only — the backend enforces everything.
- `features/<area>/{hooks,components}` hold TanStack Query hooks and domain components; `pages/` are route screens grouped by role (claimant/approver/finance); `types/` mirrors backend enums/models — update both sides when the Prisma schema changes.
- The login screen's seeded-user picker is hardcoded to match `backend/prisma/seed.ts`.

## Deployment

`render.yaml` deploys the backend (from `backend/Dockerfile`) plus managed Postgres. The container runs migrations then the seed on every boot (seed no-ops once users exist). `docker compose up --build` runs Postgres + the built backend locally. The frontend is deployed separately (Netlify, `public/_redirects` for SPA routing).
