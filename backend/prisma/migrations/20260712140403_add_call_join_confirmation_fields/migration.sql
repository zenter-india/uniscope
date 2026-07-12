-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "aspirant_joined_at" TIMESTAMPTZ,
ADD COLUMN     "call_slot_minutes" INTEGER,
ADD COLUMN     "mentor_joined_at" TIMESTAMPTZ;

