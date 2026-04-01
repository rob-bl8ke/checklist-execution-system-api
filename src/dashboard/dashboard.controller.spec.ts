import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Template } from '../template/template.entity';
import { TemplateStep } from '../template-step/template-step.entity';
import { Instance } from '../instance/instance.entity';
import { InstanceStep } from '../instance/instance-step.entity';
import { Todo } from '../todo/todo.entity';
import { ReminderDefinition } from '../reminder/reminder-definition.entity';
import { ReminderOccurrenceState } from '../reminder/reminder-occurrence-state.entity';
import { TemplatesModule } from '../template/template.module';
import { TemplateStepModule } from '../template-step/template-step.module';
import { InstanceModule } from '../instance/instance.module';
import { TodoModule } from '../todo/todo.module';
import { DashboardModule } from './dashboard.module';
import { ReminderModule } from '../reminder/reminder.module';

describe('Dashboard API (integration)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Template, TemplateStep, Instance, InstanceStep, Todo, ReminderDefinition, ReminderOccurrenceState],
          synchronize: true,
        }),
        TemplatesModule,
        TemplateStepModule,
        InstanceModule,
        TodoModule,
        DashboardModule,
        ReminderModule,
      ],
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
    await dataSource.query('DELETE FROM reminder_occurrence_state');
    await dataSource.query('DELETE FROM reminder_definition');
    await dataSource.query('DELETE FROM instance_step');
    await dataSource.query('DELETE FROM instance');
    await dataSource.query('DELETE FROM template_step');
    await dataSource.query('DELETE FROM template');
    await dataSource.query('DELETE FROM todo');
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function createTemplate(name = 'Template') {
    const res = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name })
      .expect(201);
    return res.body as { id: number };
  }

  async function addStep(templateId: number, title: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/templates/${templateId}/steps`)
      .send({ title })
      .expect(201);
    return res.body as { id: number };
  }

  async function createInstance(templateId: number, name = 'Run 1') {
    const res = await request(app.getHttpServer())
      .post('/api/instances')
      .send({ templateId, name })
      .expect(201);
    return res.body as { id: number; nextStepId: number };
  }

  async function createTodo(title: string) {
    const res = await request(app.getHttpServer())
      .post('/api/todos')
      .send({ title })
      .expect(201);
    return res.body as { id: number };
  }

  // ---------------------------------------------------------------------------
  // GET /api/dashboard
  // ---------------------------------------------------------------------------

  describe('GET /api/dashboard', () => {
    it('returns { runs: [], todos: [] } when nothing is active', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .expect(200);
      expect(res.body).toEqual({ runs: [], todos: [], reminders: { dueNow: [], upcoming: [] } });
    });

    it('returns in-progress run with next step and progress', async () => {
      const tmpl = await createTemplate('T1');
      await addStep(tmpl.id, 'Step One');
      await addStep(tmpl.id, 'Step Two');
      const instance = await createInstance(tmpl.id, 'My Run');

      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .expect(200);

      expect(res.body.runs).toHaveLength(1);
      const run = res.body.runs[0];
      expect(run.id).toBe(instance.id);
      expect(run.name).toBe('My Run');
      expect(run.progress).toEqual({ completed: 0, total: 2 });
      expect(run.nextStep).not.toBeNull();
      expect(run.nextStep.title).toBe('Step One');
    });

    it('returns all incomplete todos ordered by createdAt descending', async () => {
      await dataSource.query(
        `INSERT INTO todo (title, description, completed, created_at, completed_at) VALUES ('Old Todo', NULL, 0, datetime('now', '-10 seconds'), NULL)`,
      );
      await createTodo('New Todo');

      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .expect(200);

      expect(res.body.todos).toHaveLength(2);
      expect(res.body.todos[0].title).toBe('New Todo');
      expect(res.body.todos[1].title).toBe('Old Todo');
    });

    it('excludes completed instances from runs', async () => {
      const tmpl = await createTemplate('T2');
      await addStep(tmpl.id, 'Step A');
      const instance = await createInstance(tmpl.id, 'Completed Run');

      // Mark the instance as COMPLETED
      await request(app.getHttpServer())
        .patch(`/api/instances/${instance.id}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .expect(200);

      expect(res.body.runs).toHaveLength(0);
    });

    it('excludes abandoned instances from runs', async () => {
      const tmpl = await createTemplate('T3');
      await addStep(tmpl.id, 'Step A');
      const instance = await createInstance(tmpl.id, 'Abandoned Run');

      await request(app.getHttpServer())
        .patch(`/api/instances/${instance.id}`)
        .send({ status: 'ABANDONED' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .expect(200);

      expect(res.body.runs).toHaveLength(0);
    });

    it('excludes completed todos from todos array', async () => {
      const todo = await createTodo('Done Todo');
      await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ completed: true })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .expect(200);

      expect(res.body.todos).toHaveLength(0);
    });

    it('returns correct data with mixed completed and active items', async () => {
      // 2 active runs
      const tmpl1 = await createTemplate('Active T1');
      await addStep(tmpl1.id, 'Step X');
      await createInstance(tmpl1.id, 'Active Run 1');

      const tmpl2 = await createTemplate('Completed T');
      await addStep(tmpl2.id, 'Step Y');
      const completedInstance = await createInstance(tmpl2.id, 'Done Run');
      await request(app.getHttpServer())
        .patch(`/api/instances/${completedInstance.id}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      // 3 incomplete todos, 1 complete
      await createTodo('Todo 1');
      await createTodo('Todo 2');
      await createTodo('Todo 3');
      const doneTodo = await createTodo('Done Todo');
      await request(app.getHttpServer())
        .patch(`/api/todos/${doneTodo.id}`)
        .send({ completed: true })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .expect(200);

      expect(res.body.runs).toHaveLength(1);
      expect(res.body.runs[0].name).toBe('Active Run 1');
      expect(res.body.todos).toHaveLength(3);
    });
  });
});
