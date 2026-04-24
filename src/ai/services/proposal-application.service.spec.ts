import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { ProposalApplicationService } from './proposal-application.service';
import { AiProposal } from '../entities/ai-proposal.entity';
import { Note } from '../../note/note.entity';
import { NoteVersion } from '../../note/note-version.entity';

// ---------------------------------------------------------------------------
// Helpers / factories
// ---------------------------------------------------------------------------

function makeProposal(overrides: Partial<AiProposal> = {}): AiProposal {
  return {
    id: 1,
    sessionId: 10,
    session: null as any,
    targetType: 'NOTE',
    targetId: 5,
    proposalType: 'REPLACE_BODY',
    fieldName: 'body',
    currentValue: 'original body',
    proposedValue: 'improved body',
    rationale: 'Better clarity',
    status: 'PENDING',
    confidence: 0.9,
    createdAt: new Date('2026-04-24T00:00:00.000Z'),
    appliedAt: null,
    revertedAt: null,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 5,
    title: 'Test Note',
    body: 'original body',
    variablePrefix: null,
    variableSuffix: null,
    aiEnabled: false,
    aiProviderKey: null,
    aiModel: null,
    aiPrompt: null,
    createdAt: new Date('2026-04-24T00:00:00.000Z'),
    updatedAt: new Date('2026-04-24T00:00:00.000Z'),
    versions: [],
    tags: [],
    ...overrides,
  };
}

function makeNoteVersion(overrides: Partial<NoteVersion> = {}): NoteVersion {
  return {
    id: 1,
    noteId: 5,
    note: null as any,
    title: 'Test Note',
    body: 'original body',
    versionNumber: 1,
    createdAt: new Date('2026-04-24T00:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Repository mocks
// ---------------------------------------------------------------------------

function makeQueryBuilder(maxResult: { max: number | null }): jest.Mocked<SelectQueryBuilder<NoteVersion>> {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(maxResult),
  } as unknown as jest.Mocked<SelectQueryBuilder<NoteVersion>>;
}

describe('ProposalApplicationService', () => {
  let service: ProposalApplicationService;
  let proposalRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let noteRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let noteVersionRepo: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    proposalRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    noteRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    noteVersionRepo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalApplicationService,
        { provide: getRepositoryToken(AiProposal), useValue: proposalRepo },
        { provide: getRepositoryToken(Note), useValue: noteRepo },
        { provide: getRepositoryToken(NoteVersion), useValue: noteVersionRepo },
      ],
    }).compile();

    service = module.get<ProposalApplicationService>(ProposalApplicationService);
  });

  // -------------------------------------------------------------------------
  // applyProposal
  // -------------------------------------------------------------------------

  describe('applyProposal', () => {
    it('applies a PENDING proposal: updates note body, sets status to APPLIED, creates version snapshot', async () => {
      const proposal = makeProposal();
      const note = makeNote();
      const savedVersion = makeNoteVersion({ id: 42, versionNumber: 1 });
      const savedProposal = { ...proposal, status: 'APPLIED', appliedAt: new Date('2026-04-24T12:00:00.000Z') };

      proposalRepo.findOne.mockResolvedValue(proposal);
      noteRepo.findOne.mockResolvedValue(note);

      const qb = makeQueryBuilder({ max: null });
      noteVersionRepo.createQueryBuilder.mockReturnValue(qb);
      noteVersionRepo.create.mockReturnValue(savedVersion);
      noteVersionRepo.save.mockResolvedValue(savedVersion);

      noteRepo.save.mockResolvedValue({ ...note, body: 'improved body' });
      proposalRepo.save.mockResolvedValue(savedProposal);

      const result = await service.applyProposal(1);

      expect(noteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'improved body' }),
      );
      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPLIED' }),
      );
      expect(noteVersionRepo.save).toHaveBeenCalled();
      expect(result.proposal.status).toBe('APPLIED');
      expect(result.target).toEqual({ targetType: 'NOTE', targetId: 5 });
      expect(result.noteVersion).toBeDefined();
      expect(result.noteVersion!.versionNumber).toBe(1);
    });

    it('increments version_number from existing max', async () => {
      const proposal = makeProposal();
      const note = makeNote();
      const savedVersion = makeNoteVersion({ id: 10, versionNumber: 4 });
      const savedProposal = { ...proposal, status: 'APPLIED', appliedAt: new Date() };

      proposalRepo.findOne.mockResolvedValue(proposal);
      noteRepo.findOne.mockResolvedValue(note);

      const qb = makeQueryBuilder({ max: 3 });
      noteVersionRepo.createQueryBuilder.mockReturnValue(qb);
      noteVersionRepo.create.mockReturnValue(savedVersion);
      noteVersionRepo.save.mockResolvedValue(savedVersion);
      noteRepo.save.mockResolvedValue(note);
      proposalRepo.save.mockResolvedValue(savedProposal);

      const result = await service.applyProposal(1);

      expect(noteVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ versionNumber: 4 }),
      );
      expect(result.noteVersion!.versionNumber).toBe(4);
    });

    it('throws 404 when proposal is not found', async () => {
      proposalRepo.findOne.mockResolvedValue(null);
      await expect(service.applyProposal(999)).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when proposal status is APPLIED (already applied)', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal({ status: 'APPLIED' }));
      await expect(service.applyProposal(1)).rejects.toThrow(ConflictException);
    });

    it('throws 409 when proposal status is REJECTED', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal({ status: 'REJECTED' }));
      await expect(service.applyProposal(1)).rejects.toThrow(ConflictException);
    });

    it('throws 409 when proposal status is REVERTED', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal({ status: 'REVERTED' }));
      await expect(service.applyProposal(1)).rejects.toThrow(ConflictException);
    });

    it('throws 409 (stale proposal) when note body differs from currentValue', async () => {
      const proposal = makeProposal({ currentValue: 'original body' });
      const note = makeNote({ body: 'body has been manually edited' });

      proposalRepo.findOne.mockResolvedValue(proposal);
      noteRepo.findOne.mockResolvedValue(note);

      await expect(service.applyProposal(1)).rejects.toThrow(ConflictException);
      await expect(service.applyProposal(1)).rejects.toThrow(/stale/i);
    });

    it('throws 404 when note referenced by proposal is not found', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal());
      noteRepo.findOne.mockResolvedValue(null);
      await expect(service.applyProposal(1)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // revertProposal
  // -------------------------------------------------------------------------

  describe('revertProposal', () => {
    it('reverts an APPLIED proposal: restores note body, sets status to REVERTED, creates version snapshot', async () => {
      const proposal = makeProposal({
        status: 'APPLIED',
        appliedAt: new Date('2026-04-24T10:00:00.000Z'),
        currentValue: 'original body',
        proposedValue: 'improved body',
      });
      const note = makeNote({ body: 'improved body' });
      const savedVersion = makeNoteVersion({ id: 7, versionNumber: 2 });
      const savedProposal = { ...proposal, status: 'REVERTED', revertedAt: new Date('2026-04-24T12:00:00.000Z') };

      proposalRepo.findOne.mockResolvedValue(proposal);
      noteRepo.findOne.mockResolvedValue(note);

      const qb = makeQueryBuilder({ max: 1 });
      noteVersionRepo.createQueryBuilder.mockReturnValue(qb);
      noteVersionRepo.create.mockReturnValue(savedVersion);
      noteVersionRepo.save.mockResolvedValue(savedVersion);

      noteRepo.save.mockResolvedValue({ ...note, body: 'original body' });
      proposalRepo.save.mockResolvedValue(savedProposal);

      const result = await service.revertProposal(1);

      expect(noteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'original body' }),
      );
      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'REVERTED' }),
      );
      expect(noteVersionRepo.save).toHaveBeenCalled();
      expect(result.proposal.status).toBe('REVERTED');
      expect(result.target).toEqual({ targetType: 'NOTE', targetId: 5 });
      expect(result.noteVersion).toBeDefined();
    });

    it('throws 404 when proposal is not found', async () => {
      proposalRepo.findOne.mockResolvedValue(null);
      await expect(service.revertProposal(999)).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when proposal status is PENDING (not yet applied)', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal({ status: 'PENDING' }));
      await expect(service.revertProposal(1)).rejects.toThrow(ConflictException);
    });

    it('throws 409 when proposal status is REJECTED', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal({ status: 'REJECTED' }));
      await expect(service.revertProposal(1)).rejects.toThrow(ConflictException);
    });

    it('throws 409 when proposal status is REVERTED (already reverted)', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal({ status: 'REVERTED' }));
      await expect(service.revertProposal(1)).rejects.toThrow(ConflictException);
    });

    it('throws 404 when note referenced by proposal is not found', async () => {
      proposalRepo.findOne.mockResolvedValue(makeProposal({ status: 'APPLIED' }));
      noteRepo.findOne.mockResolvedValue(null);
      await expect(service.revertProposal(1)).rejects.toThrow(NotFoundException);
    });
  });
});
