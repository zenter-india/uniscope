import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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
  @MaxLength(50)
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
}
