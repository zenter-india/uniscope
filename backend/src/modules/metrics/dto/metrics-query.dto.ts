import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class MetricsQueryDto {
  /** Window size in days. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days?: 7 | 30 | 90;
}
