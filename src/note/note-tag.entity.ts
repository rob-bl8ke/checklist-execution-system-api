import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Note } from './note.entity';

@Entity('note_tag')
export class NoteTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'note_id', type: 'integer' })
  noteId: number;

  @ManyToOne(() => Note, (note) => note.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note;

  @Column({ type: 'text' })
  tag: string;
}
