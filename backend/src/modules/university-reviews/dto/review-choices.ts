/**
 * Fixed answer sets for the 7 single-choice questions in the university
 * review (Q5–Q11 of the client-confirmed form). Stored as short stable
 * codes, never the display sentence — the mobile client maps each code back
 * to its exact label/sub-copy (see
 * mobile_flutter/lib/features/universities/review_choices.dart, kept in
 * sync with this file). Codes are ordered best → worst so aggregation can
 * treat index as severity without a separate weight table.
 */

export const RAGGING_CULTURE = [
  'HEALTHY', // Very healthy and supportive
  'MINOR_ISSUES', // Generally fine, minor issues
  'DEPT_DEPENDENT', // Depends on the department
  'TOXIC_AREAS', // Toxic in some areas
  'SERIOUS', // Serious ragging or toxic culture
] as const;

export const FACULTY_APPROACHABILITY = [
  'OPEN_DOOR', // Very approachable — open door policy
  'SCHEDULED_HOURS', // Approachable during scheduled hours
  'HIT_OR_MISS', // Hit or miss — depends on the faculty
  'HARD_TO_REACH', // Difficult to reach — not student-friendly
] as const;

export const STIPEND_STATUS = [
  'ON_TIME', // Yes — paid on time every month
  'DELAYED', // Yes — but delayed frequently
  'INSUFFICIENT', // Yes — but amount is insufficient
  'IRREGULAR', // Rarely or irregularly paid
  'NONE', // Not applicable / No stipend provided
] as const;

export const HOSTEL_AVAILABILITY = [
  'GOOD', // Yes — available and well maintained
  'AVERAGE', // Yes — available but average condition
  'POOR', // Yes — available but poor condition
  'NONE', // Not available at all
] as const;

export const HOSTEL_SAFETY = [
  'VERY_SAFE', // Very safe, clean and comfortable
  'DECENT', // Decent — manageable day to day
  'CONCERNS', // Some safety or hygiene concerns
  'POOR', // Poor — not recommended
  'NA', // Not applicable — no hostel
] as const;

export const WOULD_RECOMMEND = [
  'ABSOLUTELY', // Absolutely — without hesitation
  'RIGHT_PERSON', // Yes — but only for the right person
  'DEPENDS', // Depends on what they're looking for
  'PROBABLY_NOT', // Honestly, probably not
] as const;

/** Which `wouldRecommend` codes count toward the aggregated
 * "% would recommend" number on the summary card. */
export const WOULD_RECOMMEND_POSITIVE: readonly string[] = ['ABSOLUTELY', 'RIGHT_PERSON'];

export const VALUE_FOR_MONEY = [
  'WORTH_IT', // 100% worth every rupee
  'COULD_BE_BETTER', // Worth it — but could be better
  'BORDERLINE', // Borderline — think carefully before joining
  'NOT_WORTH', // Not worth the fees at all
] as const;

export type RaggingCulture = (typeof RAGGING_CULTURE)[number];
export type FacultyApproachability = (typeof FACULTY_APPROACHABILITY)[number];
export type StipendStatus = (typeof STIPEND_STATUS)[number];
export type HostelAvailability = (typeof HOSTEL_AVAILABILITY)[number];
export type HostelSafety = (typeof HOSTEL_SAFETY)[number];
export type WouldRecommend = (typeof WOULD_RECOMMEND)[number];
export type ValueForMoney = (typeof VALUE_FOR_MONEY)[number];

/** The 7 choice fields, keyed by their `Review` column name — used by
 * `reviewSummary` to build a code→count distribution per question without
 * repeating the field list. */
export const REVIEW_CHOICE_FIELDS = {
  raggingCulture: RAGGING_CULTURE,
  facultyApproachability: FACULTY_APPROACHABILITY,
  stipendStatus: STIPEND_STATUS,
  hostelAvailability: HOSTEL_AVAILABILITY,
  hostelSafety: HOSTEL_SAFETY,
  wouldRecommend: WOULD_RECOMMEND,
  valueForMoney: VALUE_FOR_MONEY,
} as const;

export type ReviewChoiceField = keyof typeof REVIEW_CHOICE_FIELDS;
