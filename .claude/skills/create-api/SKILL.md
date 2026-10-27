---
name: create-api
description: Add a new backend API endpoint (Express + Prisma) end to end following this repo's conventions — Zod validation, thin route, service with authorization/state-machine/transaction rules, error codes, docs, integration tests, and optionally the frontend client + TanStack Query hook. Use when asked to create, add, or expose a new API/endpoint/route.
argument-hint: "<METHOD /path> <what it does and who may call it>"
---

# Create an API endpoint

Request: $ARGUMENTS

## 1. Pin down the contract first

Before writing code, settle (from the request, or ask if genuinely ambiguous):

- Method + path, and which router it belongs to (`backend/src/routes/{auth,users,claims,audit,finance,dashboards}.ts`). Create a new router only for a genuinely new resource.
- Who may call it — check the matrix in `backend/AUTHORIZATION.md`. Role gate? Ownership? Assignment? Which claim statuses?
- Request body / query shape, response shape (`T`, `Paginated<T>`, or raw stream like CSV export), success status (`200`, or `201` for creates).
- Does it change claim state, items, or anything that should be audited?

Read the closest existing endpoint end to end (route → validation → service → serializer → test) and mirror it.

## 2. Validation — `backend/src/validation/*Validation.ts`

- Add a Zod schema + `export type XInput = z.infer<typeof xSchema>`.
- Never accept server-owned fields (`total`, `status`, `claimantId`, `decidedById`, …). Zod strips unknown keys; don't use `.passthrough()`.
- Use `z.coerce.number()` for query numbers; trimmed strings with user-facing messages, matching existing schemas.

## 3. Service — `backend/src/services/`

All business rules live here, never in the route.

- Signature takes the caller as `user: { id: string; role: Role }` plus typed input.
- **Authorization:** claim lists → `where: getClaimScopeFilter(user)`; single claim → load it, then `assertClaimInScope(user, claim)` (read) or `assertOwner(user, claim)` (claimant mutation). Never fetch-then-filter in JS.
- **State changes:** call the matching `assert*` guard from `claimStateMachine.ts` (add a new guard there if needed, and mirror predicate changes in `frontend/src/services/api/stateMachine.ts`). Respect the Finance tier (`requiresFinanceApproval`, `PENDING_FINANCE_APPROVAL`).
- **Mutations:** wrap in one `prisma.$transaction(async (tx) => …)`: read → guard (re-checked inside the tx) → write → `recalculateClaimTotal(tx, claimId)` if items changed → `recordAudit(tx, {...})` (add an `AuditAction` enum value + migration if none fits).
- **Errors:** `throw new ApiError(ErrorCode.X, 'message')`. A new code must be added to `ErrorCode` and `STATUS_BY_CODE` in `services/errors.ts` **and** to `frontend/src/services/api/errors.ts`.
- **Responses:** return serialized shapes via `services/serializers.ts` (`Number()` for Decimals, ISO strings for dates, never `passwordHash`). Reuse `claimQueryService.ts` include shapes for claim reads.
- **Lists:** paginate with `utils/paginate.ts` (`resolvePage`) and return `Paginated<T>`; no unbounded `findMany`.
- Files go through `services/storage` (`storage.save/read/delete`), never direct disk/Cloudinary calls.

## 4. Route — thin

```ts
someRouter.post(
  '/:id/thing',
  authorize(Role.X),                 // only if a coarse role gate applies; ownership stays in the service
  validateBody(thingSchema),         // or validateQuery(...)
  asyncHandler(async (req, res) => {
    const result = await doThing({ id: req.user!.id, role: req.user!.role }, req.params.id, req.body);
    res.json(ok(result));            // res.status(201).json(ok(...)) for creates
  }),
);
```

- Router already applies `authenticate` via `router.use(...)`; a new router must too, and must be mounted in `backend/src/app.ts`.
- Exactly one service call; no Prisma in routes.
- New env vars → `lib/env.ts`, `.env.example`, `vitest.config.ts` `test.env`, and `docker-compose.yml`/`render.yaml` if needed.
- Schema changes → `npm run prisma:migrate -- --name <name>` (Prisma stays on 6.19.3), update `prisma/seed.ts` and `frontend/src/types/` if shapes changed.

## 5. Tests — `backend/tests/integration/`

Add to the most relevant file (`lifecycle`, `security`, `rbac`, `approvalHierarchy`, …) or a new one using the same harness (`migrateTestDb` in `beforeAll`, `resetTestDb` + `seedTestUsers` in `beforeEach`, `agentAs(users.x.id)`). Cover at minimum:

- happy path (status code + response body, and DB state via `prisma` when it matters),
- unauthenticated → 401, wrong role → 403, other user's claim → 403,
- invalid body → 400, illegal state → 409,
- audit row written, if it's a mutation.

Pure logic (new guards, calculations) also gets a unit test in `tests/unit/`.

## 6. Frontend client (if the UI will use it)

- Add a typed function to the right `frontend/src/services/api/*Service.ts` using `apiGet/apiPost/apiPatch/apiDelete` (or `apiGetRaw` for non-envelope responses). Nothing outside `services/api/` calls `fetch`.
- Add a TanStack Query hook in `frontend/src/features/<area>/hooks/`. Mutations touching claims must invalidate via `useInvalidateClaims` (`['claims']`, `['dashboard']`, `['audit']`, detail key).
- Update `frontend/src/types/` for any new model/enum shapes.

## 7. Docs and verification

- Add the endpoint row to `backend/API.md` (method & path, auth, body/query, notes); update `AUTHORIZATION.md` if the permission matrix changed.
- Run in `backend/`: `npm run lint`, `npm run typecheck`, `npm test` (needs `docker compose --profile test up -d db_test` from repo root; if unavailable, run `npx vitest run tests/unit` and report that integration tests were not run).
- If the frontend changed: `npm run lint` and `npm run build` in `frontend/`.
- Summarize: endpoint contract, files changed, tests added, and anything not verified.
