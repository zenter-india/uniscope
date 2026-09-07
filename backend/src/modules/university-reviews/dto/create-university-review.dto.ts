import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FACULTY_APPROACHABILITY,
  HOSTEL_AVAILABILITY,
  HOSTEL_SAFETY,
  RAGGING_CULTURE,
  RESTROOM_FACILITIES,
  STIPEND_STATUS,
  VALUE_FOR_MONEY,
  WOULD_RECOMMEND,
} from './review-choices.js';
import { REVIEW_TAGS } from './review-tags.js';

/**
 * The client-confirmed 13-question university review. All thirteen answers
 * are required (the mobile form's Submit is disabled until every one is set);
 * the tag chips and the free-text summary are the only optional parts.
 *
 * Q1–Q4 (sliders) reuse the pre-existing category-rating columns:
 *   Q1 Academic Exposure           -> clinicalExposureRating
 *   Q2 Campus Culture & Environment -> campusLifeRating
 *   Q3 Workload & Stress Level      -> workloadRating
 *   Q4 Future Value & Career        -> placementsRating
 * Q5–Q12 are single-choice codes (see review-choices.ts; Q5 restroomFacilities
 * was added 2026-09-07, pushing the original Q5–Q11 set down to Q6–Q12); Q13
 * is the star `overallRating`. Legacy columns facultyRating /
 * infrastructureRating / pros / cons are no longer collected and are left
 * null.
 *
 * `update` reuses this same DTO — an edit re-submits the whole form, which
 * matches the all-or-nothing mobile screen.
 */
export class CreateUniversityReviewDto {
  // ── Q13: Overall Experience (star) ──
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  // ── Q1–Q4: sliders, 1–5 ──
  @IsInt()
  @Min(1)
  @Max(5)
  clinicalExposureRating!: number; // Q1 Academic Exposure

  @IsInt()
  @Min(1)
  @Max(5)
  campusLifeRating!: number; // Q2 Campus Culture & Environment

  @IsInt()
  @Min(1)
  @Max(5)
  workloadRating!: number; // Q3 Workload & Stress Level

  @IsInt()
  @Min(1)
  @Max(5)
  placementsRating!: number; // Q4 Future Value & Career Outcomes

  // ── Q5–Q12: single choice ──
  @IsIn(RESTROOM_FACILITIES)
  restroomFacilities!: string; // Q5

  @IsIn(RAGGING_CULTURE)
  raggingCulture!: string; // Q6

  @IsIn(FACULTY_APPROACHABILITY)
  facultyApproachability!: string; // Q7

  @IsIn(STIPEND_STATUS)
  stipendStatus!: string; // Q8

  @IsIn(HOSTEL_AVAILABILITY)
  hostelAvailability!: string; // Q9

  @IsIn(HOSTEL_SAFETY)
  hostelSafety!: string; // Q10

  @IsIn(WOULD_RECOMMEND)
  wouldRecommend!: string; // Q11

  @IsIn(VALUE_FOR_MONEY)
  valueForMoney!: string; // Q12

  // ── Optional "Quick Experience Summary" ──
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REVIEW_TAGS.length)
  @IsIn(REVIEW_TAGS, { each: true })
  tags?: string[];

  /** "In your own words" — the mobile field caps at 300 chars. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  body?: string;
}
