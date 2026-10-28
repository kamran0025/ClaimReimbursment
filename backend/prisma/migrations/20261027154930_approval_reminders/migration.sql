-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'APPROVAL_REMINDER_SENT';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "lastRemindedAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Claim_status_assignedAt_idx" ON "Claim"("status", "assignedAt");

-- Backfill (hand-written): every claim already past DRAFT gets the time it
-- last landed in its current reviewer's queue — the latest audit row that
-- (re)starts that clock — falling back to submittedAt. Doesn't use the new
-- enum value, so it is safe in the same migration as the ADD VALUE above.
UPDATE "Claim" c
SET "assignedAt" = COALESCE(
  (
    SELECT MAX(a."createdAt")
    FROM "AuditLog" a
    WHERE a."claimId" = c."id"
      AND a."action" IN ('CLAIM_SUBMITTED', 'CLAIM_RESUBMITTED', 'CLAIM_REASSIGNED', 'CLAIM_ESCALATED', 'CLAIM_INFO_RESPONDED')
  ),
  c."submittedAt"
)
WHERE c."submittedAt" IS NOT NULL;
