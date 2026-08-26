-- Case-insensitive uniqueness on display_name. Not expressible as a plain
-- Prisma @@unique (that would be case-sensitive and let "Riya" + "riya"
-- coexist), so this is a hand-written functional index rather than a
-- migrate-diff output. Pre-req: no two existing rows collide case-
-- insensitively (verified and the one real collision, two "Heisenberg"
-- accounts, was renamed before this migration was written).
CREATE UNIQUE INDEX "users_display_name_lower_key" ON "users" (LOWER("display_name"));
