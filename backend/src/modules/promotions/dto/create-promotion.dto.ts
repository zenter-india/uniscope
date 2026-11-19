import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PROMOTION_AUDIENCES = [
  'ALL',
  'ASPIRANT',
  'MENTOR',
  'SELECTED',
] as const;
export type PromotionAudience = (typeof PROMOTION_AUDIENCES)[number];

/** "A single user or a limited number of users" -- a hand-picked list is
 * capped so it stays a deliberate choice, not a way to dodge ALL/ASPIRANT/
 * MENTOR. */
export const MAX_SELECTED_USERS = 200;

/** Upper bounds on a per-person credit. A typo (an extra zero) is the real
 * risk with money, so the limits are deliberately modest; a bigger one-off
 * credit can still be made per user from the Users page. */
export const MAX_ASPIRANT_CREDIT_UNIMINUTES = 1000;
export const MAX_MENTOR_CREDIT_RUPEES = 10000;

export class CreatePromotionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @IsIn(PROMOTION_AUDIENCES)
  audience!: PromotionAudience;

  /** Only used when audience is SELECTED: the exact users to send to. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SELECTED_USERS)
  @IsString({ each: true })
  userIds?: string[];

  /** Optional link shown as a button on the popup. https only, so a
   * promotion can never open another app or a local file from a phone. */
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  linkLabel?: string;

  /** Uniminutes credited to each aspirant recipient (0/omitted = none). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_ASPIRANT_CREDIT_UNIMINUTES)
  aspirantUniminutes?: number;

  /** Whole rupees credited to each mentor recipient (0/omitted = none). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MENTOR_CREDIT_RUPEES)
  mentorRupees?: number;
}
