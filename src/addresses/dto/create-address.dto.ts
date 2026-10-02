import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  recipientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  recipientPhone!: string;

  @IsString()
  @IsNotEmpty()
  addressLine!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}