import { SessionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** `as` selects which side of the booking to list from — a user can be both
 * an aspirant on some sessions and a mentor on others. */
export class ListSessionsDto {
  @IsOptional()
  @IsEnum(['aspirant', 'mentor'])
  as?: 'aspirant' | 'mentor';

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
