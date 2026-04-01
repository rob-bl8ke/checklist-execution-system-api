import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReminderDefinition } from './reminder-definition.entity';
import { ReminderOccurrenceState } from './reminder-occurrence-state.entity';
import { Template } from '../template/template.entity';
import { TemplateStep } from '../template-step/template-step.entity';
import { ReminderModule } from './reminder.module';
import { RemindersService } from './reminders.service';
import { ReminderCadence } from './enums/reminder-cadence.enum';

describe('RemindersService (integration)', () => {
  let service: RemindersService;
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

    service = module.get<RemindersService>(RemindersService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(() => module.close());

  beforeEach(async () => {
    await dataSource.query('DELETE FROM reminder_occurrence_state');
    await dataSource.query('DELETE FROM reminder_definition');
    await dataSource.query('DELETE FROM template_step');
    await dataSource.query('DELETE FROM template');
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function createTemplate(name = 'Test Template') {
    const repo = dataSource.getRepository(Template);
    return repo.save(repo.create({ name }));
  }

  const dailyDto = {
    title: 'Daily Standup',
    cadence: ReminderCadence.DAILY,
    anchorDate: '2026-04-01',
    interval: 1,
    leadTimeDays: 0,
  };

  const weeklyDto = {
    title: 'Weekly Retro',
    cadence: ReminderCadence.WEEKLY,
    anchorDate: '2026-04-03',
    weekdays: [5],
    interval: 1,
    leadTimeDays: 2,
  };

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a reminder and returns derived fields', async () => {
      const result = await service.create(dailyDto);
      expect(result.id).toBeDefined();
      expect(result.title).toBe('Daily Standup');
      expect(result.cadence).toBe(ReminderCadence.DAILY);
      expect(result.nextOccurrenceDate).not.toBeNull();
    });

    it('throws BadRequestException when linkedTemplateId does not exist', async () => {
      await expect(
        service.create({ ...dailyDto, linkedTemplateId: 9999 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates reminder with valid linkedTemplateId', async () => {
      const template = await createTemplate();
      const result = await service.create({
        ...weeklyDto,
        linkedTemplateId: template.id,
      });
      expect(result.linkedTemplateId).toBe(template.id);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns all reminders with derived fields', async () => {
      await service.create(dailyDto);
      await service.create(weeklyDto);
      const results = await service.findAll();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('nextOccurrenceDate');
      expect(results[0]).toHaveProperty('nextPrepStartDate');
      expect(results[0]).toHaveProperty('lastCompletedOccurrenceDate');
    });

    it('filters by active=true', async () => {
      const r1 = await service.create(dailyDto);
      await service.update(r1.id, { active: false });
      await service.create(weeklyDto);
      const results = await service.findAll({ active: true });
      expect(results.every((r) => r.active)).toBe(true);
    });

    it('filters by active=false', async () => {
      const r1 = await service.create(dailyDto);
      await service.update(r1.id, { active: false });
      const results = await service.findAll({ active: false });
      expect(results).toHaveLength(1);
      expect(results[0].active).toBe(false);
    });

    it('filters by category', async () => {
      await service.create({ ...dailyDto, category: 'STANDUP' });
      await service.create({ ...weeklyDto, category: 'RETRO' });
      const results = await service.findAll({ category: 'STANDUP' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Daily Standup');
    });

    it('filters by linkedTemplateId', async () => {
      const template = await createTemplate();
      await service.create({ ...dailyDto, linkedTemplateId: template.id });
      await service.create(weeklyDto);
      const results = await service.findAll({
        linkedTemplateId: template.id,
      });
      expect(results).toHaveLength(1);
      expect(results[0].linkedTemplateId).toBe(template.id);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('returns a single reminder with derived fields', async () => {
      const created = await service.create(dailyDto);
      const found = await service.findOne(created.id);
      expect(found.id).toBe(created.id);
      expect(found).toHaveProperty('nextOccurrenceDate');
    });

    it('throws NotFoundException for missing reminder', async () => {
      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates a reminder and returns updated state', async () => {
      const created = await service.create(dailyDto);
      const updated = await service.update(created.id, {
        title: 'Updated Title',
      });
      expect(updated.title).toBe('Updated Title');
    });

    it('throws NotFoundException for missing reminder', async () => {
      await expect(
        service.update(9999, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('removes a reminder', async () => {
      const created = await service.create(dailyDto);
      await service.remove(created.id);
      await expect(service.findOne(created.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for missing reminder', async () => {
      await expect(service.remove(9999)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getAgenda
  // ---------------------------------------------------------------------------

  describe('getAgenda', () => {
    it('returns occurrences in the window with derived fields', async () => {
      await service.create({
        ...dailyDto,
        anchorDate: '2026-04-01',
        leadTimeDays: 1,
      });
      const items = await service.getAgenda('2026-04-01', '2026-04-03');
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveProperty('isInPrepWindow');
      expect(items[0]).toHaveProperty('isOverdue');
      expect(items[0]).toHaveProperty('daysUntilOccurrence');
    });

    it('returns empty when no active reminders', async () => {
      const r = await service.create(dailyDto);
      await service.update(r.id, { active: false });
      const items = await service.getAgenda('2026-04-01', '2026-04-05');
      expect(items).toEqual([]);
    });

    it('marks canStartRun true when linkedTemplateId is set', async () => {
      const template = await createTemplate();
      await service.create({
        ...dailyDto,
        linkedTemplateId: template.id,
        anchorDate: '2026-04-01',
      });
      const items = await service.getAgenda('2026-04-01', '2026-04-01');
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].canStartRun).toBe(true);
    });

    it('marks canStartRun false when no linkedTemplateId', async () => {
      await service.create({ ...dailyDto, anchorDate: '2026-04-01' });
      const items = await service.getAgenda('2026-04-01', '2026-04-01');
      expect(items[0].canStartRun).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // updateOccurrenceState
  // ---------------------------------------------------------------------------

  describe('updateOccurrenceState', () => {
    it('upserts COMPLETED state for a valid occurrence date', async () => {
      const created = await service.create({
        ...dailyDto,
        anchorDate: '2026-04-01',
      });
      const result = await service.updateOccurrenceState(
        created.id,
        '2026-04-01',
        { status: 'COMPLETED' },
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('is idempotent for repeated COMPLETED', async () => {
      const created = await service.create({
        ...dailyDto,
        anchorDate: '2026-04-01',
      });
      await service.updateOccurrenceState(created.id, '2026-04-01', {
        status: 'COMPLETED',
      });
      const result = await service.updateOccurrenceState(
        created.id,
        '2026-04-01',
        { status: 'COMPLETED' },
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('throws BadRequestException for non-occurrence date', async () => {
      const created = await service.create({
        ...dailyDto,
        anchorDate: '2026-04-01',
        interval: 2,
      });
      // '2026-04-02' should not be a valid occurrence for interval=2 starting 04-01
      await expect(
        service.updateOccurrenceState(created.id, '2026-04-02', {
          status: 'COMPLETED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('OPEN deletes the state row, restoring OPEN state', async () => {
      const created = await service.create({
        ...dailyDto,
        anchorDate: '2026-04-01',
      });
      await service.updateOccurrenceState(created.id, '2026-04-01', {
        status: 'COMPLETED',
      });
      const result = await service.updateOccurrenceState(
        created.id,
        '2026-04-01',
        { status: 'OPEN' },
      );
      expect(result.status).toBe('OPEN');
    });
  });
});
