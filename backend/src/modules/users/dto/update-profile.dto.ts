import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(20)
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
  @MaxLength(30)
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredMentorshipTiming?: string;
}
