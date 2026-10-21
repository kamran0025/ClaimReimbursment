-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'PENDING_FINANCE_APPROVAL';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CLAIM_ESCALATED';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "approverApprovedAt" TIMESTAMP(3),
ADD COLUMN     "approverApprovedById" TEXT;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_approverApprovedById_fkey" FOREIGN KEY ("approverApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
