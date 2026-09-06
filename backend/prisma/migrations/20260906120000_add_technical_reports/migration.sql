-- CreateEnum
CREATE TYPE "TechnicalReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "technical_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "platform" VARCHAR(20),
    "app_version" VARCHAR(40),
    "status" "TechnicalReportStatus" NOT NULL DEFAULT 'OPEN',
    "admin_note" VARCHAR(2000),
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "technical_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technical_reports_status_created_at_idx" ON "technical_reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "technical_reports_user_id_idx" ON "technical_reports"("user_id");

-- AddForeignKey
ALTER TABLE "technical_reports" ADD CONSTRAINT "technical_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_reports" ADD CONSTRAINT "technical_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
