import { prisma } from '../lib/prisma';
import { ApiError, ErrorCode } from './errors';
import { assertClaimInScope, type ScopeUser } from './claimScope';
import { serializeMessage } from './serializers';

export async function listMessagesForClaim(user: ScopeUser, claimId: string) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new ApiError(ErrorCode.CLAIM_NOT_FOUND, 'Claim not found.');
  assertClaimInScope(user, claim);

  const messages = await prisma.claimMessage.findMany({
    where: { claimId },
    include: { sender: true, attachedReceipt: true },
    orderBy: { createdAt: 'asc' },
  });
  return messages.map(serializeMessage);
}
