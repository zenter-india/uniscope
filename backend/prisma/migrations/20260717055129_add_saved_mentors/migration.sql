-- CreateTable
CREATE TABLE "saved_mentors" (
    "id" TEXT NOT NULL,
    "aspirant_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_mentors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_mentors_mentor_id_idx" ON "saved_mentors"("mentor_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_mentors_aspirant_id_mentor_id_key" ON "saved_mentors"("aspirant_id", "mentor_id");

-- AddForeignKey
ALTER TABLE "saved_mentors" ADD CONSTRAINT "saved_mentors_aspirant_id_fkey" FOREIGN KEY ("aspirant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_mentors" ADD CONSTRAINT "saved_mentors_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
