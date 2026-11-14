-- CAD-01: patient registration fields requested by the veterinarian.
-- Existing species and sex values remain untouched for backwards compatibility.
ALTER TABLE "patients"
ADD COLUMN "reproductive_condition" TEXT,
ADD COLUMN "coat_description" TEXT;
