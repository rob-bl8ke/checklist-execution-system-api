import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotesService } from './notes.service';
import { Note } from './note.entity';
import { NoteTag } from './note-tag.entity';
import { NoteVersion } from './note-version.entity';

// ---------------------------------------------------------------------------
// Mock query builder for Note repository
// ---------------------------------------------------------------------------
const mockNoteQb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockNoteRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockNoteQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock query builder for NoteVersion repository
// ---------------------------------------------------------------------------
const mockNoteVersionQb = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getRawOne: jest.fn(),
};

const mockNoteVersionRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockNoteVersionQb),
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock DataSource (for transaction)
// ---------------------------------------------------------------------------
const mockTransactionNoteRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};
const mockTransactionVersionRepo = {
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};
const mockDataSource = {
  transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock query builder for NoteTag repository
// ---------------------------------------------------------------------------
const mockNoteTagQb = {
  select: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const mockNoteTagRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockNoteTagQb),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 1,
    title: 'Test note',
    body: null,
    variablePrefix: null,
    variableSuffix: null,
    aiEnabled: false,
    aiProviderKey: null,
    aiModel: null,
    aiPrompt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    versions: [],
    tags: [],
    ...overrides,
  } as Note;
}

function makeTag(overrides: Partial<NoteTag> = {}): NoteTag {
  return {
    id: 1,
    noteId: 1,
    note: {} as Note,
    tag: 'test',
    ...overrides,
  } as NoteTag;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NotesService', () => {
  let service: NotesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNoteRepo.createQueryBuilder.mockReturnValue(mockNoteQb);
    mockNoteTagRepo.createQueryBuilder.mockReturnValue(mockNoteTagQb);
    mockNoteVersionRepo.createQueryBuilder.mockReturnValue(mockNoteVersionQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: getRepositoryToken(Note), useValue: mockNoteRepo },
        { provide: getRepositoryToken(NoteTag), useValue: mockNoteTagRepo },
        { provide: getRepositoryToken(NoteVersion), useValue: mockNoteVersionRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('returns empty items and zero total when no notes exist', async () => {
      mockNoteQb.getManyAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('returns items and total from the query builder', async () => {
      const notes = [makeNote({ id: 1 }), makeNote({ id: 2 })];
      mockNoteQb.getManyAndCount.mockResolvedValue([notes, 2]);
      const result = await service.findAll(1, 20);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('applies LIKE search on title and body', async () => {
      mockNoteQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, 'hello');
      expect(mockNoteQb.andWhere).toHaveBeenCalledWith(
        '(note.title LIKE :search OR note.body LIKE :search)',
        { search: '%hello%' },
      );
    });

    it('does not call andWhere when search is undefined', async () => {
      mockNoteQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20);
      expect(mockNoteQb.andWhere).not.toHaveBeenCalled();
    });

    it('applies tag IN subquery for tagMode=any (default)', async () => {
      mockNoteQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, undefined, ['js', 'ts']);
      expect(mockNoteQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('note_tag WHERE tag IN'),
        { tagList: ['js', 'ts'] },
      );
    });

    it('applies HAVING COUNT subquery for tagMode=all', async () => {
      mockNoteQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, undefined, ['js', 'ts'], 'all');
      expect(mockNoteQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(DISTINCT tag)'),
        { tagList: ['js', 'ts'], tagCount: 2 },
      );
    });

    it('applies correct offset for page 2', async () => {
      mockNoteQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(2, 10);
      expect(mockNoteQb.skip).toHaveBeenCalledWith(10);
      expect(mockNoteQb.take).toHaveBeenCalledWith(10);
    });

    it('normalizes tags to lowercase when filtering', async () => {
      mockNoteQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, undefined, ['  JS  ', 'TypeScript']);
      expect(mockNoteQb.andWhere).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ tagList: ['js', 'typescript'] }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns the note when found', async () => {
      const note = makeNote({ id: 1, tags: [makeTag()] });
      mockNoteRepo.findOne.mockResolvedValue(note);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
      expect(mockNoteRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['tags'],
      });
    });

    it('throws NotFoundException when note not found', async () => {
      mockNoteRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates a note with title only', async () => {
      const savedNote = makeNote({ id: 1 });
      mockNoteRepo.create.mockReturnValue(savedNote);
      mockNoteRepo.save.mockResolvedValue(savedNote);
      mockNoteRepo.findOne.mockResolvedValue({ ...savedNote, tags: [] });

      const result = await service.create({ title: 'New Note' });
      expect(mockNoteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Note',
          body: null,
          aiEnabled: false,
        }),
      );
      expect(result.id).toBe(1);
    });

    it('normalizes and persists tags on create', async () => {
      const savedNote = makeNote({ id: 1 });
      mockNoteRepo.create.mockReturnValue(savedNote);
      mockNoteRepo.save.mockResolvedValue(savedNote);
      mockNoteTagRepo.create.mockImplementation((v) => v);
      mockNoteTagRepo.save.mockResolvedValue([]);
      mockNoteRepo.findOne.mockResolvedValue({ ...savedNote, tags: [] });

      await service.create({ title: 'Note', tags: ['  JS  ', 'TypeScript'] });

      expect(mockNoteTagRepo.create).toHaveBeenCalledWith({ noteId: 1, tag: 'js' });
      expect(mockNoteTagRepo.create).toHaveBeenCalledWith({ noteId: 1, tag: 'typescript' });
    });

    it('does not save tags when tags array is empty', async () => {
      const savedNote = makeNote({ id: 1 });
      mockNoteRepo.create.mockReturnValue(savedNote);
      mockNoteRepo.save.mockResolvedValue(savedNote);
      mockNoteRepo.findOne.mockResolvedValue({ ...savedNote, tags: [] });

      await service.create({ title: 'Note', tags: [] });
      expect(mockNoteTagRepo.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('throws NotFoundException when note not found', async () => {
      mockNoteRepo.findOne.mockResolvedValue(null);
      await expect(service.update(99, { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates only provided fields', async () => {
      const existing = makeNote({ id: 1, title: 'Old' });
      mockNoteRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, title: 'New', tags: [] });
      mockNoteRepo.save.mockImplementation(async (n: Note) => n);

      const result = await service.update(1, { title: 'New' });
      expect(result.title).toBe('New');
    });

    it('replaces all tags when tags is provided in dto', async () => {
      const existing = makeNote({ id: 1 });
      mockNoteRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, tags: [] });
      mockNoteRepo.save.mockResolvedValue(existing);
      mockNoteTagRepo.delete.mockResolvedValue({ affected: 2 });
      mockNoteTagRepo.create.mockImplementation((v) => v);
      mockNoteTagRepo.save.mockResolvedValue([]);

      await service.update(1, { tags: ['React', '  vue  '] });

      expect(mockNoteTagRepo.delete).toHaveBeenCalledWith({ noteId: 1 });
      expect(mockNoteTagRepo.create).toHaveBeenCalledWith({ noteId: 1, tag: 'react' });
      expect(mockNoteTagRepo.create).toHaveBeenCalledWith({ noteId: 1, tag: 'vue' });
    });

    it('clears all tags when tags is an empty array', async () => {
      const existing = makeNote({ id: 1 });
      mockNoteRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, tags: [] });
      mockNoteRepo.save.mockResolvedValue(existing);
      mockNoteTagRepo.delete.mockResolvedValue({ affected: 1 });

      await service.update(1, { tags: [] });

      expect(mockNoteTagRepo.delete).toHaveBeenCalledWith({ noteId: 1 });
      expect(mockNoteTagRepo.save).not.toHaveBeenCalled();
    });

    it('does not touch tags when tags is absent from dto', async () => {
      const existing = makeNote({ id: 1 });
      mockNoteRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, tags: [] });
      mockNoteRepo.save.mockResolvedValue(existing);

      await service.update(1, { title: 'Updated' });

      expect(mockNoteTagRepo.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('removes the note when it exists', async () => {
      const note = makeNote({ id: 1 });
      mockNoteRepo.findOne.mockResolvedValue(note);
      mockNoteRepo.remove.mockResolvedValue(note);

      await service.remove(1);
      expect(mockNoteRepo.remove).toHaveBeenCalledWith(note);
    });

    it('throws NotFoundException when note not found', async () => {
      mockNoteRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // findAllTags
  // -------------------------------------------------------------------------
  describe('findAllTags', () => {
    it('returns sorted distinct tags', async () => {
      mockNoteTagQb.getRawMany.mockResolvedValue([
        { tag: 'angular' },
        { tag: 'react' },
        { tag: 'vue' },
      ]);
      const result = await service.findAllTags();
      expect(result).toEqual(['angular', 'react', 'vue']);
    });

    it('returns empty array when no tags exist', async () => {
      mockNoteTagQb.getRawMany.mockResolvedValue([]);
      const result = await service.findAllTags();
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // listVersions
  // -------------------------------------------------------------------------
  describe('listVersions', () => {
    it('throws NotFoundException when note not found', async () => {
      mockNoteRepo.findOne.mockResolvedValue(null);
      await expect(service.listVersions(99)).rejects.toThrow(NotFoundException);
    });

    it('returns versions ordered DESC by version_number', async () => {
      mockNoteRepo.findOne.mockResolvedValue(makeNote({ id: 1 }));
      const versions = [
        { id: 2, versionNumber: 2 } as NoteVersion,
        { id: 1, versionNumber: 1 } as NoteVersion,
      ];
      mockNoteVersionRepo.find.mockResolvedValue(versions);
      const result = await service.listVersions(1);
      expect(result).toEqual(versions);
      expect(mockNoteVersionRepo.find).toHaveBeenCalledWith({
        where: { noteId: 1 },
        order: { versionNumber: 'DESC' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // createVersion
  // -------------------------------------------------------------------------
  describe('createVersion', () => {
    it('throws NotFoundException when note not found', async () => {
      mockNoteRepo.findOne.mockResolvedValue(null);
      await expect(service.createVersion(99)).rejects.toThrow(NotFoundException);
    });

    it('creates a version with version_number = max + 1', async () => {
      const note = makeNote({ id: 1, title: 'My Note', body: 'Content' });
      mockNoteRepo.findOne.mockResolvedValue(note);
      mockNoteVersionQb.getRawOne.mockResolvedValue({ max: 2 });
      const newVersion = { id: 3, noteId: 1, title: 'My Note', body: 'Content', versionNumber: 3 } as NoteVersion;
      mockNoteVersionRepo.create.mockReturnValue(newVersion);
      mockNoteVersionRepo.save.mockResolvedValue(newVersion);

      const result = await service.createVersion(1);
      expect(mockNoteVersionRepo.create).toHaveBeenCalledWith({
        noteId: 1,
        title: 'My Note',
        body: 'Content',
        versionNumber: 3,
      });
      expect(result.versionNumber).toBe(3);
    });

    it('uses version_number = 1 when no prior versions exist', async () => {
      const note = makeNote({ id: 1 });
      mockNoteRepo.findOne.mockResolvedValue(note);
      mockNoteVersionQb.getRawOne.mockResolvedValue({ max: null });
      const newVersion = { id: 1, noteId: 1, versionNumber: 1 } as NoteVersion;
      mockNoteVersionRepo.create.mockReturnValue(newVersion);
      mockNoteVersionRepo.save.mockResolvedValue(newVersion);

      const result = await service.createVersion(1);
      expect(result.versionNumber).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // restoreVersion
  // -------------------------------------------------------------------------
  describe('restoreVersion', () => {
    it('throws NotFoundException for unknown note', async () => {
      mockDataSource.transaction.mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Note) return { ...mockTransactionNoteRepo, findOne: jest.fn().mockResolvedValue(null) };
            return mockTransactionVersionRepo;
          },
        };
        return cb(manager);
      });
      await expect(service.restoreVersion(99, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for unknown version', async () => {
      const note = makeNote({ id: 1 });
      mockDataSource.transaction.mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Note) return { ...mockTransactionNoteRepo, findOne: jest.fn().mockResolvedValue(note) };
            return { ...mockTransactionVersionRepo, findOne: jest.fn().mockResolvedValue(null), createQueryBuilder: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getRawOne: jest.fn().mockResolvedValue({ max: 0 }) }) };
          },
        };
        return cb(manager);
      });
      await expect(service.restoreVersion(1, 99)).rejects.toThrow(NotFoundException);
    });

    it('auto-snapshots current state before restoring and returns updated note', async () => {
      const note = makeNote({ id: 1, title: 'Current', body: 'Old body' });
      const targetVersion = { id: 2, noteId: 1, title: 'Past', body: 'Past body', versionNumber: 1 } as NoteVersion;
      const restoredNote = makeNote({ id: 1, title: 'Past', body: 'Past body', tags: [] });

      const mockTxNoteRepo = {
        findOne: jest.fn()
          .mockResolvedValueOnce(note)
          .mockResolvedValueOnce(restoredNote),
        save: jest.fn().mockImplementation(async (n: Note) => n),
      };
      const mockTxVersionQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 1 }),
      };
      const mockTxVersionRepo = {
        findOne: jest.fn().mockResolvedValue(targetVersion),
        createQueryBuilder: jest.fn().mockReturnValue(mockTxVersionQb),
        create: jest.fn().mockImplementation((v) => v),
        save: jest.fn().mockResolvedValue({}),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Note) return mockTxNoteRepo;
            return mockTxVersionRepo;
          },
        };
        return cb(manager);
      });

      const result = await service.restoreVersion(1, 2);

      // Auto-snapshot should have been created
      expect(mockTxVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: 1, versionNumber: 2 }),
      );
      // Note body should have been updated to target version
      expect(mockTxNoteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Past', body: 'Past body' }),
      );
      expect(result.title).toBe('Past');
    });
  });

  // -------------------------------------------------------------------------
  // generate
  // -------------------------------------------------------------------------
  describe('generate', () => {
    it('throws NotFoundException when note not found', async () => {
      mockNoteRepo.findOne.mockResolvedValue(null);
      await expect(service.generate(99, {})).rejects.toThrow(NotFoundException);
    });

    it('renders placeholders using default delimiters', async () => {
      const note = makeNote({ id: 1, body: 'Hello {{name}}!', variablePrefix: null, variableSuffix: null });
      mockNoteRepo.findOne.mockResolvedValue(note);
      const result = await service.generate(1, { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('renders placeholders using custom delimiters', async () => {
      const note = makeNote({ id: 1, body: 'Hi [[greeting]]', variablePrefix: '[[', variableSuffix: ']]' });
      mockNoteRepo.findOne.mockResolvedValue(note);
      const result = await service.generate(1, { greeting: 'there' });
      expect(result).toBe('Hi there');
    });

    it('leaves unknown placeholders intact', async () => {
      const note = makeNote({ id: 1, body: 'Hello {{unknown}}!', variablePrefix: null, variableSuffix: null });
      mockNoteRepo.findOne.mockResolvedValue(note);
      const result = await service.generate(1, {});
      expect(result).toBe('Hello {{unknown}}!');
    });

    it('returns empty string when body is null', async () => {
      const note = makeNote({ id: 1, body: null, variablePrefix: null, variableSuffix: null });
      mockNoteRepo.findOne.mockResolvedValue(note);
      const result = await service.generate(1, {});
      expect(result).toBe('');
    });
  });
});
