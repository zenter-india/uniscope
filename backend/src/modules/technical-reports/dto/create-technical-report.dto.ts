import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateTechnicalReportDto {
  @IsString()
  @Length(1, 2000)
  message!: string;

  /** Best-effort — the client sends this so an admin knows which build to
   * look at. Not trusted for anything security-relevant. */
  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  appVersion?: string;
}
