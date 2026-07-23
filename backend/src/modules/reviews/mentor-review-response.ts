import { MentorReview } from '@prisma/client';

/** Deliberately omits aspirantId — reviews are shown to mentors and other
 * aspirants alike, and the reviewer stays anonymous (matches the app-wide
 * anonymity model documented for support chat / reports). */
export interface MentorReviewResponse {
  id: string;
  sessionId: string;
  mentorId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export function toMentorReviewResponse(review: MentorReview): MentorReviewResponse {
  return {
    id: review.id,
    sessionId: review.sessionId,
    mentorId: review.mentorId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}
