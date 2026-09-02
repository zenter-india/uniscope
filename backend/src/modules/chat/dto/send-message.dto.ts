import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Length(1, 4000)
  text!: string;

  /** Client-generated UUID, one per logical send attempt — lets
   * ChatService.sendMessage dedupe a retried/double-tapped POST into the
   * original message instead of creating a duplicate. Optional so an older
   * client build (or a future non-Flutter caller) that doesn't send one
   * still works, just without retry-safety. */
  @IsOptional()
  @IsUUID()
  clientMessageId?: string;
}
