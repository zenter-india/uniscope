import { Review, UserRole } from '@prisma/client';

export interface UniversityReviewResponse {
  id: string;
  universityId: string;
  overallRating: number;
  facultyRating: number | null;
  infrastructureRating: number | null;
  clinicalExposureRating: number | null;
  campusLifeRating: number | null;
  placementsRating: number | null;
  workloadRating: number | null;
  wouldRecommend: boolean | null;
  tags: string[];
  pros: string | null;
  cons: string | null;
  body: string | null;
  helpfulCount: number;
  createdAt: Date;
  /** Never a name or handle — only the author's role, so a review reads as
   * "from a Mentor" / "from a Student" with no identity attached. */
  authorRole: UserRole;
}

export function toUniversityReviewResponse(
  review: Review & { author: { role: UserRole } },
): UniversityReviewResponse {
  return {
    id: review.id,
    universityId: review.universityId,
    overallRating: review.overallRating,
    facultyRating: review.facultyRating,
    infrastructureRating: review.infrastructureRating,
    clinicalExposureRating: review.clinicalExposureRating,
    campusLifeRating: review.campusLifeRating,
    placementsRating: review.placementsRating,
    workloadRating: review.workloadRating,
    wouldRecommend: review.wouldRecommend,
    tags: review.tags,
    pros: review.pros,
    cons: review.cons,
    body: review.body,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    authorRole: review.author.role,
  };
}
