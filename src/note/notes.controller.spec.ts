import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Note } from './note.entity';
import { NoteTag } from './note-tag.entity';
import { NoteVersion } from './note-version.entity';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

describe('Notes API (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Note, NoteTag, NoteVersion],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Note, NoteTag, NoteVersion]),
      ],
      controllers: [NotesController],
      providers: [NotesService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    dataSource = moduleRef.get<DataSource>(DataSource);
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await dataSource.query('DELETE FROM note_tag');
    await dataSource.query('DELETE FROM note_version');
    await dataSource.query('DELETE FROM note');
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function createNote(
    body: Partial<{
      title: string;
      body: string;
      tags: string[];
      variablePrefix: string;
      variableSuffix: string;
      aiEnabled: boolean;
    }> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/notes')
      .send(body)
      .expect(201);
    return res.body as Note & { tags: NoteTag[] };
  }

  // ---------------------------------------------------------------------------
  // GET /api/notes
  // ---------------------------------------------------------------------------

  describe('GET /api/notes', () => {
    it('returns empty items and zero total when no notes exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notes')
        .expect(200);
      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('returns notes with pagination metadata', async () => {
      await createNote({ title: 'Note A' });
      await createNote({ title: 'Note B' });
      const res = await request(app.getHttpServer())
        .get('/api/notes')
        .expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);
    });

    it('filters by search term in title', async () => {
      await createNote({ title: 'Angular tips' });
      await createNote({ title: 'React tips' });
      const res = await request(app.getHttpServer())
        .get('/api/notes?search=Angular')
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].title).toBe('Angular tips');
    });

    it('filters by tag with tagMode=any (default)', async () => {
      await createNote({ title: 'JS note', tags: ['js'] });
      await createNote({ title: 'TS note', tags: ['ts'] });
      await createNote({ title: 'Untagged' });
      const res = await request(app.getHttpServer())
        .get('/api/notes?tags=js&tags=ts&tagMode=any')
        .expect(200);
      expect(res.body.total).toBe(2);
    });

    it('filters by tag with tagMode=all (AND logic)', async () => {
      await createNote({ title: 'Both', tags: ['js', 'ts'] });
      await createNote({ title: 'OnlyJS', tags: ['js'] });
      const res = await request(app.getHttpServer())
        .get('/api/notes?tags=js&tags=ts&tagMode=all')
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].title).toBe('Both');
    });

    it('paginates correctly', async () => {
      await createNote({ title: 'Note 1' });
      await createNote({ title: 'Note 2' });
      await createNote({ title: 'Note 3' });
      const res = await request(app.getHttpServer())
        .get('/api/notes?page=2&limit=2')
        .expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/notes/tags
  // ---------------------------------------------------------------------------

  describe('GET /api/notes/tags', () => {
    it('returns empty array when no tags exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notes/tags')
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns sorted distinct tags', async () => {
      await createNote({ title: 'A', tags: ['vue', 'react'] });
      await createNote({ title: 'B', tags: ['angular', 'react'] });
      const res = await request(app.getHttpServer())
        .get('/api/notes/tags')
        .expect(200);
      expect(res.body).toEqual(['angular', 'react', 'vue']);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/notes/:id
  // ---------------------------------------------------------------------------

  describe('GET /api/notes/:id', () => {
    it('returns the note with its tags', async () => {
      const created = await createNote({ title: 'My Note', tags: ['a', 'b'] });
      const res = await request(app.getHttpServer())
        .get(`/api/notes/${created.id}`)
        .expect(200);
      expect(res.body.title).toBe('My Note');
      expect(res.body.tags).toHaveLength(2);
    });

    it('returns 404 for unknown id', async () => {
      await request(app.getHttpServer())
        .get('/api/notes/9999')
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/notes
  // ---------------------------------------------------------------------------

  describe('POST /api/notes', () => {
    it('creates a note with title only and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notes')
        .send({ title: 'Simple note' })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Simple note');
      expect(res.body.aiEnabled).toBe(false);
    });

    it('creates a note with tags normalized to lowercase', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notes')
        .send({ title: 'Tagged', tags: ['  JS  ', 'TypeScript'] })
        .expect(201);
      const tagValues = res.body.tags.map((t: NoteTag) => t.tag);
      expect(tagValues).toContain('js');
      expect(tagValues).toContain('typescript');
    });

    it('returns 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/notes')
        .send({})
        .expect(400);
    });

    it('returns 400 when only variablePrefix is provided (BothOrNeither)', async () => {
      await request(app.getHttpServer())
        .post('/api/notes')
        .send({ title: 'T', variablePrefix: '{{' })
        .expect(400);
    });

    it('returns 400 when only variableSuffix is provided (BothOrNeither)', async () => {
      await request(app.getHttpServer())
        .post('/api/notes')
        .send({ title: 'T', variableSuffix: '}}' })
        .expect(400);
    });

    it('creates a note with both variable delimiters', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notes')
        .send({ title: 'T', variablePrefix: '{{', variableSuffix: '}}' })
        .expect(201);
      expect(res.body.variablePrefix).toBe('{{');
      expect(res.body.variableSuffix).toBe('}}');
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /api/notes/:id
  // ---------------------------------------------------------------------------

  describe('PUT /api/notes/:id', () => {
    it('updates the note title', async () => {
      const created = await createNote({ title: 'Old title' });
      const res = await request(app.getHttpServer())
        .put(`/api/notes/${created.id}`)
        .send({ title: 'New title' })
        .expect(200);
      expect(res.body.title).toBe('New title');
    });

    it('replaces tags on update', async () => {
      const created = await createNote({ title: 'T', tags: ['old'] });
      const res = await request(app.getHttpServer())
        .put(`/api/notes/${created.id}`)
        .send({ tags: ['new1', 'new2'] })
        .expect(200);
      const tagValues = res.body.tags.map((t: NoteTag) => t.tag);
      expect(tagValues).toContain('new1');
      expect(tagValues).toContain('new2');
      expect(tagValues).not.toContain('old');
    });

    it('returns 404 when note does not exist', async () => {
      await request(app.getHttpServer())
        .put('/api/notes/9999')
        .send({ title: 'X' })
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/notes/:id
  // ---------------------------------------------------------------------------

  describe('DELETE /api/notes/:id', () => {
    it('deletes the note and returns 204', async () => {
      const created = await createNote({ title: 'To delete' });
      await request(app.getHttpServer())
        .delete(`/api/notes/${created.id}`)
        .expect(204);
      await request(app.getHttpServer())
        .get(`/api/notes/${created.id}`)
        .expect(404);
    });

    it('returns 404 when note does not exist', async () => {
      await request(app.getHttpServer())
        .delete('/api/notes/9999')
        .expect(404);
    });
  });
});
