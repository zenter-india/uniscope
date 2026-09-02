import { DocumentType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Fields common to both enrollment forms. Everything except name and phone is
 * optional on purpose: this is a public marketing form, and a half-filled lead
 * with a working phone number is far more valuable than a validation error
 * that makes someone abandon the page. The stricter, complete field set is
 * enforced later — in the real onboarding wizard, once they have an account.
 */
export abstract class BaseLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

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
  stream?: string;

  /**
   * Honeypot. Rendered hidden (and never labelled "website") on the form, so a
   * real person can't see or fill it — anything non-empty here is a bot. The
   * request is accepted and silently discarded rather than rejected, so a
   * scripted submitter gets no signal that it was caught and no reason to
   * adapt. Deliberately not a captcha: this costs nothing and catches the
   * commodity form-spam that makes up nearly all of it.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class CreateAspirantLeadDto extends BaseLeadDto {
  /** Widened to also carry the degree-stage picklist (UG, PG, MD/MS, etc.) —
   * the form merged its separate Degree field into this one rather than
   * keeping two fields for the same "what stage" question. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  qualification?: string;

  /** Set when the college was picked from the curated/GET /universities
   * dropdown -- shown (along with collegeName) whenever qualification isn't
   * "Higher Secondary (12th)", same curated-per-stream mechanism as the
   * mentor lead's own College field. Previously mentor-only; extended here
   * per explicit request. */
  @IsOptional()
  @IsString()
  universityId?: string;

  /** Always sent when the College field is shown — the raw text of
   * whatever was chosen or typed, so a college that isn't in the
   * University table yet doesn't lose the answer. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  collegeName?: string;

  /** Free text or picked from a curated/full-degree list, shown whenever
   * qualification isn't "Higher Secondary (12th)" -- e.g. "Cardiology"
   * for a Medical aspirant past 12th/UG, matching whatever the picked
   * (or typed) specialization is for that stream+degree's dataset. Not
   * FK'd to any picklist, same pattern as the mentor lead's field. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  courseInterested?: string;

  /** Multi-select on the web form — multiple picks are joined into one
   * readable string client-side, same pattern as preferredMentorshipTiming. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  preferredMentorshipTiming?: string;
}

export class CreateMentorLeadDto extends BaseLeadDto {
  /** Public-facing pseudonym, mirroring the mobile mentor wizard's alias step.
   * Not checked for availability here — a lead isn't a `User` yet, so there's
   * no `displayName` to collide with until conversion. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  alias?: string;

  /** Set when the college was picked from the GET /universities dropdown. */
  @IsOptional()
  @IsString()
  universityId?: string;

  /** Always sent — the raw text of whatever they chose or typed, so a college
   * that isn't in the University table yet doesn't lose the answer. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  collegeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  degree?: string;

  /** Free text — only meaningful (and only shown on the form) for a
   * Medical-stream mentor whose degree isn't UG, e.g. "Paediatrics" for an
   * MD/MS. Not FK'd to any picklist. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  currentStatus?: string;

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

  /** Only one of yearOfStudy/graduationYear is ever set at a time (driven by
   * currentStatus), so a single flag covers keeping either private. */
  @IsOptional()
  @IsBoolean()
  yearInfoPrivate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @MaxLength(50, { each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(7)
  @MaxLength(40, { each: true })
  availableDays?: string[];

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  /** Raw base64 image data (no `data:` URI prefix), same contract as
   * SubmitVerificationDto. Optional — a mentor can enrol without it and
   * upload the real document during verification after conversion. */
  @IsOptional()
  @IsString()
  @MinLength(100)
  @MaxLength(14_000_000)
  documentBase64?: string;
}
