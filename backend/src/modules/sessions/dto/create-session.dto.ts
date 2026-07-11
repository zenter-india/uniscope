import { SessionType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  mentorId!: string;

  @IsEnum(SessionType)
  type!: SessionType;
}
