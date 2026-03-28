import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTemplateStepDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  instructions?: string;
}
