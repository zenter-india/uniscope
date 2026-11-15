import { Type } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';

export class MetricsQueryDto {
  /** Window size in days. 1 is the rolling last 24 hours. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 7, 30, 90])
  days?: 1 | 7 | 30 | 90;

  /** Custom range: first day, `YYYY-MM-DD` (a UTC day). Send with `to`. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be written YYYY-MM-DD',
  })
  from?: string;

  /** Custom range: last day (included), `YYYY-MM-DD`. Send with `from`. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be written YYYY-MM-DD' })
  to?: string;
}
