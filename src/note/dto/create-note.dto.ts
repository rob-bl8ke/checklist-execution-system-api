import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BothOrNeither } from '../../common/both-or-neither.validator';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @MaxLength(10)
  @IsOptional()
  @BothOrNeither('variableSuffix', {
    message: 'variablePrefix and variableSuffix must both be provided or both be omitted',
  })
  variablePrefix?: string | null;

  @IsString()
  @MaxLength(10)
  @IsOptional()
  @BothOrNeither('variablePrefix', {
    message: 'variablePrefix and variableSuffix must both be provided or both be omitted',
  })
  variableSuffix?: string | null;

  @IsBoolean()
  @IsOptional()
  aiEnabled?: boolean;

  @IsString()
  @IsOptional()
  aiProviderKey?: string | null;

  @IsString()
  @IsOptional()
  aiModel?: string | null;

  @IsString()
  @IsOptional()
  aiPrompt?: string | null;
}
