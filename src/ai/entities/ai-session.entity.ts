import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AiMessage } from './ai-message.entity';
import { AiProposal } from './ai-proposal.entity';

@Entity('ai_session')
export class AiSession {
  @PrimaryGeneratedColumn()
  id: number;

  /** Domain type of the target entity. `NOTE` in v1; extensible for Templates, Todos, Runs. */
  @Column({ name: 'target_type', type: 'text' })
  targetType: string;

  @Column({ name: 'target_id', type: 'integer' })
  targetId: number;

  @Column({ name: 'provider_key', type: 'text' })
  providerKey: string;

  @Column({ type: 'text', nullable: true })
  model: string | null;

  /** Snapshot of the system prompt used when the session was created. */
  @Column({ name: 'system_prompt_snapshot', type: 'text', nullable: true })
  systemPromptSnapshot: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date;

  /**
   * Set when the user clears history. Does NOT delete messages or proposals —
   * those remain for audit purposes.
   */
  @Column({ name: 'cleared_at', type: 'datetime', nullable: true })
  clearedAt: Date | null;

  @OneToMany(() => AiMessage, (message) => message.session, { cascade: true })
  messages: AiMessage[];

  @OneToMany(() => AiProposal, (proposal) => proposal.session, {
    cascade: true,
  })
  proposals: AiProposal[];
}
