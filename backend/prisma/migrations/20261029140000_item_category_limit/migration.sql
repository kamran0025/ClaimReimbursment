-- Each line item records the category limit it was checked against, so an
-- over-limit flag on a claim in review doesn't change if Finance later edits
-- the category's maxAmount.

-- AlterTable
ALTER TABLE "ClaimItem" ADD COLUMN "categoryLimit" DECIMAL(10,2);

-- Backfill: existing items take their category's current limit (hand-written).
UPDATE "ClaimItem" ci
SET "categoryLimit" = ec."maxAmount"
FROM "ExpenseCategory" ec
WHERE ec."id" = ci."categoryId";
