-- Permissions are for admin-panel users, not app users. Removes the app-user
-- permission tables added by 20261113120000 and 20261114100000 (they only
-- held test data: 0 denials, 2 test history rows).
DROP TABLE IF EXISTS "user_permission_events";
DROP TABLE IF EXISTS "user_permission_denials";
