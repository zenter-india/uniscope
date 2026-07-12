
-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "free_call_seconds_remaining" INTEGER NOT NULL DEFAULT 600,
ADD COLUMN     "free_chats_remaining" INTEGER NOT NULL DEFAULT 2;

