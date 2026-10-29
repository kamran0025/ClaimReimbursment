-- Categories drop description/isActive (Finance now deletes unused
-- categories instead of deactivating them) and gain a spending limit.
-- Existing categories get no limit (NULL) until Finance sets one.

-- DropIndex
DROP INDEX "ExpenseCategory_isActive_idx";

-- AlterTable
ALTER TABLE "ExpenseCategory" DROP COLUMN "description",
DROP COLUMN "isActive",
ADD COLUMN     "maxAmount" DECIMAL(10,2);
