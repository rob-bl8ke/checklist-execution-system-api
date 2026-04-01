import { IsIn } from 'class-validator';

export class UpdateReminderOccurrenceDto {
  @IsIn(['COMPLETED', 'DISMISSED', 'OPEN'])
  status: 'COMPLETED' | 'DISMISSED' | 'OPEN';
}
