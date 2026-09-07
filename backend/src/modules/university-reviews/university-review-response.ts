import { Review, UserRole } from '@prisma/client';

/**
 * Anonymised projection of one university review — the client-confirmed
 * 13-question shape. Q1–Q4 map onto the pre-existing category-rating
 * columns (see CreateUniversityReviewDto for the mapping); Q5–Q12 are
 * choice codes (see dto/review-choices.ts; restroomFacilities/Q5 was added
 * 2026-09-07, pushing the original Q5–Q11 set to Q6–Q12); Q13 is
 * `overallRating`. Never carries the author's name/handle — only their
 * role, so a review reads as "from a Mentor" / "from a Student" with no
 * identity attached.
 */
export interface UniversityReviewResponse {
  id: string;
  universityId: string;
  overallRating: number; // Q13
  clinicalExposureRating: number | null; // Q1 Academic Exposure
  campusLifeRating: number | null; // Q2 Campus Culture & Environment
  workloadRating: number | null; // Q3 Workload & Stress Level
  placementsRating: number | null; // Q4 Future Value & Career Outcomes
  restroomFacilities: string | null; // Q5
  raggingCulture: string | null; // Q6
  facultyApproachability: string | null; // Q7
  stipendStatus: string | null; // Q8
  hostelAvailability: string | null; // Q9
  hostelSafety: string | null; // Q10
  wouldRecommend: string | null; // Q11 (choice code, was a Boolean pre-form)
  valueForMoney: string | null; // Q12
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
    restroomFacilities: review.restroomFacilities,
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
