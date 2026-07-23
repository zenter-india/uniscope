-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "course_interested" VARCHAR(50),
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "preferred_language" VARCHAR(30),
ADD COLUMN     "preferred_mentorship_timing" VARCHAR(50);
