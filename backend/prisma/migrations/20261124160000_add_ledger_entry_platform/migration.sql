-- UNI-17: the admin Money page splits top-ups by platform (iOS / Android / Web).
-- Add-only: one nullable column and one index on ledger_entries. Existing rows
-- are NOT touched — the ledger is append-only, so top-ups from before this
-- column are classified when they are read, not by updating them.

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN "platform" VARCHAR(20);

-- CreateIndex
CREATE INDEX "ledger_entries_type_created_at_idx" ON "ledger_entries"("type", "created_at");
