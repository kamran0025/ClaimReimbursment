import { Prisma } from '@prisma/client';

/** Pure summation, isolated so it's unit-testable without a database (plan-backend.md §9 — "total-recalculation service"). */
export function sumAmounts(amounts: Prisma.Decimal.Value[]): Prisma.Decimal {
  return amounts.reduce((sum: Prisma.Decimal, amount) => sum.add(amount), new Prisma.Decimal(0));
}

/**
 * The sole code path allowed to write `claim.total` (plan-backend.md §4.1).
 * Every `ClaimItem` mutation calls this, inside the same transaction, right
 * after applying the item change — recomputing `SUM(amount)` from the DB
 * rather than trusting any client-supplied figure.
 */
export async function recalculateClaimTotal(tx: Prisma.TransactionClient, claimId: string): Promise<Prisma.Decimal> {
  const items = await tx.claimItem.findMany({ where: { claimId }, select: { amount: true } });
  const total = sumAmounts(items.map((i) => i.amount));
  await tx.claim.update({ where: { id: claimId }, data: { total } });
  return total;
}
