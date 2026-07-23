import { Review } from '@prisma/client';

export interface UniversityReviewResponse {
  id: string;
  universityId: string;
  overallRating: number;
  facultyRating: number | null;
  infrastructureRating: number | null;
  clinicalExposureRating: number | null;
  campusLifeRating: number | null;
  placementsRating: number | null;
  pros: string | null;
  cons: string | null;
  body: string | null;
  helpfulCount: number;
  createdAt: Date;
  /** Pseudonym only — never the real identity, same anonymity model as
   * every other user-facing surface in this app. */
  authorDisplayName: string;
}

export function toUniversityReviewResponse(
  review: Review & { author: { displayName: string } },
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
    pros: review.pros,
    cons: review.cons,
    body: review.body,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    authorDisplayName: review.author.displayName,
  };
}
