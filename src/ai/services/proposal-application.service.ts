import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProposal } from '../entities/ai-proposal.entity';
import { Note } from '../../note/note.entity';
import { NoteVersion } from '../../note/note-version.entity';
import { AiProposalMutationResponse } from '../interfaces/ai-proposal-mutation-response.interface';

@Injectable()
export class ProposalApplicationService {
  constructor(
    @InjectRepository(AiProposal)
    private readonly proposalRepo: Repository<AiProposal>,
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    @InjectRepository(NoteVersion)
    private readonly noteVersionRepo: Repository<NoteVersion>,
  ) {}

  async applyProposal(proposalId: number): Promise<AiProposalMutationResponse> {
    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
    });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'PENDING') {
      throw new ConflictException(
        `Proposal ${proposalId} cannot be applied: status is '${proposal.status}' (must be PENDING)`,
      );
    }

    const note = await this.noteRepo.findOne({
      where: { id: proposal.targetId },
    });
    if (!note) {
      throw new NotFoundException(`Note ${proposal.targetId} not found`);
    }

    // Stale proposal check: note body must still match currentValue
    const currentBody = note.body ?? '';
    if (currentBody !== proposal.currentValue) {
      throw new ConflictException(
        `Proposal ${proposalId} is stale: the note body has been modified since the proposal was created`,
      );
    }

    // Snapshot current state before applying
    const noteVersion = await this.createVersionSnapshot(note);

    // Apply: update note body to proposedValue
    note.body = proposal.proposedValue;
    note.updatedAt = new Date();
    await this.noteRepo.save(note);

    // Update proposal status
    proposal.status = 'APPLIED';
    proposal.appliedAt = new Date();
    await this.proposalRepo.save(proposal);

    return this.buildMutationResponse(proposal, noteVersion);
  }

  async revertProposal(
    proposalId: number,
  ): Promise<AiProposalMutationResponse> {
    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
    });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'APPLIED') {
      throw new ConflictException(
        `Proposal ${proposalId} cannot be reverted: status is '${proposal.status}' (must be APPLIED)`,
      );
    }

    const note = await this.noteRepo.findOne({
      where: { id: proposal.targetId },
    });
    if (!note) {
      throw new NotFoundException(`Note ${proposal.targetId} not found`);
    }

    // Snapshot current (applied) state before reverting
    const noteVersion = await this.createVersionSnapshot(note);

    // Revert: restore note body to currentValue (the value before the proposal was applied)
    note.body = proposal.currentValue;
    note.updatedAt = new Date();
    await this.noteRepo.save(note);

    // Update proposal status
    proposal.status = 'REVERTED';
    proposal.revertedAt = new Date();
    await this.proposalRepo.save(proposal);

    return this.buildMutationResponse(proposal, noteVersion);
  }

  private async createVersionSnapshot(note: Note): Promise<NoteVersion> {
    const maxResult = await this.noteVersionRepo
      .createQueryBuilder('nv')
      .select('MAX(nv.version_number)', 'max')
      .where('nv.note_id = :noteId', { noteId: note.id })
      .getRawOne<{ max: number | null }>();

    const nextNumber = (maxResult?.max ?? 0) + 1;

    const version = this.noteVersionRepo.create({
      noteId: note.id,
      title: note.title,
      body: note.body,
      versionNumber: nextNumber,
    });

    return this.noteVersionRepo.save(version);
  }

  private buildMutationResponse(
    proposal: AiProposal,
    noteVersion: NoteVersion,
  ): AiProposalMutationResponse {
    return {
      proposal: {
        id: proposal.id,
        status: proposal.status,
        appliedAt: proposal.appliedAt?.toISOString() ?? null,
        revertedAt: proposal.revertedAt?.toISOString() ?? null,
      },
      target: {
        targetType: 'NOTE',
        targetId: proposal.targetId,
      },
      noteVersion: {
        id: noteVersion.id,
        versionNumber: noteVersion.versionNumber,
        createdAt: noteVersion.createdAt.toISOString(),
      },
    };
  }
}
