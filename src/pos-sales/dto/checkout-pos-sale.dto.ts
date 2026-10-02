import { IsEnum } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client.js';

export class CheckoutPosSaleDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}