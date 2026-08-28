-- AlterTable
ALTER TABLE "users" ADD COLUMN     "unique_id" VARCHAR(11);

-- CreateTable
CREATE TABLE "id_sequence_counters" (
    "bucket_key" VARCHAR(3) NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "id_sequence_counters_pkey" PRIMARY KEY ("bucket_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_unique_id_key" ON "users"("unique_id");
