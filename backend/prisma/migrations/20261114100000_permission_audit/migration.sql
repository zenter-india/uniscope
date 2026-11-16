-- Who denied a permission and why, plus an append-only history of changes.
ALTER TABLE "user_permission_denials"
  ADD COLUMN "denied_by" VARCHAR(120),
  ADD COLUMN "reason" VARCHAR(300);

CREATE TABLE "user_permission_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" VARCHAR(40) NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "admin_email" VARCHAR(120),
    "reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_permission_events_user_id_created_at_idx" ON "user_permission_events"("user_id", "created_at" DESC);

ALTER TABLE "user_permission_events" ADD CONSTRAINT "user_permission_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same deny-by-default RLS posture as every other public table.
ALTER TABLE "user_permission_events" ENABLE ROW LEVEL SECURITY;
