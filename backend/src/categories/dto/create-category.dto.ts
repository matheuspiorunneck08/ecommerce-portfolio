import { Transform } from 'class-transformer';
import { IsString, Matches, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @Matches(/[a-zA-Z0-9]/, { message: 'name must contain at least one letter or digit' })
  name: string;
}
