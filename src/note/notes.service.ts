import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Note } from './note.entity';
import { NoteTag } from './note-tag.entity';
import { NoteVersion } from './note-version.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { CreateNoteVersionDto } from './dto/create-note-version.dto';
import { evaluate } from '../instance/transform-pipeline';
import { escapeRegex } from '../common/escape-regex';

export type TagMode = 'any' | 'all';

function normalizeTags(tags: string[]): string[] {
  return tags.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 0);
}

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    @InjectRepository(NoteTag)
    private readonly noteTagRepo: Repository<NoteTag>,
    @InjectRepository(NoteVersion)
    private readonly noteVersionRepo: Repository<NoteVersion>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    tags?: string[],
    tagMode: TagMode = 'any',
  ): Promise<{ items: Note[]; total: number }> {
    const qb = this.noteRepo
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.tags', 'tag')
      .orderBy('note.createdAt', 'DESC');

    if (search) {
      qb.andWhere('(note.title LIKE :search OR note.body LIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (tags && tags.length > 0) {
      const normalized = normalizeTags(tags);
      if (tagMode === 'all') {
        qb.andWhere(
          `note.id IN (
            SELECT note_id FROM note_tag
            WHERE tag IN (:...tagList)
            GROUP BY note_id
            HAVING COUNT(DISTINCT tag) = :tagCount
          )`,
          { tagList: normalized, tagCount: normalized.length },
        );
      } else {
        qb.andWhere(
          `note.id IN (SELECT note_id FROM note_tag WHERE tag IN (:...tagList))`,
          { tagList: normalized },
        );
      }
    }

    const offset = (page - 1) * limit;
    qb.skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: number): Promise<Note> {
    const note = await this.noteRepo.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!note) {
      throw new NotFoundException(`Note with id ${id} not found`);
    }
    return note;
  }

  async create(dto: CreateNoteDto): Promise<Note> {
    const note = this.noteRepo.create({
      title: dto.title,
      body: dto.body ?? null,
      variablePrefix: dto.variablePrefix ?? null,
      variableSuffix: dto.variableSuffix ?? null,
      aiEnabled: dto.aiEnabled ?? false,
      aiProviderKey: dto.aiProviderKey ?? null,
      aiModel: dto.aiModel ?? null,
      aiPrompt: dto.aiPrompt ?? null,
    });
    const saved = await this.noteRepo.save(note);

    if (dto.tags && dto.tags.length > 0) {
      const tagEntities = normalizeTags(dto.tags).map((tag) =>
        this.noteTagRepo.create({ noteId: saved.id, tag }),
      );
      await this.noteTagRepo.save(tagEntities);
    }

    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateNoteDto): Promise<Note> {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Note with id ${id} not found`);
    }

    if (dto.title !== undefined) note.title = dto.title;
    if (dto.body !== undefined) note.body = dto.body ?? null;
    if (dto.variablePrefix !== undefined) note.variablePrefix = dto.variablePrefix ?? null;
    if (dto.variableSuffix !== undefined) note.variableSuffix = dto.variableSuffix ?? null;
    if (dto.aiEnabled !== undefined) note.aiEnabled = dto.aiEnabled;
    if (dto.aiProviderKey !== undefined) note.aiProviderKey = dto.aiProviderKey ?? null;
    if (dto.aiModel !== undefined) note.aiModel = dto.aiModel ?? null;
    if (dto.aiPrompt !== undefined) note.aiPrompt = dto.aiPrompt ?? null;

    await this.noteRepo.save(note);

    if (dto.tags !== undefined) {
      await this.noteTagRepo.delete({ noteId: id });
      if (dto.tags.length > 0) {
        const tagEntities = normalizeTags(dto.tags).map((tag) =>
          this.noteTagRepo.create({ noteId: id, tag }),
        );
        await this.noteTagRepo.save(tagEntities);
      }
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Note with id ${id} not found`);
    }
    await this.noteRepo.remove(note);
  }

  async findAllTags(): Promise<string[]> {
    const rows = await this.noteTagRepo
      .createQueryBuilder('nt')
      .select('DISTINCT nt.tag', 'tag')
      .orderBy('nt.tag', 'ASC')
      .getRawMany<{ tag: string }>();
    return rows.map((r) => r.tag);
  }

  // ---------------------------------------------------------------------------
  // Versioning
  // ---------------------------------------------------------------------------

  async listVersions(noteId: number): Promise<NoteVersion[]> {
    const note = await this.noteRepo.findOne({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException(`Note with id ${noteId} not found`);
    }
    return this.noteVersionRepo.find({
      where: { noteId },
      order: { versionNumber: 'DESC' },
    });
  }

  async createVersion(
    noteId: number,
    dto?: CreateNoteVersionDto,
  ): Promise<NoteVersion> {
    const note = await this.noteRepo.findOne({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException(`Note with id ${noteId} not found`);
    }

    const maxResult = await this.noteVersionRepo
      .createQueryBuilder('nv')
      .select('MAX(nv.version_number)', 'max')
      .where('nv.note_id = :noteId', { noteId })
      .getRawOne<{ max: number | null }>();

    const nextNumber = (maxResult?.max ?? 0) + 1;

    const version = this.noteVersionRepo.create({
      noteId,
      title: note.title,
      body: note.body,
      versionNumber: nextNumber,
    });

    void dto; // label captured for future use; not stored in current schema
    return this.noteVersionRepo.save(version);
  }

  async restoreVersion(noteId: number, versionId: number): Promise<Note> {
    return this.dataSource.transaction(async (manager) => {
      const noteRepo = manager.getRepository(Note);
      const versionRepo = manager.getRepository(NoteVersion);

      const note = await noteRepo.findOne({ where: { id: noteId } });
      if (!note) {
        throw new NotFoundException(`Note with id ${noteId} not found`);
      }

      const target = await versionRepo.findOne({
        where: { id: versionId, noteId },
      });
      if (!target) {
        throw new NotFoundException(
          `Version with id ${versionId} not found for note ${noteId}`,
        );
      }

      // Auto-snapshot current state before overwriting
      const maxResult = await versionRepo
        .createQueryBuilder('nv')
        .select('MAX(nv.version_number)', 'max')
        .where('nv.note_id = :noteId', { noteId })
        .getRawOne<{ max: number | null }>();
      const nextNumber = (maxResult?.max ?? 0) + 1;
      const snapshot = versionRepo.create({
        noteId,
        title: note.title,
        body: note.body,
        versionNumber: nextNumber,
      });
      await versionRepo.save(snapshot);

      // Copy target version's title + body to note
      note.title = target.title;
      note.body = target.body;
      note.updatedAt = new Date();
      await noteRepo.save(note);

      return noteRepo.findOne({
        where: { id: noteId },
        relations: ['tags'],
      }) as Promise<Note>;
    });
  }

  // ---------------------------------------------------------------------------
  // Variable generation (ephemeral)
  // ---------------------------------------------------------------------------

  async generate(
    noteId: number,
    variables: Record<string, string>,
  ): Promise<string> {
    const note = await this.noteRepo.findOne({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException(`Note with id ${noteId} not found`);
    }

    const body = note.body ?? '';
    const prefix = note.variablePrefix ?? '{{';
    const suffix = note.variableSuffix ?? '}}';

    const regex = new RegExp(
      escapeRegex(prefix) + '(.*?)' + escapeRegex(suffix),
      'g',
    );

    return body.replace(
      regex,
      (original, capturedContent: string) =>
        evaluate(capturedContent, variables) ?? original,
    );
  }
}
