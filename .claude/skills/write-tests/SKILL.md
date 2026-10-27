---
name: write-tests
description: Write backend test cases (Vitest + Supertest) for this repo — unit tests for pure logic/middleware/services with mocks, and integration tests against the real Postgres test DB for endpoints, authorization, state transitions and audit. Use when asked to write, add, or improve tests or test coverage.
argument-hint: "<file, function, endpoint or behavior to test>"
---

# Write test cases

Target: $ARGUMENTS

Tests live in `backend/tests/`. The frontend has no test runner — if asked for frontend tests, say so and ask before adding Vitest + React Testing Library to `frontend/`.

## 1. Understand what to test

- Read the target code and its callers. For endpoints, follow route → validation → service → state machinFWe → serializer.
- Read the closest existing test file and reuse its helpers and style. Don't duplicate a case that already exists (`grep -rn "it(" backend/tests`).
- List the behaviors to cover before writing: happy path, each guard/error branch, boundaries (e.g. exactly `FINANCE_APPROVAL_THRESHOLD`), and authorization.

## 2. Pick the tier

| Testing… | Tier | Location |
|---|---|---|
| Pure functions: state-machine guards, `sumAmounts`, `receiptRules`, serializers, paginate | unit, no mocks | `tests/unit/<name>.test.ts` |
| A middleware | unit, tiny express app + Supertest | `tests/unit/middleware/<name>.test.ts` |
| A service failure path you can't trigger over HTTP (DB/storage failure, cleanup) | unit, `vi.mock` | `tests/unit/<name>.test.ts` |
| Endpoints, authorization, state transitions, transactions, audit rows | integration, real Postgres | `tests/integration/<area>.test.ts` |

Prefer integration tests for anything involving Prisma queries or authorization — never mock Prisma to test those, and never use SQLite.

## 3. Integration test pattern

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateTestDb, resetTestDb, seedTestUsers, testPrisma, type SeededUsers } from '../helpers/testDb';
import { agentAs, anonAgent } from '../helpers/testApp';

let users: SeededUsers;

beforeAll(() => {
  migrateTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  users = await seedTestUsers(); // finance, approverA, approverB, claimantA, claimantB
});
```

- `agentAs(userId)` is pre-authenticated (`get/post/patch/delete`); `anonAgent()` for 401 cases.
- Build state through the API, like a real user: `POST /claims` → `POST /claims/:id/items` → `POST /claims/:id/submit`. Submit with `{}` — the server assigns the approver; read it from `res.body.data.assignedApproverId` and act as `agentAs(thatId)`. Extract repeated setup into a local helper (see `submitClaimFor` in `approvalHierarchy.test.ts`).
- Insert directly with `testPrisma` only for states the API can't reach.
- Receipts: `.attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'receipt.pdf', contentType: 'application/pdf' })`.
- Assert on `res.status`, `res.body.data` / `res.body.error.code` (codes from `src/services/errors.ts`), **and** on the DB via `testPrisma` when the point is what got persisted (e.g. `total` recomputed, client-supplied fields ignored, audit rows written in order).
- Add new cases to the existing file for that area (`lifecycle`, `security`, `rbac`, `approvalHierarchy`, `approverAssignment`, `authenticate`) before creating a new file.

### Checklist for an endpoint or mutation

- Happy path: status code, response shape, persisted state.
- 401 unauthenticated; 403 wrong role (`FORBIDDEN_ROLE`); 403 other user's claim (`CLAIM_NOT_OWNED` / `CLAIM_NOT_ASSIGNED`) — use the A/B pairs.
- 400 invalid body (`VALIDATION_ERROR`); server-owned fields in the body are ignored.
- 409 for every illegal source status (loop over `ClaimStatus` values where cheap).
- Finance tier: below / exactly at / above the threshold, and `FINANCE_APPROVAL_REQUIRED` for the approver after escalation.
- Audit: expected `AuditAction` sequence for the claim.

## 4. Unit test patterns

- **Pure logic:** import from `../../src/...` and assert directly. For guards, assert both `toThrow(ApiError)` and the specific `ErrorCode`.
- **Middleware:** build a tiny express app that sets a fake `req.user`, mounts the middleware and `errorHandler`, then hit it with `supertest` (see `tests/unit/middleware/authorize.test.ts`).
- **Mocked services:** declare mocks with `vi.hoisted`, `vi.mock` the module paths (`src/lib/prisma`, `src/services/storage`, `src/lib/logger`, …) **before** importing the unit under test, and `vi.clearAllMocks()` in `beforeEach` (see `tests/unit/receiptUploadCleanup.test.ts`). Mock only what's needed to force the branch under test.

## 5. Rules

- Name tests as behavior sentences: `it('an approver cannot act on a claim assigned to a different approver', …)`.
- One behavior per `it`; tests must not depend on each other's order or data.
- Don't change `vitest.config.ts`'s `fileParallelism: false` — files share one database.
- Test through public behavior; don't export internals just for tests (except pure helpers like `sumAmounts`).
- If a test exposes a real bug, keep the failing test, report the bug, and ask before fixing production code.
- Don't commit files written to `tests/.tmp-uploads/`.

## 6. Run and report

From `backend/`:

```bash
npx vitest run tests/unit/<file>.test.ts            # unit, no DB needed
docker compose --profile test up -d db_test         # from repo root, for integration
npx vitest run tests/integration/<file>.test.ts
npx vitest run -t "<test name>"                     # single test
npm test && npm run typecheck && npm run lint       # before finishing
```

If the test DB can't be started, run only the unit tests and say clearly that the integration tests were written but not run. Report: tests added (file + names), what they cover, pass/fail output, and any bugs found.
