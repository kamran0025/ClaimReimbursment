import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { serializeUser } from './serializers';

/** GET /users/approvers — powers the claimant's assignment dropdown. Any authenticated user may call this. */
export async function listActiveApprovers() {
  const approvers = await prisma.user.findMany({
    where: { role: Role.APPROVER, isActive: true },
    orderBy: { name: 'asc' },
  });
  return approvers.map(serializeUser);
}

/** Finance-only employee directory (claimants + approvers). */
export async function listEmployees() {
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.CLAIMANT, Role.APPROVER] } },
    orderBy: { name: 'asc' },
  });
  return users.map(serializeUser);
}
