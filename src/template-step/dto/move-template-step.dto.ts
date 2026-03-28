import { IsInt, IsOptional } from 'class-validator';

export class MoveTemplateStepDto {
  /** Id of the step immediately before the new position. Null = move to first. */
  @IsInt()
  @IsOptional()
  beforeStepId?: number | null;

  /** Id of the step immediately after the new position. Null = move to last. */
  @IsInt()
  @IsOptional()
  afterStepId?: number | null;
}
