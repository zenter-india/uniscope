import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableDays?: string[];

  /** MENTOR-only — opts a mentor in/out of appearing in GET /mentors.
   * Rejected for non-mentors at the service layer. */
  @IsOptional()
  @IsBoolean()
  isMentorAvailable?: boolean;

  // Aspirant onboarding fields — see UserProfile.gender/state/city/etc.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  qualification?: string;

  /** Free text — only meaningful for a Medical-stream user whose
   * qualification isn't 12th/UG, e.g. "Paediatrics". Not FK'd to any
   * picklist. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  // Dual-purpose (see UserProfile.stream): aspirant school-stream OR mentor
  // college field-of-study — widened to fit values like "Commerce & Business".
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stream?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  courseInterested?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  preferredMentorshipTiming?: string;

  /** Only one of yearOfStudy/graduationYear is ever set at a time (driven by
   * currentStatus), so a single flag covers keeping either private. */
  @IsOptional()
  @IsBoolean()
  yearInfoPrivate?: boolean;

  /** MENTOR onboarding — the mentor's actual legal name. Stored AES-256-GCM
   * encrypted (see profile-encryption.helper.ts), never returned in any
   * response projection; only ever used for admin identity review. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  realName?: string;

  /** MENTOR-only — the UPI VPA (e.g. "name@okhdfcbank") an admin pays the
   * mentor's weekly payout to. Stored AES-256-GCM encrypted; returned only
   * to the mentor themselves and on the admin payout list. An empty string
   * (or null) clears it. Rejected for a non-mentor at the service layer. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ValidateIf((o) => o.upiId !== '' && o.upiId != null)
  @IsString()
  @MaxLength(255)
  @Matches(/^[\w.\-]{2,256}@[a-zA-Z][\w.\-]{1,63}$/, {
    message: 'Enter a valid UPI ID, e.g. name@bank',
  })
  upiId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  yearOfStudy?: number;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  graduationYear?: number;

  /** ASPIRANT onboarding only (2026-09-07, added for the college+
   * specialization step ported from the web enrollment form) — the college
   * they're aiming for/attending, resolved via findOrCreate the same way
   * the mentor onboarding wizard resolves its own college field. Rejected
   * for a MENTOR at the service layer: a mentor's `universityId` is
   * verification-linked (see VerificationService.review) and must never be
   * overwritten by this self-service path. */
  @IsOptional()
  @IsUUID()
  universityId?: string;
}
