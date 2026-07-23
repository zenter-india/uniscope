-- CreateTable
CREATE TABLE "saved_universities" (
    "id" TEXT NOT NULL,
    "aspirant_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_universities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_universities_university_id_idx" ON "saved_universities"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_universities_aspirant_id_university_id_key" ON "saved_universities"("aspirant_id", "university_id");

-- AddForeignKey
ALTER TABLE "saved_universities" ADD CONSTRAINT "saved_universities_aspirant_id_fkey" FOREIGN KEY ("aspirant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_universities" ADD CONSTRAINT "saved_universities_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
