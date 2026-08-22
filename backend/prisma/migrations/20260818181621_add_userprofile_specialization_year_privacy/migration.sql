-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "specialization" VARCHAR(100),
ADD COLUMN     "year_info_private" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "preferred_language" SET DATA TYPE VARCHAR(150);
