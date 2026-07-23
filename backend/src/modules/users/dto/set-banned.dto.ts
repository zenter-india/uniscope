import { IsBoolean } from 'class-validator';

export class SetBannedDto {
  @IsBoolean()
  banned!: boolean;
}
