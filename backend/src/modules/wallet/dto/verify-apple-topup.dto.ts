import { IsNotEmpty, IsString } from 'class-validator';

/** The signed transaction JWS StoreKit hands the client after a purchase
 * (`purchaseDetails.verificationData.serverVerificationData`) — verified
 * server-side against Apple's certificate chain before crediting. This is
 * the iOS/StoreKit equivalent of VerifyTopupDto's Razorpay client-confirm
 * path. */
export class VerifyAppleTopupDto {
  @IsString()
  @IsNotEmpty()
  signedTransactionInfo!: string;
}
