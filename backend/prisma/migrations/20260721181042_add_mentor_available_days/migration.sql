-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "available_days" TEXT[] DEFAULT ARRAY[]::TEXT[];
