import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiSession } from './ai-session.entity';

/**
 * Proposal status transitions:
 *   PENDING → APPLIED | REJECTED
 *   APPLIED → REVERTED
 */
export type AiProposalStatus = 'PENDING' | 'APPLIED' | 'REJECTED' | 'REVERTED';

@Entity('ai_proposal')
export class AiProposal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id', type: 'integer' })
  sessionId: number;

  @ManyToOne(() => AiSession, (session) => session.proposals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: AiSession;

  /** Domain type of the target entity. `NOTE` in v1. */
  @Column({ name: 'target_type', type: 'text' })
  targetType: string;

  @Column({ name: 'target_id', type: 'integer' })
  targetId: number;

  /** `REPLACE_BODY` in v1. */
  @Column({ name: 'proposal_type', type: 'text' })
  proposalType: string;

  /**
   * The field being replaced. Restricted to `body` in v1 for Notes.
   * Stored as a column so future proposal types can target different fields.
   */
  @Column({ name: 'field_name', type: 'text' })
  fieldName: string;

  /** The current (pre-proposal) value captured at proposal creation time. */
  @Column({ name: 'current_value', type: 'text' })
  currentValue: string;

  /** The proposed replacement value. */
  @Column({ name: 'proposed_value', type: 'text' })
  proposedValue: string;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  /** Proposal lifecycle state. Defaults to `PENDING`. */
  @Column({ type: 'text', default: 'PENDING' })
  status: AiProposalStatus;

  /** Model-reported confidence; normalized to 0–1. Nullable when not reported. */
  @Column({ type: 'real', nullable: true })
  confidence: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Set when the proposal is applied to the note body. */
  @Column({ name: 'applied_at', type: 'datetime', nullable: true })
  appliedAt: Date | null;

  /** Set when the proposal is reverted. */
  @Column({ name: 'reverted_at', type: 'datetime', nullable: true })
  revertedAt: Date | null;
}
