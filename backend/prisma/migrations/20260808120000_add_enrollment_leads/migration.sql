-- CreateEnum
CREATE TYPE "EnrollmentLeadRole" AS ENUM ('ASPIRANT', 'MENTOR');

-- CreateEnum
CREATE TYPE "EnrollmentLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'REJECTED');

-- CreateTable
CREATE TABLE "enrollment_leads" (
    "id" TEXT NOT NULL,
    "role" "EnrollmentLeadRole" NOT NULL,
    "status" "EnrollmentLeadStatus" NOT NULL DEFAULT 'NEW',
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(200),
    "date_of_birth" DATE,
    "gender" VARCHAR(30),
    "state" VARCHAR(100),
    "city" VARCHAR(100),
    "stream" VARCHAR(50),
    "qualification" VARCHAR(50),
    "course_interested" VARCHAR(50),
    "preferred_language" VARCHAR(30),
    "preferred_mentorship_timing" VARCHAR(50),
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alias" VARCHAR(60),
    "university_id" TEXT,
    "college_name" VARCHAR(200),
    "degree" VARCHAR(20),
    "current_status" VARCHAR(30),
    "year_of_study" SMALLINT,
    "graduation_year" SMALLINT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "available_days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "document_type" "DocumentType",
    "document_key" VARCHAR(500),
    "converted_user_id" TEXT,
    "admin_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "enrollment_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_leads_converted_user_id_key" ON "enrollment_leads"("converted_user_id");

-- CreateIndex
CREATE INDEX "enrollment_leads_status_created_at_idx" ON "enrollment_leads"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "enrollment_leads_role_created_at_idx" ON "enrollment_leads"("role", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_leads_role_phone_key" ON "enrollment_leads"("role", "phone");

-- AddForeignKey
ALTER TABLE "enrollment_leads" ADD CONSTRAINT "enrollment_leads_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

