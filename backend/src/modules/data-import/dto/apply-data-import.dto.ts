import { IsArray, IsString } from 'class-validator';

/** Every diff item carries a `key` the admin panel echoes back here — never
 * re-derive matching server-side at apply time, only act on keys present in
 * the job's own stored diffJson. See DataImportService.apply. */
export class ApplyDataImportDto {
  @IsArray()
  @IsString({ each: true })
  approvedKeys!: string[];
}
