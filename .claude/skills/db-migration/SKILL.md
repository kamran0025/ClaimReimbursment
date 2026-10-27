---
name: db-migration
description: Change the Prisma/PostgreSQL schema safely in this repo — edit schema.prisma, generate and review the SQL migration, backfill existing data, and update everything that depends on the schema (serializers, seed, frontend types, state machine, tests, docs). Use when asked to add/rename/remove a model, field, enum value, index or relation, or to create/fix a migration.
argument-hint: "<schema change to make>"
---

# Database migration

Change: $ARGUMENTS

Stack: Prisma **6.19.3** (pinned — don't upgrade to 7 or add `prisma.config.ts`), PostgreSQL 16, schema at `backend/prisma/schema.prisma`, migrations in `backend/prisma/migrations/<timestamp>_<name>/migration.sql`. Run all commands from `backend/`.

## How migrations reach each environment

- **Dev:** `npm run prisma:migrate` (`prisma migrate dev`) against `DATABASE_URL` (docker `db`, port 5432).
- **Tests:** `migrateTestDb()` runs `prisma migrate deploy` against the test DB automatically — no manual step.
- **Render / docker compose:** the Dockerfile `CMD` runs `prisma migrate deploy` then the seed **on every boot**. A failing migration means the backend doesn't start. The seed skips itself once any user exists, so **deployed databases never get new seed data — existing rows must be fixed in the migration SQL itself.**

## 1. Plan the change

- Read the affected models in `schema.prisma` and `backend/DATABASE.md`.
- Find every usage: `grep -rn "<Model|field|EnumValue>" backend/src backend/prisma/seed.ts backend/tests frontend/src`.
- Decide how existing rows get valid values: default, nullable, or explicit backfill.
- **Never edit or delete a migration that's already committed** — it may already be applied on Render. Fix forward with a new migration.

## 2. Edit `schema.prisma`

Follow existing conventions:

- `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`.
- Money: `Decimal @db.Decimal(10, 2)` (serialize with `Number()`).
- Optional relations to `User` get a **named** relation (`@relation("ClaimXxxBy", ...)`) plus the back-relation on `User`.
- Add `@@index` for fields used in scoped `where` clauses or filters.
- Add a short comment on non-obvious fields (see `approverApprovedById`).

## 3. Generate and review the SQL

```bash
docker compose up -d db                                           # from repo root
npx prisma migrate dev --create-only --name <snake_case_description>
```

Open the generated `migration.sql` and check before applying:

- **Adding a required column** to a table with rows → make it nullable, give it a `@default`, or edit the SQL: add nullable → `UPDATE` backfill → `SET NOT NULL`.
- **Renames:** Prisma generates DROP + ADD (data loss). Rewrite as `ALTER TABLE ... RENAME COLUMN` / `ALTER TYPE ... RENAME VALUE`.
- **New enum value** (`ALTER TYPE ... ADD VALUE`): Postgres can't use the new value in the same transaction, so do a backfill that uses it in a **separate, later migration**.
- **Removing an enum value / column / table:** first make sure no rows, code, seed data or audit `metadata` still use it, and migrate those rows in SQL.
- Keep each migration focused on one change. Comment any hand-written SQL.

Then apply it and regenerate the client:

```bash
npm run prisma:migrate        # applies pending migration + prisma generate
```

If the dev DB has drift or only seed data, `npx prisma migrate reset` is fine **locally only** (it wipes the DB and re-runs the seed). Never against a deployed DB.

## 4. Update everything that depends on the schema

- `src/services/serializers.ts`: expose or hide the field. Never expose secrets. Dates → ISO strings.
- `src/services/claimQueryService.ts` include shapes, if a new relation should be returned.
- `src/validation/`: accept the field only if clients may set it. Server-owned fields never go in input schemas.
- **New `ClaimStatus`:** guards in `claimStateMachine.ts` + `frontend/src/services/api/stateMachine.ts`, `claimScope.ts`, `dashboardService.ts`, `exportService.ts`, and the frontend's `StatusBadge`, filters and action panels.
- **New `AuditAction`:** add a `recordAudit` call where it happens and any frontend label for it.
- `prisma/seed.ts`: add the field or status to the demo data so every screen has an example. Keep the "skip if any user exists" guard at the top.
- `tests/helpers/testDb.ts` `resetTestDb()`: add new tables, children before parents (FK order).
- `frontend/src/types/{enums,models}.ts`: mirror new enums or fields.
- `backend/DATABASE.md` (and `API.md` if response shapes changed).

## 5. Verify

```bash
npx prisma validate && npx prisma format
npm run typecheck && npm run lint
docker compose --profile test up -d db_test   # from repo root
npm test                                      # migrateTestDb applies the new migration
```

Also check that deploy works on a database that already has data: with the dev DB still holding seed data, `npx prisma migrate deploy` should report nothing pending and `npm run dev` should serve existing claims correctly. If you changed the frontend types, run `npm run build` in `frontend/`.

## 6. Report

Summarize: the schema change, the migration folder name, any hand-edited SQL and why, how existing rows were handled, the files updated, and the verification output. Call out risks for the deployed database (data loss, locking a large table, enum changes).
