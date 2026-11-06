import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class MetricsQueryDto {
  /** Window size in days. 1 is the rolling last 24 hours. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 7, 30, 90])
  days?: 1 | 7 | 30 | 90;
}
