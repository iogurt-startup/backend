-- AlterTable
ALTER TABLE "clinics" ADD COLUMN "code" TEXT;

-- Backfill existing clinics without code with unique fallback
UPDATE "clinics"
SET "code" = CONCAT('CLINIC-', UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8)))
WHERE "code" IS NULL;

-- AlterTable
ALTER TABLE "clinics" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clinics_code_key" ON "clinics"("code");
