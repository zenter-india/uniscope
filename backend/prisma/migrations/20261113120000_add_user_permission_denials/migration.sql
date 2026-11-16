-- CreateTable
CREATE TABLE "user_permission_denials" (
    "user_id" TEXT NOT NULL,
    "permission" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_denials_pkey" PRIMARY KEY ("user_id","permission")
);

-- AddForeignKey
ALTER TABLE "user_permission_denials" ADD CONSTRAINT "user_permission_denials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same deny-by-default RLS posture as every other public table (see
-- 20260911140000_enable_rls_all_tables). The backend connects as a role that
-- bypasses RLS, so this only forecloses a future accidental anon grant.
ALTER TABLE "user_permission_denials" ENABLE ROW LEVEL SECURITY;
