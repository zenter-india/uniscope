import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FindOrCreateUniversityDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(100)
  state!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  stream?: string;
}
