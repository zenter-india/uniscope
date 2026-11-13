-- Per-admin permissions for the admin panel. Existing admins keep full access.
ALTER TABLE "admin_accounts"
  ADD COLUMN "full_access" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
