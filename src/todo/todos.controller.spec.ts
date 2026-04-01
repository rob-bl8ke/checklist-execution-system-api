import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Todo } from './todo.entity';
import { TodoModule } from './todo.module';
import { TodoPriority } from './enums/todo-priority.enum';

describe('Todos API (integration)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Todo],
          synchronize: true,
        }),
        TodoModule,
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
    await dataSource.query('DELETE FROM todo');
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function createTodo(body: Partial<{ title: string; description: string; dueDate: string; priority: string }> = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/todos')
      .send(body)
      .expect(201);
    return res.body as Todo;
  }

  // ---------------------------------------------------------------------------
  // GET /api/todos
  // ---------------------------------------------------------------------------

  describe('GET /api/todos', () => {
    it('returns an empty array when no todos exist', async () => {
      const res = await request(app.getHttpServer()).get('/api/todos').expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns incomplete todos before completed todos', async () => {
      await dataSource.query(
        `INSERT INTO todo (title, description, due_date, priority, completed, created_at, completed_at) VALUES ('Completed', NULL, NULL, 'NORMAL', 1, datetime('now', '-10 seconds'), datetime('now', '-5 seconds'))`,
      );
      await createTodo({ title: 'Incomplete' });
      const res = await request(app.getHttpServer()).get('/api/todos').expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Incomplete');
      expect(res.body[1].title).toBe('Completed');
    });

    it('returns dated incomplete todos before undated', async () => {
      await createTodo({ title: 'Undated' });
      await createTodo({ title: 'Dated', dueDate: '2026-05-01' });
      const res = await request(app.getHttpServer()).get('/api/todos').expect(200);
      expect(res.body[0].title).toBe('Dated');
      expect(res.body[1].title).toBe('Undated');
    });

    it('returns todos with dueDate, priority, and description fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'T', dueDate: '2026-04-10', priority: 'HIGH', description: 'Detail' })
        .expect(201);
      const list = await request(app.getHttpServer()).get('/api/todos').expect(200);
      expect(list.body[0].dueDate).toBe('2026-04-10');
      expect(list.body[0].priority).toBe('HIGH');
      expect(list.body[0].description).toBe('Detail');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/todos
  // ---------------------------------------------------------------------------

  describe('POST /api/todos', () => {
    it('creates a todo with title only, defaulting priority to NORMAL', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'Buy milk' })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Buy milk');
      expect(res.body.description).toBeNull();
      expect(res.body.dueDate).toBeNull();
      expect(res.body.priority).toBe(TodoPriority.NORMAL);
      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });

    it('creates a todo with dueDate and priority', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'T', dueDate: '2026-04-15', priority: 'HIGH' })
        .expect(201);
      expect(res.body.dueDate).toBe('2026-04-15');
      expect(res.body.priority).toBe('HIGH');
    });

    it('creates a todo with description', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'T', description: 'Some **markdown**' })
        .expect(201);
      expect(res.body.description).toBe('Some **markdown**');
    });

    it('returns 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/todos')
        .send({ description: 'No title' })
        .expect(400);
    });

    it('returns 400 for invalid priority value', async () => {
      await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'T', priority: 'EXTREME' })
        .expect(400);
    });

    it('returns 400 for invalid dueDate format', async () => {
      await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'T', dueDate: 'not-a-date' })
        .expect(400);
    });

    it('returns 400 when unknown fields are sent', async () => {
      await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'T', unknownField: true })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/todos/:id
  // ---------------------------------------------------------------------------

  describe('PATCH /api/todos/:id', () => {
    it('updates the title', async () => {
      const todo = await createTodo({ title: 'Old title' });
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ title: 'New title' })
        .expect(200);
      expect(res.body.title).toBe('New title');
    });

    it('updates dueDate', async () => {
      const todo = await createTodo({ title: 'T' });
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ dueDate: '2026-05-10' })
        .expect(200);
      expect(res.body.dueDate).toBe('2026-05-10');
    });

    it('clears dueDate when null is sent', async () => {
      const todo = await createTodo({ title: 'T', dueDate: '2026-04-01' });
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ dueDate: null })
        .expect(200);
      expect(res.body.dueDate).toBeNull();
    });

    it('updates priority', async () => {
      const todo = await createTodo({ title: 'T' });
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ priority: 'CRITICAL' })
        .expect(200);
      expect(res.body.priority).toBe('CRITICAL');
    });

    it('clears description when null is sent', async () => {
      const todo = await createTodo({ title: 'T', description: 'old' });
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ description: null })
        .expect(200);
      expect(res.body.description).toBeNull();
    });

    it('sets completedAt when completed is set to true', async () => {
      const todo = await createTodo({ title: 'Task' });
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ completed: true })
        .expect(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.completedAt).not.toBeNull();
    });

    it('clears completedAt when completed is set to false', async () => {
      const todo = await createTodo({ title: 'Task' });
      await request(app.getHttpServer()).patch(`/api/todos/${todo.id}`).send({ completed: true });
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ completed: false })
        .expect(200);
      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });

    it('returns 400 for invalid priority in update', async () => {
      const todo = await createTodo({ title: 'T' });
      await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ priority: 'EXTREME' })
        .expect(400);
    });

    it('returns 400 for invalid dueDate in update', async () => {
      const todo = await createTodo({ title: 'T' });
      await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ dueDate: 'bad-date' })
        .expect(400);
    });

    it('returns 404 when todo does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/todos/9999')
        .send({ title: 'X' })
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/todos/:id
  // ---------------------------------------------------------------------------

  describe('DELETE /api/todos/:id', () => {
    it('returns 204 and removes the todo', async () => {
      const todo = await createTodo({ title: 'To delete' });
      await request(app.getHttpServer()).delete(`/api/todos/${todo.id}`).expect(204);
      const res = await request(app.getHttpServer()).get('/api/todos').expect(200);
      expect(res.body).toHaveLength(0);
    });

    it('returns 404 when todo does not exist', async () => {
      await request(app.getHttpServer()).delete('/api/todos/9999').expect(404);
    });
  });
});

describe('Todos API (integration)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Todo],
          synchronize: true,
        }),
        TodoModule,
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
    await dataSource.query('DELETE FROM todo');
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function createTodo(title: string, description?: string) {
    const res = await request(app.getHttpServer())
      .post('/api/todos')
      .send({ title, ...(description && { description }) })
      .expect(201);
    return res.body as Todo;
  }

  // ---------------------------------------------------------------------------
  // GET /api/todos
  // ---------------------------------------------------------------------------

  describe('GET /api/todos', () => {
    it('returns an empty array when no todos exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/todos')
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns all todos ordered by createdAt descending', async () => {
      // Insert 'First' with an explicit older timestamp so ordering is deterministic
      await dataSource.query(
        `INSERT INTO todo (title, description, completed, created_at, completed_at) VALUES ('First', NULL, 0, datetime('now', '-10 seconds'), NULL)`,
      );
      await createTodo('Second');
      const res = await request(app.getHttpServer())
        .get('/api/todos')
        .expect(200);
      expect(res.body).toHaveLength(2);
      // Most recently created is first
      expect(res.body[0].title).toBe('Second');
      expect(res.body[1].title).toBe('First');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/todos
  // ---------------------------------------------------------------------------

  describe('POST /api/todos', () => {
    it('creates a todo with title only', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'Buy milk' })
        .expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Buy milk');
      expect(res.body.description).toBeNull();
      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });

    it('creates a todo with title and description', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'Buy milk', description: 'Semi-skimmed' })
        .expect(201);
      expect(res.body.description).toBe('Semi-skimmed');
    });

    it('returns 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/todos')
        .send({ description: 'No title' })
        .expect(400);
    });

    it('returns 400 when unknown fields are sent', async () => {
      await request(app.getHttpServer())
        .post('/api/todos')
        .send({ title: 'T', unknownField: true })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/todos/:id
  // ---------------------------------------------------------------------------

  describe('PATCH /api/todos/:id', () => {
    it('updates the title', async () => {
      const todo = await createTodo('Old title');
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ title: 'New title' })
        .expect(200);
      expect(res.body.title).toBe('New title');
    });

    it('sets completedAt when completed is set to true', async () => {
      const todo = await createTodo('Task');
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ completed: true })
        .expect(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.completedAt).not.toBeNull();
    });

    it('clears completedAt when completed is set to false', async () => {
      const todo = await createTodo('Task');
      await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ completed: true })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ completed: false })
        .expect(200);
      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });

    it('applies partial update (title + description)', async () => {
      const todo = await createTodo('Title');
      const res = await request(app.getHttpServer())
        .patch(`/api/todos/${todo.id}`)
        .send({ description: 'Added desc' })
        .expect(200);
      expect(res.body.title).toBe('Title');
      expect(res.body.description).toBe('Added desc');
    });

    it('returns 404 when todo does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/todos/9999')
        .send({ title: 'X' })
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/todos/:id
  // ---------------------------------------------------------------------------

  describe('DELETE /api/todos/:id', () => {
    it('returns 204 and removes the todo', async () => {
      const todo = await createTodo('To delete');
      await request(app.getHttpServer())
        .delete(`/api/todos/${todo.id}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get('/api/todos')
        .expect(200);
      expect(res.body).toHaveLength(0);
    });

    it('returns 404 when todo does not exist', async () => {
      await request(app.getHttpServer())
        .delete('/api/todos/9999')
        .expect(404);
    });
  });
});
