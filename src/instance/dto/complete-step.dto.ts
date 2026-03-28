import { IsBoolean } from 'class-validator';

export class CompleteStepDto {
  @IsBoolean()
  completed: boolean;
}
