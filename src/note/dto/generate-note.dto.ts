import { IsObject, IsOptional } from 'class-validator';

export class GenerateNoteDto {
  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;
}
