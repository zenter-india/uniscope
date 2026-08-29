import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;

  // Was a strict 6-6 (matching Twilio's fixed 6-digit codes and
  // MockOtpProvider's fixed '111111'). Widened after finding live that
  // MSG91's DLT-approved OTP template generates a 4-digit code regardless
  // of the otp_length param on the send call — the DLT-approved template
  // content locks the format, and MSG91's API doesn't override it. 4-8
  // covers every provider's actual range without special-casing per
  // provider here.
  @IsString()
  @Length(4, 8)
  code!: string;

  @IsString()
  serviceId!: string;
}
