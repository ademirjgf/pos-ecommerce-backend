import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsInt()
  @Min(1)
  categoryId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice!: number;

  @IsInt()
  @Min(0)
  initialStock!: number;
}