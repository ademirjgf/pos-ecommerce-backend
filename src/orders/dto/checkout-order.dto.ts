import { IsInt, Min } from 'class-validator';

export class CheckoutOrderDto {
  @IsInt()
  @Min(1)
  addressId!: number;
}