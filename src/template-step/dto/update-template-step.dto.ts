import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateStepDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  instructions?: string;
}
