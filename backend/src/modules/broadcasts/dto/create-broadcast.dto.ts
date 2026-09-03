import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const BROADCAST_AUDIENCES = ['ALL', 'ASPIRANT', 'MENTOR'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export class CreateBroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @IsIn(BROADCAST_AUDIENCES)
  audience!: BroadcastAudience;
}
