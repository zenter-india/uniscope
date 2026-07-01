import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  serviceId!: string;
}
