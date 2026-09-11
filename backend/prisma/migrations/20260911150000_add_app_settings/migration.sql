-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- Match the deny-by-default RLS posture applied to every other public
-- table (see 20260911140000_enable_rls_all_tables) -- the backend connects
-- with the service-role, which bypasses RLS entirely, so this has no
-- effect on it; it only forecloses a future accidental anon/authenticated
-- grant on this table.
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
