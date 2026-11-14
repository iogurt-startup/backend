-- CreateEnum
CREATE TYPE "HospitalizationStatus" AS ENUM ('ADMITTED', 'CRITICAL', 'DISCHARGED');

-- CreateTable
CREATE TABLE "hospitalizations" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "admitted_by_vet_id" TEXT NOT NULL,
    "bed_identifier" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HospitalizationStatus" NOT NULL DEFAULT 'ADMITTED',
    "admitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharged_at" TIMESTAMP(3),
    "discharge_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitalizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitalization_evolutions" (
    "id" TEXT NOT NULL,
    "hospitalization_id" TEXT NOT NULL,
    "recorded_by_vet_id" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "heart_rate" INTEGER,
    "respiratory_rate" INTEGER,
    "mucous_membranes" TEXT,
    "notes" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospitalization_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hospitalizations_clinic_id_status_idx" ON "hospitalizations"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "hospitalization_evolutions_hospitalization_id_recorded_at_idx" ON "hospitalization_evolutions"("hospitalization_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "hospitalizations" ADD CONSTRAINT "hospitalizations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalizations" ADD CONSTRAINT "hospitalizations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalizations" ADD CONSTRAINT "hospitalizations_admitted_by_vet_id_fkey" FOREIGN KEY ("admitted_by_vet_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalization_evolutions" ADD CONSTRAINT "hospitalization_evolutions_hospitalization_id_fkey" FOREIGN KEY ("hospitalization_id") REFERENCES "hospitalizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalization_evolutions" ADD CONSTRAINT "hospitalization_evolutions_recorded_by_vet_id_fkey" FOREIGN KEY ("recorded_by_vet_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
