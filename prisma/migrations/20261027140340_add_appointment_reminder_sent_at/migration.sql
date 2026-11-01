-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "reminder_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "appointments_status_date_time_reminder_sent_at_idx" ON "appointments"("status", "date_time", "reminder_sent_at");
