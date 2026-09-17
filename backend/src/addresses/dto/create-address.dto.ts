import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(3)
  street: string;

  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  zipCode: string;
}
