import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Note } from './note.entity';

@Entity('note_version')
export class NoteVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'note_id', type: 'integer' })
  noteId: number;

  @ManyToOne(() => Note, (note) => note.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'version_number', type: 'integer' })
  versionNumber: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
