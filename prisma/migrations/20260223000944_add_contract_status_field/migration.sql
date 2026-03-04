-- CreateEnum
CREATE TYPE "public"."ContractStatus" AS ENUM ('ACTIVE', 'FUTURE', 'EXPIRED');

-- AlterTable
ALTER TABLE "public"."Contract" ADD COLUMN     "status" "public"."ContractStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill status for existing contracts
UPDATE "public"."Contract" SET "status" = 'FUTURE' WHERE "startYear" > 2025;
UPDATE "public"."Contract" SET "status" = 'EXPIRED' WHERE "endYear" < 2026;

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "public"."Contract"("status");
