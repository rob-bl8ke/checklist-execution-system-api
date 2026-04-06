import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoteVersionDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  label?: string;
}
