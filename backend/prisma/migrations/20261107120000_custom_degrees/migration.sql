-- Degrees/courses users type under "Others" during profile creation: queued
-- for admin approval, then offered in that stream's degree picker for everyone.

-- CreateEnum
CREATE TYPE "CustomDegreeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "custom_degrees" (
    "id" TEXT NOT NULL,
    "stream" VARCHAR(60) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "name_key" VARCHAR(50) NOT NULL,
    "status" "CustomDegreeStatus" NOT NULL DEFAULT 'PENDING',
    "submission_count" INTEGER NOT NULL DEFAULT 1,
    "first_submitted_by" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_degrees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_degrees_stream_name_key_key" ON "custom_degrees"("stream", "name_key");

-- CreateIndex
CREATE INDEX "custom_degrees_status_created_at_idx" ON "custom_degrees"("status", "created_at" DESC);

-- Every other public table has RLS enabled (see 20260911140000_enable_rls_all_tables)
-- as a deny-by-default backstop — this new table follows the same convention.
ALTER TABLE "custom_degrees" ENABLE ROW LEVEL SECURITY;
