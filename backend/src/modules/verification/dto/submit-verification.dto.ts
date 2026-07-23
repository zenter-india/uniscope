import { DocumentType } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitVerificationDto {
  @IsString()
  universityId!: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  /** Raw base64 image data (no data: URI prefix). ~10MB request body cap
   * (see main.ts) bounds this to a ~7.3MB source image. */
  @IsString()
  @MinLength(100)
  @MaxLength(14_000_000)
  documentBase64!: string;
}
