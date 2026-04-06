import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NoteVersion } from './note-version.entity';
import { NoteTag } from './note-tag.entity';

@Entity('note')
export class Note {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'variable_prefix', type: 'text', nullable: true })
  variablePrefix: string | null;

  @Column({ name: 'variable_suffix', type: 'text', nullable: true })
  variableSuffix: string | null;

  @Column({ name: 'ai_enabled', type: 'boolean', default: false })
  aiEnabled: boolean;

  @Column({ name: 'ai_provider_key', type: 'text', nullable: true })
  aiProviderKey: string | null;

  @Column({ name: 'ai_model', type: 'text', nullable: true })
  aiModel: string | null;

  @Column({ name: 'ai_prompt', type: 'text', nullable: true })
  aiPrompt: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date;

  @OneToMany(() => NoteVersion, (version) => version.note, { cascade: true })
  versions: NoteVersion[];

  @OneToMany(() => NoteTag, (tag) => tag.note, { cascade: true })
  tags: NoteTag[];
}
