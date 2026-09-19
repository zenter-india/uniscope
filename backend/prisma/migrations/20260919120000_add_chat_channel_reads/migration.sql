-- Unread-message counts (both roles) — see CLAUDE.md "Phase 2" note under
-- the Sessions-tab chat-list-preview feature.

-- CreateTable
CREATE TABLE "chat_channel_reads" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_channel_reads_user_id_idx" ON "chat_channel_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_channel_reads_channel_id_user_id_key" ON "chat_channel_reads"("channel_id", "user_id");

-- AddForeignKey
ALTER TABLE "chat_channel_reads" ADD CONSTRAINT "chat_channel_reads_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channel_reads" ADD CONSTRAINT "chat_channel_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every other public table has RLS enabled (see 20260911140000_enable_rls_all_tables)
-- as a deny-by-default backstop against a future accidental anon/authenticated
-- grant — this new table follows the same convention from day one.
ALTER TABLE "chat_channel_reads" ENABLE ROW LEVEL SECURITY;
