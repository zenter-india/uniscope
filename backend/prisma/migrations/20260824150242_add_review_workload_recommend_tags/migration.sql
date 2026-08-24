-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workload_rating" SMALLINT,
ADD COLUMN     "would_recommend" BOOLEAN;
