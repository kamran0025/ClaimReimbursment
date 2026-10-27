-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CLAIM_REASSIGNED';

-- AlterEnum
ALTER TYPE "ClaimMessageType" ADD VALUE 'APPROVER_CHANGED';

-- DropForeignKey
ALTER TABLE "ClaimMessage" DROP CONSTRAINT "ClaimMessage_senderId_fkey";

-- AlterTable
ALTER TABLE "ClaimMessage" ALTER COLUMN "senderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ClaimMessage" ADD CONSTRAINT "ClaimMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
