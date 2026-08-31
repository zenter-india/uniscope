-- AlterTable
-- Widening a VARCHAR length in place is safe on Postgres — no rewrite of
-- existing rows, no need to touch the primary key constraint on bucket_key.
ALTER TABLE "id_sequence_counters" ALTER COLUMN "bucket_key" SET DATA TYPE VARCHAR(9);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "unique_id" SET DATA TYPE VARCHAR(12);
