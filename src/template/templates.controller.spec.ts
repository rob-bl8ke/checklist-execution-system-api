import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TemplatesModule } from './template.module';
import { TemplateStepModule } from '../template-step/template-step.module';
import { Template } from './template.entity';
import { TemplateStep } from '../template-step/template-step.entity';

describe('Templates API (integration)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Template, TemplateStep],
          synchronize: true,
        }),
        TemplatesModule,
        TemplateStepModule,
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
    await dataSource.query('DELETE FROM template_step');
    await dataSource.query('DELETE FROM template');
  });

  it('GET /api/templates returns empty array', () =>
    request(app.getHttpServer()).get('/api/templates').expect(200).expect([]));

  it('POST /api/templates creates a template', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name: 'Deployment Process', description: 'Deploy steps' })
      .expect(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: 'Deployment Process',
      description: 'Deploy steps',
    });
  });

  it('POST /api/templates returns 400 for missing name', () =>
    request(app.getHttpServer())
      .post('/api/templates')
      .send({ description: 'No name' })
      .expect(400));

  it('GET /api/templates/:id returns the template', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name: 'Test Template' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/templates/${created.body.id}`)
      .expect(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      name: 'Test Template',
      steps: [],
    });
  });

  it('GET /api/templates/:id returns 404 for unknown id', () =>
    request(app.getHttpServer()).get('/api/templates/9999').expect(404));

  it('PUT /api/templates/:id updates the template', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name: 'Original' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .put(`/api/templates/${created.body.id}`)
      .send({ name: 'Updated' })
      .expect(200);
    expect(res.body.name).toBe('Updated');
  });

  it('PUT /api/templates/:id returns 404 for unknown id', () =>
    request(app.getHttpServer())
      .put('/api/templates/9999')
      .send({ name: 'X' })
      .expect(404));

  it('DELETE /api/templates/:id deletes the template', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name: 'To Delete' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/templates/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/templates/${created.body.id}`)
      .expect(404);
  });

  it('DELETE /api/templates/:id returns 404 for unknown id', () =>
    request(app.getHttpServer()).delete('/api/templates/9999').expect(404));

  it('GET /api/templates includes correct stepCount', async () => {
    const tmpl = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name: 'Counted Template' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/templates/${tmpl.body.id}/steps`)
      .send({ title: 'Step 1' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/templates/${tmpl.body.id}/steps`)
      .send({ title: 'Step 2' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/templates')
      .expect(200);

    const found = res.body.find((t: { id: number }) => t.id === tmpl.body.id);
    expect(found).toBeDefined();
    expect(found.stepCount).toBe(2);
  });

  it('DELETE /api/templates/:id cascades to steps', async () => {
    const tmpl = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name: 'With Steps' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/templates/${tmpl.body.id}/steps`)
      .send({ title: 'Step 1' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/templates/${tmpl.body.id}`)
      .expect(204);

    // Template is gone; steps should also be gone
    await request(app.getHttpServer())
      .get(`/api/templates/${tmpl.body.id}`)
      .expect(404);

    // stepCount for cleaned up template should not appear in list
    const listRes = await request(app.getHttpServer()).get('/api/templates');
    const found = listRes.body.find((t: { id: number }) => t.id === tmpl.body.id);
    expect(found).toBeUndefined();
  });
});
