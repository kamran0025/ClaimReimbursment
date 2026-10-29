-- Expense categories become a Finance-managed table; ClaimItem.category (free
-- text) is replaced by a categoryId FK. Hand-edited: Prisma's generated SQL
-- dropped the old column and added a NOT NULL column with no backfill.

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "ExpenseCategory_isActive_idx" ON "ExpenseCategory"("isActive");

-- Default categories: the list the frontend used to hardcode. Ids are md5
-- strings (gen_random_uuid() needs Postgres 13+); any unique text id works.
INSERT INTO "ExpenseCategory" ("id", "name", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), n, CURRENT_TIMESTAMP
FROM unnest(ARRAY['Travel', 'Lodging', 'Meals', 'Training', 'Supplies', 'Software', 'Client Entertainment', 'Other']) AS n;

-- Any other free-text category already used by line items becomes its own
-- category, so no existing item loses its value. Finance can rename or
-- deactivate these afterwards.
INSERT INTO "ExpenseCategory" ("id", "name", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), MIN(btrim(ci."category")), CURRENT_TIMESTAMP
FROM "ClaimItem" ci
WHERE NOT EXISTS (
  SELECT 1 FROM "ExpenseCategory" ec WHERE lower(ec."name") = lower(btrim(ci."category"))
)
GROUP BY lower(btrim(ci."category"));

-- Add nullable, backfill by case-insensitive name match, then enforce NOT NULL.
ALTER TABLE "ClaimItem" ADD COLUMN "categoryId" TEXT;

UPDATE "ClaimItem" ci
SET "categoryId" = ec."id"
FROM "ExpenseCategory" ec
WHERE lower(ec."name") = lower(btrim(ci."category"));

ALTER TABLE "ClaimItem" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "ClaimItem" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "ClaimItem_categoryId_idx" ON "ClaimItem"("categoryId");

-- AddForeignKey
ALTER TABLE "ClaimItem" ADD CONSTRAINT "ClaimItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
