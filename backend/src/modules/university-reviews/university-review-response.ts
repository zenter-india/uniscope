import { Review, UserRole } from '@prisma/client';

/**
 * Anonymised projection of one university review — the client-confirmed
 * 12-question shape. Q1–Q4 map onto the pre-existing category-rating
 * columns (see CreateUniversityReviewDto for the mapping); Q5–Q11 are
 * choice codes (see dto/review-choices.ts); Q12 is `overallRating`.
 * Never carries the author's name/handle — only their role, so a review
 * reads as "from a Mentor" / "from a Student" with no identity attached.
 */
export interface UniversityReviewResponse {
  id: string;
  universityId: string;
  overallRating: number; // Q12
  clinicalExposureRating: number | null; // Q1 Academic Exposure
  campusLifeRating: number | null; // Q2 Campus Culture & Environment
  workloadRating: number | null; // Q3 Workload & Stress Level
  placementsRating: number | null; // Q4 Future Value & Career Outcomes
  raggingCulture: string | null; // Q5
  facultyApproachability: string | null; // Q6
  stipendStatus: string | null; // Q7
  hostelAvailability: string | null; // Q8
  hostelSafety: string | null; // Q9
  wouldRecommend: string | null; // Q10 (choice code, was a Boolean pre-form)
  valueForMoney: string | null; // Q11
  tags: string[];
  body: string | null; // "In your own words"
  helpfulCount: number;
  createdAt: Date;
  authorRole: UserRole;
}

export function toUniversityReviewResponse(
  review: Review & { author: { role: UserRole } },
): UniversityReviewResponse {
  return {
    id: review.id,
    universityId: review.universityId,
    overallRating: review.overallRating,
    clinicalExposureRating: review.clinicalExposureRating,
    campusLifeRating: review.campusLifeRating,
    workloadRating: review.workloadRating,
    placementsRating: review.placementsRating,
    raggingCulture: review.raggingCulture,
    facultyApproachability: review.facultyApproachability,
    stipendStatus: review.stipendStatus,
    hostelAvailability: review.hostelAvailability,
    hostelSafety: review.hostelSafety,
    wouldRecommend: review.wouldRecommend,
    valueForMoney: review.valueForMoney,
    tags: review.tags,
    body: review.body,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    authorRole: review.author.role,
  };
}
