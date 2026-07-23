-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "gender" VARCHAR(30),
ADD COLUMN     "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "qualification" VARCHAR(50),
ADD COLUMN     "state" VARCHAR(100),
ADD COLUMN     "stream" VARCHAR(20);
