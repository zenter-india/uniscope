import { IsOptional, IsUUID } from 'class-validator';

/** Query params for GET .../chat/messages — cursor pagination for loading
 * older history. Omitted `before`: the latest page (unchanged v1
 * behavior). `before=<messageId>`: the page immediately older than that
 * message, for "load more" when the user scrolls to the top of a channel
 * with more than one page of history. */
export class ListMessagesDto {
  @IsOptional()
  @IsUUID()
  before?: string;
}
