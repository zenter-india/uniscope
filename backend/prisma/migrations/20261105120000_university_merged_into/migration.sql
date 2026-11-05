-- Set on a college that was merged into another via the admin merge tool, so
-- the admin list can hide it (a plain deactivation stays visible as Inactive).
ALTER TABLE "universities" ADD COLUMN "merged_into_id" TEXT;
