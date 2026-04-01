import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReminderCadence } from './enums/reminder-cadence.enum';
import { ReminderOccurrenceState } from './reminder-occurrence-state.entity';

@Entity('reminder_definition')
export class ReminderDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  category: string | null;

  @Column({ type: 'text' })
  cadence: ReminderCadence;

  @Column({ type: 'integer', default: 1 })
  interval: number;

  @Column({ name: 'anchor_date', type: 'text' })
  anchorDate: string;

  @Column({
    name: 'weekdays',
    type: 'text',
    nullable: true,
    transformer: {
      to: (v: number[] | null): string | null =>
        v ? JSON.stringify(v) : null,
      from: (v: string | null): number[] | null =>
        v ? (JSON.parse(v) as number[]) : null,
    },
  })
  weekdays: number[] | null;

  @Column({ name: 'time_of_day', type: 'text', nullable: true })
  timeOfDay: string | null;

  @Column({ name: 'lead_time_days', type: 'integer', default: 0 })
  leadTimeDays: number;

  @Column({ name: 'linked_template_id', type: 'integer', nullable: true })
  linkedTemplateId: number | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  @OneToMany(() => ReminderOccurrenceState, (state) => state.reminder)
  occurrenceStates: ReminderOccurrenceState[];
}
