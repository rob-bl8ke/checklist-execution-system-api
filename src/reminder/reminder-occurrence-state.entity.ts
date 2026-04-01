import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ReminderOccurrenceStatus } from './enums/reminder-occurrence-status.enum';
import { ReminderDefinition } from './reminder-definition.entity';

@Entity('reminder_occurrence_state')
@Unique(['reminderId', 'occurrenceDate'])
export class ReminderOccurrenceState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reminder_id', type: 'integer' })
  reminderId: number;

  @Column({ name: 'occurrence_date', type: 'text' })
  occurrenceDate: string;

  @Column({ type: 'text' })
  status: ReminderOccurrenceStatus;

  @CreateDateColumn({ name: 'acted_at' })
  actedAt: Date;

  @ManyToOne(() => ReminderDefinition, (def) => def.occurrenceStates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reminder_id' })
  reminder: ReminderDefinition;
}
