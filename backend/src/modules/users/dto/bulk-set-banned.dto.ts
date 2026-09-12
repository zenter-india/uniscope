import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';

/** ADMIN-only bulk ban/unban — e.g. banning a batch of accounts flagged by
 * the same spam wave. */
export class BulkSetBannedDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsBoolean()
  banned!: boolean;
}
