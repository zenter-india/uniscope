import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class ResolveTechnicalReportDto {
  @IsIn(['OPEN', 'RESOLVED'])
  status!: 'OPEN' | 'RESOLVED';

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  adminNote?: string;
}
