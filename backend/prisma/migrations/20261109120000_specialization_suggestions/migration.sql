-- Specializations a mentor entered for their college that the college's own list
-- doesn't have yet. An admin approves them; approval adds the specialization to
-- that college's program so everyone who picks the college sees it next time.

-- CreateTable
CREATE TABLE "specialization_suggestions" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "degree" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_key" VARCHAR(100) NOT NULL,
    "status" "CustomDegreeStatus" NOT NULL DEFAULT 'PENDING',
    "submission_count" INTEGER NOT NULL DEFAULT 1,
    "first_submitted_by" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "specialization_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "specialization_suggestions_university_id_degree_name_key_key" ON "specialization_suggestions"("university_id", "degree", "name_key");

-- CreateIndex
CREATE INDEX "specialization_suggestions_status_created_at_idx" ON "specialization_suggestions"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "specialization_suggestions" ADD CONSTRAINT "specialization_suggestions_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every other public table has RLS enabled (see 20260911140000_enable_rls_all_tables)
-- as a deny-by-default backstop — this new table follows the same convention.
ALTER TABLE "specialization_suggestions" ENABLE ROW LEVEL SECURITY;
