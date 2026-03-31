import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BothOrNeither } from '../../common/both-or-neither.validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  @BothOrNeither('variableSuffix')
  variablePrefix?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  @BothOrNeither('variablePrefix')
  variableSuffix?: string;
}
