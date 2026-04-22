import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiSession } from './ai-session.entity';

/** Valid role values for an AI message. */
export type AiMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

@Entity('ai_message')
export class AiMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id', type: 'integer' })
  sessionId: number;

  @ManyToOne(() => AiSession, (session) => session.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: AiSession;

  /** `USER`, `ASSISTANT`, or `SYSTEM`. */
  @Column({ type: 'text' })
  role: AiMessageRole;

  @Column({ type: 'text' })
  content: string;

  /**
   * Set when this message was triggered by a preset action
   * (e.g. `improve-note`, `review-code`, `fix-markdown`, `suggest-tags`).
   */
  @Column({ name: 'preset_action_key', type: 'text', nullable: true })
  presetActionKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
