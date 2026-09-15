-- CreateEnum
CREATE TYPE "PasswordTokenType" AS ENUM ('FIRST_ACCESS', 'RECOVERY');

-- AlterTable
ALTER TABLE "password_tokens" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "type" "PasswordTokenType" NOT NULL DEFAULT 'RECOVERY';

-- CreateIndex
CREATE INDEX "password_tokens_user_id_type_idx" ON "password_tokens"("user_id", "type");
