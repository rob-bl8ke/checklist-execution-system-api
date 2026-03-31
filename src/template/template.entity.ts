import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TemplateStep } from '../template-step/template-step.entity';

@Entity('template')
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'variable_prefix', type: 'text', nullable: true })
  variablePrefix: string | null;

  @Column({ name: 'variable_suffix', type: 'text', nullable: true })
  variableSuffix: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date;

  @OneToMany(() => TemplateStep, (step) => step.template, { cascade: true })
  steps: TemplateStep[];
}
