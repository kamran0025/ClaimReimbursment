// Integration-test harness. Requires a real, reachable Postgres at
// `TEST_DATABASE_URL` (see .env.example / `docker compose --profile test up
// -d db_test`) — plan-backend.md §9 deliberately rules out an SQLite
// substitute here, since it would hide constraint/enum behavior differences.
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// vitest.config.ts's `test.env` points `DATABASE_URL` at the test DB for the whole test process.
const TEST_DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://expense:expense@localhost:5433/expense_claims_test?schema=public';

export const testPrisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

let migrated = false;

/** Runs pending migrations against the test DB exactly once per test process. */
export function migrateTestDb(): void {
  if (migrated) return;
  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
  migrated = true;
}

/** Deletes all rows (children first) so each test file starts from a clean slate. */
export async function resetTestDb(): Promise<void> {
  await testPrisma.auditLog.deleteMany();
  await testPrisma.claimMessage.deleteMany();
  await testPrisma.receipt.deleteMany();
  await testPrisma.claimItem.deleteMany();
  await testPrisma.claim.deleteMany();
  await testPrisma.user.deleteMany();
}

export interface SeededUsers {
  finance: { id: string };
  approverA: { id: string };
  approverB: { id: string };
  claimantA: { id: string };
  claimantB: { id: string };
}

/** Minimal fixture set covering every role + "a second user of the same role" (for cross-tenant isolation tests). */
export async function seedTestUsers(): Promise<SeededUsers> {
  const passwordHash = await bcrypt.hash('password123', 4);
  const [finance, approverA, approverB, claimantA, claimantB] = await Promise.all([
    testPrisma.user.create({ data: { name: 'Finance', email: 'test-finance@example.com', role: 'FINANCE', passwordHash } }),
    testPrisma.user.create({ data: { name: 'Approver A', email: 'test-approverA@example.com', role: 'APPROVER', passwordHash } }),
    testPrisma.user.create({ data: { name: 'Approver B', email: 'test-approverB@example.com', role: 'APPROVER', passwordHash } }),
    testPrisma.user.create({ data: { name: 'Claimant A', email: 'test-claimantA@example.com', role: 'CLAIMANT', passwordHash } }),
    testPrisma.user.create({ data: { name: 'Claimant B', email: 'test-claimantB@example.com', role: 'CLAIMANT', passwordHash } }),
  ]);
  return { finance, approverA, approverB, claimantA, claimantB };
}
