-- CreateEnum
CREATE TYPE "DataImportType" AS ENUM ('UG', 'PG');

-- CreateEnum
CREATE TYPE "DataImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'APPLIED');

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" TEXT NOT NULL,
    "type" "DataImportType" NOT NULL,
    "status" "DataImportStatus" NOT NULL DEFAULT 'RUNNING',
    "diffJson" JSONB,
    "appliedJson" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "applied_at" TIMESTAMPTZ,
    "applied_by" TEXT,

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_import_jobs_type_started_at_idx" ON "data_import_jobs"("type", "started_at" DESC);
