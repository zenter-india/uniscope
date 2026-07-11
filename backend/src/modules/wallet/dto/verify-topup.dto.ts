import { IsString } from 'class-validator';

/** Payload Razorpay Checkout hands back to the client on successful
 * payment — verified server-side against key_secret before crediting. */
export class VerifyTopupDto {
  @IsString()
  razorpayOrderId!: string;

  @IsString()
  razorpayPaymentId!: string;

  @IsString()
  razorpaySignature!: string;
}
