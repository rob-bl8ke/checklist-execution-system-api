import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReminderDefinition } from './reminder-definition.entity';
import { ReminderOccurrenceState } from './reminder-occurrence-state.entity';
import { Template } from '../template/template.entity';
import { TemplateStep } from '../template-step/template-step.entity';
import { ReminderModule } from './reminder.module';
import { ReminderCadence } from './enums/reminder-cadence.enum';

describe('RemindersController (integration)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [
            ReminderDefinition,
            ReminderOccurrenceState,
            Template,
            TemplateStep,
          ],
          synchronize: true,
        }),
        ReminderModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await dataSource.query('DELETE FROM reminder_occurrence_state');
    await dataSource.query('DELETE FROM reminder_definition');
    await dataSource.query('DELETE FROM template_step');
    await dataSource.query('DELETE FROM template');
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const dailyBody = {
    title: 'Daily Standup Prep',
    cadence: ReminderCadence.DAILY,
    anchorDate: '2026-04-01',
    interval: 1,
  };

  const weeklyBody = {
    title: 'Weekly Retro',
    cadence: ReminderCadence.WEEKLY,
    anchorDate: '2026-04-03',
    weekdays: [5],
    interval: 1,
    leadTimeDays: 2,
  };

  async function createReminder(body = dailyBody) {
    const res = await request(app.getHttpServer())
      .post('/api/reminders')
      .send(body);
    return res.body as { id: number };
  }

  async function createTemplate(name = 'Test Template') {
    const repo = dataSource.getRepository(Template);
    return repo.save(repo.create({ name }));
  }

  // ---------------------------------------------------------------------------
  // GET /reminders
  // ---------------------------------------------------------------------------

  describe('GET /api/reminders', () => {
    it('returns empty array when no reminders', async () => {
      const res = await request(app.getHttpServer()).get('/api/reminders');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns created reminders', async () => {
      await createReminder();
      const res = await request(app.getHttpServer()).get('/api/reminders');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Daily Standup Prep');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /reminders/agenda
  // ---------------------------------------------------------------------------

  describe('GET /api/reminders/agenda', () => {
    it('returns 400 when from is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/reminders/agenda?to=2026-04-10',
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when to is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/reminders/agenda?from=2026-04-01',
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when from > to', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/reminders/agenda?from=2026-04-10&to=2026-04-01',
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when window exceeds 90 days', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/reminders/agenda?from=2026-01-01&to=2026-05-01',
      );
      expect(res.status).toBe(400);
    });

    it('returns occurrences for a valid window', async () => {
      await createReminder();
      const res = await request(app.getHttpServer()).get(
        '/api/reminders/agenda?from=2026-04-01&to=2026-04-05',
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /reminders/:id
  // ---------------------------------------------------------------------------

  describe('GET /api/reminders/:id', () => {
    it('returns a reminder by id', async () => {
      const { id } = await createReminder();
      const res = await request(app.getHttpServer()).get(
        `/api/reminders/${id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/reminders/9999',
      );
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /reminders
  // ---------------------------------------------------------------------------

  describe('POST /api/reminders', () => {
    it('creates a reminder and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reminders')
        .send(dailyBody);
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Daily Standup Prep');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reminders')
        .send({ title: 'No cadence' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when linkedTemplateId does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reminders')
        .send({ ...dailyBody, linkedTemplateId: 9999 });
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /reminders/:id
  // ---------------------------------------------------------------------------

  describe('PUT /api/reminders/:id', () => {
    it('updates a reminder', async () => {
      const { id } = await createReminder();
      const res = await request(app.getHttpServer())
        .put(`/api/reminders/${id}`)
        .send({ title: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/reminders/9999')
        .send({ title: 'X' });
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /reminders/:id
  // ---------------------------------------------------------------------------

  describe('DELETE /api/reminders/:id', () => {
    it('deletes a reminder and returns 204', async () => {
      const { id } = await createReminder();
      const res = await request(app.getHttpServer()).delete(
        `/api/reminders/${id}`,
      );
      expect(res.status).toBe(204);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/api/reminders/9999',
      );
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /reminders/:id/occurrences/:occurrenceDate
  // ---------------------------------------------------------------------------

  describe('PATCH /api/reminders/:id/occurrences/:date', () => {
    it('marks occurrence as COMPLETED', async () => {
      const { id } = await createReminder();
      const res = await request(app.getHttpServer())
        .patch(`/api/reminders/${id}/occurrences/2026-04-01`)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('returns 400 for non-occurrence date', async () => {
      // interval=2, anchor=04-01 → 04-02 is not a valid occurrence
      const created = await request(app.getHttpServer())
        .post('/api/reminders')
        .send({ ...dailyBody, interval: 2 });
      const res = await request(app.getHttpServer())
        .patch(`/api/reminders/${created.body.id}/occurrences/2026-04-02`)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown reminder id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/reminders/9999/occurrences/2026-04-01')
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid status value', async () => {
      const { id } = await createReminder();
      const res = await request(app.getHttpServer())
        .patch(`/api/reminders/${id}/occurrences/2026-04-01`)
        .send({ status: 'INVALID' });
      expect(res.status).toBe(400);
    });
  });
});
