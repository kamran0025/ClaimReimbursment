---
name: react-code-review
description: Review frontend (React/TypeScript) and backend (Express/Prisma) changes for bugs, security and authorization gaps, performance problems, maintainability, and project-convention violations. Use when reviewing code changes or pull requests in this repo.
---

# Code Review (frontend + backend)

## Objective

Review code changes in `frontend/` and `backend/` and identify problems before they are merged.

## Scope

- Default to the uncommitted changes (`git diff HEAD`), or the branch/PR/files the user names.
- Read enough surrounding code (callers, hooks, services, schema) to judge each change in context.
- When a change spans both sides, check that the API contract still matches: request/response shapes, error codes, enums and statuses.

## Instructions

1. Inspect the changed files and understand the purpose of the changes.
2. Check for potential bugs and incorrect logic.
3. Apply the frontend and/or backend checklist below, depending on which files changed.
4. Check whether the changes need additional tests (backend) or are risky without them (frontend).
5. Run the checks for each side that changed and report any new failures:
   - `frontend/`: `npm run lint`, `npm run build` (runs `tsc -b`)
   - `backend/`: `npm run lint`, `npm run typecheck`, `npm test`. Integration tests need the test DB (`docker compose --profile test up -d db_test` from the repo root). If it isn't running, run the unit tests only (`npx vitest run tests/unit`) and say so.

## Frontend checklist (`frontend/`)

- **Hooks:** follow the rules of hooks and correct dependency arrays. Watch for stale closures and for effects that should be derived state or event handlers.
- **Re-renders:** flag unnecessary re-renders, unstable props and context values, and expensive work done on every render.
- **State:** server state belongs in TanStack Query and form state in React Hook Form, not duplicated into `useState`.
- **Loading, error and empty states:** use `Skeleton`/`Spinner`, `ErrorState` and `EmptyState`.
- **Network boundary:** only `src/services/api/*` may call `fetch`/`httpClient`. Everything else uses the `*Api` modules from `@/services/api`.
- **Cache invalidation:** every claim mutation must invalidate `['claims']`, `['dashboard']`, `['audit']` and the claim detail key (see `useInvalidateClaims` in `features/claims/hooks/useClaimMutations.ts`).
- **Forms:** use React Hook Form with Zod schemas from `features/<area>/schemas.ts`. Their rules should match `backend/src/validation/`.
- **UI gating is not security:** `ProtectedRoute`, role checks and `isEditableStatus`/`isInReview` only control what users see. Every `ClaimStatus` (including `PENDING_FINANCE_APPROVAL`) must be handled in `StatusBadge`, filters and action panels.
- **Types:** `src/types/` mirrors the backend Prisma enums and models.
- **Errors:** API failures arrive as `ApiError` with an `ErrorCode`. Handle them where they affect the UI and don't swallow them.
- **UI:** reuse `components/ui/` and `components/common/` with Tailwind v4 classes.

## Backend checklist (`backend/`)

- **Authorization (highest priority):** every claim list query must be scoped with `getClaimScopeFilter(user)`, and every single-claim read or mutation must call `assertClaimInScope` or `assertOwner` (`services/claimScope.ts`). Flag any fetch-then-filter-in-JS pattern, any new route that misses these checks, and any route-level role gate (`middleware/authorize.ts`) used in place of a service-level check. Compare against the matrix in `backend/AUTHORIZATION.md`.
- **State machine:** status changes must go through an `assert*` guard in `services/claimStateMachine.ts`, and `status` must never be set from request input. Check the approval hierarchy: claims above `FINANCE_APPROVAL_THRESHOLD` escalate to `PENDING_FINANCE_APPROVAL`, and only Finance can finalize them. Guard changes must be mirrored in `frontend/src/services/api/stateMachine.ts`.
- **Transactions:** a multi-step mutation must run in a single `prisma.$transaction` that reads, guards, changes, calls `recalculateClaimTotal` when items change, and calls `recordAudit`. Guards must be re-checked inside the transaction (the race where whoever decides first wins). `claim.total` is never taken from the client.
- **Layering:** routes stay thin: validate with `validateBody`/`validateQuery` (Zod in `validation/`), call exactly one service function and wrap the result in `ok(...)`. Business rules belong in `services/`.
- **Errors:** throw `ApiError(ErrorCode.X, ...)`. A new code needs an entry in `STATUS_BY_CODE` (`services/errors.ts`) and in the frontend's `ErrorCode`. Flag leaked internals such as stack traces or Prisma errors.
- **Receipts and uploads:** go through the `Storage` interface, never use client-supplied filenames, never serve files statically, and clean up stored files when a later step fails.
- **Prisma:** schema changes need a migration in `prisma/migrations/`, updates to `seed.ts` and the frontend types where relevant, and must stay on Prisma 6.19.3. Watch for N+1 queries and unbounded `findMany` without pagination (`utils/paginate.ts`).
- **Config:** new env vars go through `lib/env.ts` and `.env.example`. Also update `vitest.config.ts` `test.env`, and `docker-compose.yml`/`render.yaml` if they're needed there.
- **Tests:** authorization, state machine or lifecycle changes should come with integration tests in `tests/integration/` (see `backend/TESTING.md`). Pure logic gets unit tests.

## Rules

- Focus on actual problems, not personal preferences.
- Do not suggest changes without explaining why.
- Do not modify files unless explicitly requested.
- Do not report a potential issue as a confirmed bug without sufficient evidence.
- Prioritize correctness and security over minor style improvements.
- The frontend has no test suite. Don't report missing frontend tests as a finding.

## Expected output

For each finding, include:

- Severity: Critical, High, Medium, or Low
- File and line number, when available
- Description of the issue
- Why it matters
- Recommended fix

Order findings by severity. Group them under Frontend / Backend / Cross-cutting when both sides changed. If no significant issues are found, say so clearly.
