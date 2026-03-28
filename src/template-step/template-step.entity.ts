import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Template } from '../template/template.entity';

/**
 * Gap ordering: positions are multiples of 100 (100, 200, 300 ...).
 * New steps are appended at lastPosition + 100 (or 100 if none exist).
 * Move uses midpoint: newPos = (before.position + after.position) / 2.
 * Rebalance is triggered when the gap between two neighbours < 1,
 * reassigning all step positions for the template at multiples of 100.
 */
@Entity('template_step')
export class TemplateStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id' })
  templateId: number;

  /** Stored as REAL to support fractional midpoint positions. */
  @Column({ type: 'real' })
  position: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Template, (template) => template.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: Template;
}
