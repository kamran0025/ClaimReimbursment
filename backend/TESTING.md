# Testing

Vitest + Supertest. Two tiers:

- **Unit** (`tests/unit/`) — no database. Pure logic: the state-machine
  guards (`claimStateMachine.test.ts`) and the claim-total summation core
  (`claimTotalService.test.ts`, isolated as `sumAmounts()` specifically so
  it's testable without a transaction/DB — see `ARCHITECTURE.md`).
- **Integration** (`tests/integration/`) — a real Postgres database via
  Supertest against the actual Express app (`createApp()`), no mocking of
  Prisma or HTTP. Deliberately **not** run against SQLite — Postgres-specific
  constraint/enum/transaction-isolation behavior is exactly what these tests
  exist to catch, and a substitute engine would hide differences (per
  `plan-backend.md` §9).

## Running

```bash
npm test           # everything, once
npm run test:watch # watch mode
```

Integration tests need `DATABASE_URL` (read by the app at import time,
pointed at the test DB — see below) and `TEST_DATABASE_URL` (read directly
by the test harness to run migrations against that same DB). Unit tests
have no such requirement and will pass with no database running at all.

### Getting a test database

```bash
docker compose --profile test up -d db_test   # postgres on localhost:5433
export TEST_DATABASE_URL="postgresql://expense:expense@localhost:5433/expense_claims_test?schema=public"
npm test
```

`vitest.config.ts`'s `test.env` maps `TEST_DATABASE_URL` onto `DATABASE_URL`
for the whole test process (before any test file's imports run — see the
comment there for why a plain `process.env.X = ...` at the top of a test
file doesn't work under Vitest's ESM import hoisting), so the app under
test, the seed helpers, and the assertions all talk to the same database.

Each integration test file's `beforeEach` calls `resetTestDb()` (deletes
every row, children first) then `seedTestUsers()` (five fixture users:
Finance, two Approvers, two Claimants — enough to test cross-tenant
isolation between "Approver A vs. Approver B" and "Claimant A vs. Claimant
B"). **Test files run sequentially, not in parallel**
(`fileParallelism: false` in `vitest.config.ts`) — they share one real
database, so concurrent files would race each other's reset/seed and fail
with spurious unique-constraint errors. This was hit and fixed while
building this suite; don't remove that setting without giving each file its
own database/schema instead.

`tests/helpers/testApp.ts` signs a JWT directly (`signToken`, the same
function `/auth/login` calls) rather than exercising the login endpoint in
every test — `agentAs(userId)` returns a Supertest-like client that
attaches the resulting cookie to every request.

## What's covered

- `tests/integration/lifecycle.test.ts` — draft → submit → approve;
  info-request round trip (submit → request-info → respond-info → approve),
  including the "claimant can't edit items while INFO_REQUESTED" guard
  inline; reject → edit → resubmit (verifies `submissionCycle` bumps and
  audit history survives); Finance deciding a claim assigned to an
  approver, then the approver failing to act afterward.
- `tests/integration/security.test.ts` — the full mandatory list from
  `task-backend.md` §13: cross-claimant isolation, cross-approver isolation,
  claimant blocked from decision endpoints, Finance's blanket authority,
  submit without an approver rejected, PATCH blocked on an approved claim,
  client-supplied `total` ignored (checked against the DB row directly, not
  just the response body), empty-claim submit rejected, zero/negative
  amount rejected, cross-user receipt access blocked, item edits blocked
  during `INFO_REQUESTED`, `respond-info` restricted to the owning claimant.
- `tests/integration/rbac.test.ts` — matrix smoke tests: unauthenticated
  access, per-role `GET /claims` scoping (including "Finance never sees
  DRAFT"), per-role dashboard/audit/export/employee-directory access.

## What isn't covered (POC scope)

No tests exercise the `Storage` abstraction's error paths (disk full,
permission denied), CSV export content beyond "Finance can call it and get
200", or concurrent-request races beyond the one deliberately-tested
"Finance decides first" case. These were judged lower-value than the
security/lifecycle coverage above for a POC; add them if this moves toward
production.

## Verification note

This suite was actually run — not just typechecked — against a real local
Postgres 18 instance during development (all 40 tests passing), and the
running server was smoke-tested end-to-end over HTTP with `curl` and, for
the frontend integration, a real browser (see `task-frontend.md`'s
"Backend Integration" section). No Docker/Postgres was available in the
environment this backend was originally written in, so that verification
used a temporary embedded Postgres binary (the `embedded-postgres` npm
package) instead of `docker compose` — functionally the same thing from
the app/test suite's point of view (real Postgres over a real TCP
connection), but the `docker-compose.yml` / `--profile test db_test` path
itself has not been exercised. Run `npm test` yourself against the
`docker compose` test database before relying on this in CI.
