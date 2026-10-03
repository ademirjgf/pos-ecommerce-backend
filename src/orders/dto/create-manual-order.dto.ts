import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ManualOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateManualOrderDto {
  @ApiProperty({ enum: ['MARKETPLACE', 'MANUAL'], example: 'MARKETPLACE' })
  @IsIn(['MARKETPLACE', 'MANUAL'])
  source!: 'MARKETPLACE' | 'MANUAL';

  @ApiProperty({ example: 'Ana' })
  @IsString()
  @MinLength(1)
  @MaxLength(70)
  firstName!: string;

  @ApiProperty({ example: 'Torres' })
  @IsString()
  @MinLength(1)
  @MaxLength(70)
  lastName!: string;

  @ApiProperty({ example: '999888777' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'Av. Ejercito 123' })
  @IsString()
  @MinLength(1)
  shippingAddress!: string;

  @ApiProperty({ example: 'Cayma' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  district!: string;

  @ApiProperty({ example: 'Arequipa' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional({ example: 'Frente al parque' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({
    example: true,
    description:
      'Debe ser true SOLO si el administrador verificó que la venta externa ya fue pagada. No realiza cobros con MockPay.',
  })
  @Equals(true)
  paymentConfirmed!: boolean;

  @ApiProperty({ type: [ManualOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ManualOrderItemDto)
  items!: ManualOrderItemDto[];
}
