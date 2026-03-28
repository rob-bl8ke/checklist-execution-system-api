import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateInstanceDto {
  @IsPositive()
  templateId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;
}
