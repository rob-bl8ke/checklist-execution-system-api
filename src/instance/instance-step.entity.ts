import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Instance } from './instance.entity';

@Entity('instance_step')
export class InstanceStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'instance_id' })
  instanceId: number;

  @Column({ name: 'step_order' })
  stepOrder: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'instructions_template', type: 'text', nullable: true })
  instructionsTemplate: string | null;

  @Column({ name: 'rendered_instructions', type: 'text', nullable: true })
  renderedInstructions: string | null;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Instance, (instance) => instance.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'instance_id' })
  instance: Instance;
}
