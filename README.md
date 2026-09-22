# Expense Claims & Reimbursement Management System (POC)

A full-stack proof of concept: React SPA + Express/Prisma/Postgres API,
implementing direct approver assignment, Finance blanket approval
authority, and an info-request workflow. See `plan-backend.md` /
`plan-frontend.md` for the design, `task-backend.md` / `task-frontend.md`
for delivery checklists.

```
frontend/   Vite + React + TypeScript SPA (see frontend/README.md)
backend/    Express + TypeScript + Prisma + PostgreSQL API (this section)
```

## Backend — quick start

Requires Docker (for Postgres) and Node 20+.

```bash
cd backend
cp .env.example .env
npm install

# start Postgres (repo root)
cd .. && docker compose up -d db

cd backend
npm run prisma:migrate   # applies the schema
npm run prisma:seed      # 7 demo users + sample claims in every status
npm run dev               # http://localhost:4000
```

Or run the whole stack (Postgres + built backend) in Docker:

```bash
docker compose up --build
```

### Environment

See `backend/.env.example` for every variable and what it's for
(`DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR`, `MAX_RECEIPT_SIZE_BYTES`,
etc.). Copy it to `backend/.env` and adjust before running outside Docker.

### Migrations & seeding

```bash
npm run prisma:migrate   # dev: create + apply a new migration interactively
npm run prisma:deploy    # CI/prod: apply pending migrations, no prompts
npm run prisma:seed      # idempotent — safe to re-run
```

### Tests

```bash
docker compose --profile test up -d db_test
TEST_DATABASE_URL=postgresql://expense:expense@localhost:5433/expense_claims_test?schema=public npm test
```

See `backend/TESTING.md` for what's covered and how the test DB isolation
works.

## Deploying (Render)

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec):
a web service built from `backend/Dockerfile` plus a managed Postgres
database, wired together automatically. On Render, both run inside the
same private network, so the backend connects to the database via its
**internal** hostname — the external-hostname/SSL/reachability issues you
can hit connecting to a Render Postgres instance *from your own machine*
don't apply service-to-service.

```bash
# In the Render dashboard: New -> Blueprint -> point at this repo.
# Render reads render.yaml, provisions the db, builds the backend, wires
# DATABASE_URL automatically, and generates JWT_SECRET.
```

No manual seeding step needed — the container's startup command runs
migrations then the seed script on every boot (`backend/Dockerfile`'s
`CMD`), and the seed script no-ops itself once the database has any users,
so it only actually seeds on that first boot. This also means the Shell
tab (a paid-plan feature on Render) is never required.

Set `CORS_ORIGIN` in the Render dashboard to wherever the frontend ends up
being served from (it defaults to `http://localhost:5173` in `render.yaml`
— fine for local frontend + deployed backend, not for a deployed frontend).
Note the free Postgres plan and free web service plan both have real
limits (the DB expires after 30 days unless upgraded; the disk for
uploaded receipts isn't available on the free web service plan, so
uploads won't survive a redeploy) — fine for demoing, not for anything
that needs to persist.

### Demo credentials

Same identities as the frontend's mock login screen — password
`password123` for all:

| Email | Role |
|---|---|
| `finance@example.com` | Finance |
| `approver1@example.com` / `approver2@example.com` / `approver3@example.com` | Approver |
| `employee1@example.com` / `employee2@example.com` / `employee3@example.com` | Claimant |

### Backend docs

`backend/ARCHITECTURE.md`, `backend/API.md`, `backend/DATABASE.md`,
`backend/AUTHORIZATION.md`, `backend/TESTING.md`.

## Frontend

See [`frontend/README.md`](frontend/README.md). `frontend/src/services/api`
now calls this real backend over HTTP (`credentials: 'include'`, the
httpOnly auth cookie) instead of the in-memory mock it was originally built
against — set `frontend/.env` (`VITE_API_BASE_URL`, see
`frontend/.env.example`) to point it at wherever the backend is running.
See `backend/API.md`'s integration note on `respond-info` for the one
behavioral seam the swap had to account for (one combined mock call became
two real REST calls, orchestrated client-side).
