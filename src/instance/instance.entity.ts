import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InstanceStatus } from './enums/instance-status.enum';
import { InstanceStep } from './instance-step.entity';

@Entity('instance')
export class Instance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id' })
  templateId: number;

  @Column({ type: 'text' })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (v: Record<string, string> | null): string | null =>
        v ? JSON.stringify(v) : null,
      from: (v: string | null): Record<string, string> | null =>
        v ? (JSON.parse(v) as Record<string, string>) : null,
    },
  })
  variables: Record<string, string> | null;

  @Column({ type: 'text', default: InstanceStatus.IN_PROGRESS })
  status: InstanceStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Nullable FK to instance_step.id — set after steps are created. */
  @Column({ name: 'next_step_id', nullable: true, type: 'integer' })
  nextStepId: number | null;

  @OneToMany(() => InstanceStep, (step) => step.instance, { cascade: true })
  steps: InstanceStep[];
}
