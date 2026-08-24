/** Fixed picklist of highlight tags a reviewer can select — validated
 * server-side so tag counts on the summary card are always a small, known
 * set (never arbitrary free text). Mirrored in
 * mobile_flutter/lib/features/profile/profile_options.dart as
 * kReviewTags — keep the two in sync. */
export const REVIEW_TAGS = [
  'Great exposure',
  'Good placement',
  'Great faculty',
  'Heavy workload',
  'Good hostel',
  'Worth the fees',
  'Stipend delayed',
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];
