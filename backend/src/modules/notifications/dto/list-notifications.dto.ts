import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListNotificationsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class StorePushTokenDto {
  @IsString()
  token!: string;

  // 'ios-voip' is a PushKit device token (real ringing/CallKit), a
  // completely separate credential from the regular FCM 'ios' token — see
  // ApnsVoipService, which sends to it directly via APNs, never through FCM.
  @IsIn(['ios', 'android', 'ios-voip'])
  platform!: 'ios' | 'android' | 'ios-voip';
}

/** Body for `DELETE /users/me/push-token` — unbinds a device token from the
 * caller on logout. Only the token; platform is irrelevant for a delete. */
export class RemovePushTokenDto {
  @IsString()
  token!: string;
}
