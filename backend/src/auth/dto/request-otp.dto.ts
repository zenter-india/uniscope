import { IsPhoneNumber, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;
}
