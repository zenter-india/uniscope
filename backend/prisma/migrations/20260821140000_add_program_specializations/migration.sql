-- AlterTable
ALTER TABLE "programs" ADD COLUMN "specializations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
