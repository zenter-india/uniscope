import { EnrollmentLeadRole } from '@prisma/client';
import { IsEnum, IsPhoneNumber, IsString } from 'class-validator';

/** Body of the public phone check used by the website sign-up forms. A POST
 * body rather than a query string, so the number isn't written into URLs and
 * access logs. */
export class PhoneAvailableDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;

  @IsEnum(EnrollmentLeadRole)
  role!: EnrollmentLeadRole;
}
