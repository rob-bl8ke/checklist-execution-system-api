import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Template } from '../template/template.entity';
import { TemplateStep } from '../template-step/template-step.entity';
import { Instance } from './instance.entity';
import { InstanceStep } from './instance-step.entity';
import { InstanceStatus } from './enums/instance-status.enum';
import { TemplatesModule } from '../template/template.module';
import { TemplateStepModule } from '../template-step/template-step.module';
import { InstanceModule } from './instance.module';

describe('Instances API (integration)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Template, TemplateStep, Instance, InstanceStep],
          synchronize: true,
        }),
        TemplatesModule,
        TemplateStepModule,
        InstanceModule,
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
    await dataSource.query('DELETE FROM instance_step');
    await dataSource.query('DELETE FROM instance');
    await dataSource.query('DELETE FROM template_step');
    await dataSource.query('DELETE FROM template');
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function createTemplate(name = 'Test Template') {
    const res = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name })
      .expect(201);
    return res.body as { id: number };
  }

  async function addStep(templateId: number, title: string, instructions?: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/templates/${templateId}/steps`)
      .send({ title, ...(instructions && { instructions }) })
      .expect(201);
    return res.body as { id: number; position: number };
  }

  async function createInstance(
    templateId: number,
    name = 'Run 1',
    variables?: Record<string, string>,
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/instances')
      .send({ templateId, name, ...(variables && { variables }) })
      .expect(201);
    return res.body as {
      id: number;
      templateId: number;
      name: string;
      status: InstanceStatus;
      nextStepId: number | null;
      steps: Array<{ id: number; stepOrder: number; title: string; renderedInstructions: string | null; completed: boolean }>;
    };
  }

  // ---------------------------------------------------------------------------
  // POST /api/instances
  // ---------------------------------------------------------------------------

  it('POST returns 404 for unknown template', () =>
    request(app.getHttpServer())
      .post('/api/instances')
      .send({ templateId: 9999, name: 'X' })
      .expect(404));

  it('POST returns 400 for missing name', () =>
    request(app.getHttpServer())
      .post('/api/instances')
      .send({ templateId: 1 })
      .expect(400));

  it('POST creates instance with steps in position order', async () => {
    const tmpl = await createTemplate('Deploy');
    await addStep(tmpl.id, 'Pull code');
    await addStep(tmpl.id, 'Run tests');
    await addStep(tmpl.id, 'Deploy');

    const inst = await createInstance(tmpl.id, 'Deploy run');
    expect(inst.status).toBe(InstanceStatus.IN_PROGRESS);
    expect(inst.steps).toHaveLength(3);
    expect(inst.steps[0].stepOrder).toBe(1);
    expect(inst.steps[1].stepOrder).toBe(2);
    expect(inst.steps[2].stepOrder).toBe(3);
  });

  it('POST sets nextStepId to first step', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'Step A');
    await addStep(tmpl.id, 'Step B');

    const inst = await createInstance(tmpl.id);
    expect(inst.nextStepId).toBe(inst.steps[0].id);
  });

  it('POST renders variable placeholders in instructions', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'Build', 'docker build -t {{service}}:{{version}} .');
    await addStep(tmpl.id, 'Deploy', 'kubectl apply -f {{service}}.yaml');

    const inst = await createInstance(tmpl.id, 'Release', {
      service: 'my-api',
      version: '1.0.0',
    });

    expect(inst.steps[0].renderedInstructions).toBe(
      'docker build -t my-api:1.0.0 .',
    );
    expect(inst.steps[1].renderedInstructions).toBe(
      'kubectl apply -f my-api.yaml',
    );
  });

  it('POST leaves unmatched placeholders as-is', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'Step', 'Use {{unknownVar}} here');
    const inst = await createInstance(tmpl.id, 'Run', { other: 'x' });
    expect(inst.steps[0].renderedInstructions).toBe('Use {{unknownVar}} here');
  });

  it('POST creates instance with no steps (empty template)', async () => {
    const tmpl = await createTemplate('Empty');
    const inst = await createInstance(tmpl.id);
    expect(inst.steps).toHaveLength(0);
    expect(inst.nextStepId).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // GET /api/instances
  // ---------------------------------------------------------------------------

  it('GET returns empty array when no instances', () =>
    request(app.getHttpServer()).get('/api/instances').expect(200).expect([]));

  it('GET returns instance summaries with progress and nextStep', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'Step 1');
    await addStep(tmpl.id, 'Step 2');
    const inst = await createInstance(tmpl.id, 'Run X');

    const res = await request(app.getHttpServer())
      .get('/api/instances')
      .expect(200);

    expect(res.body).toHaveLength(1);
    const summary = res.body[0];
    expect(summary.id).toBe(inst.id);
    expect(summary.progress).toEqual({ completed: 0, total: 2 });
    expect(summary.nextStep).toMatchObject({ id: inst.steps[0].id, title: 'Step 1' });
  });

  // ---------------------------------------------------------------------------
  // GET /api/instances/:id
  // ---------------------------------------------------------------------------

  it('GET /:id returns 404 for unknown instance', () =>
    request(app.getHttpServer()).get('/api/instances/9999').expect(404));

  it('GET /:id returns full instance with steps', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'S1', 'instruction A');
    const inst = await createInstance(tmpl.id, 'Detail run');

    const res = await request(app.getHttpServer())
      .get(`/api/instances/${inst.id}`)
      .expect(200);

    expect(res.body.id).toBe(inst.id);
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.steps[0].title).toBe('S1');
    expect(res.body.progress).toEqual({ completed: 0, total: 1 });
  });

  // ---------------------------------------------------------------------------
  // PATCH .../steps/:stepId (step completion)
  // ---------------------------------------------------------------------------

  it('PATCH step completes a step and advances nextStepId', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'S1');
    await addStep(tmpl.id, 'S2');
    const inst = await createInstance(tmpl.id);

    const step1 = inst.steps[0];
    const step2 = inst.steps[1];

    const res = await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}/steps/${step1.id}`)
      .send({ completed: true })
      .expect(200);

    expect(res.body.completed).toBe(true);

    const detailRes = await request(app.getHttpServer())
      .get(`/api/instances/${inst.id}`)
      .expect(200);
    expect(detailRes.body.nextStep.id).toBe(step2.id);
  });

  it('PATCH step completing last step auto-sets status to COMPLETED', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'Only step');
    const inst = await createInstance(tmpl.id);

    await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}/steps/${inst.steps[0].id}`)
      .send({ completed: true })
      .expect(200);

    const detailRes = await request(app.getHttpServer())
      .get(`/api/instances/${inst.id}`)
      .expect(200);
    expect(detailRes.body.status).toBe(InstanceStatus.COMPLETED);
    expect(detailRes.body.nextStep).toBeNull();
  });

  it('PATCH step un-completing reverts COMPLETED instance to IN_PROGRESS', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'Step');
    const inst = await createInstance(tmpl.id);

    // Complete the only step
    await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}/steps/${inst.steps[0].id}`)
      .send({ completed: true })
      .expect(200);

    // Un-complete it
    await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}/steps/${inst.steps[0].id}`)
      .send({ completed: false })
      .expect(200);

    const detailRes = await request(app.getHttpServer())
      .get(`/api/instances/${inst.id}`)
      .expect(200);
    expect(detailRes.body.status).toBe(InstanceStatus.IN_PROGRESS);
    expect(detailRes.body.nextStep.id).toBe(inst.steps[0].id);
  });

  it('PATCH step returns 404 for unknown instance', () =>
    request(app.getHttpServer())
      .patch('/api/instances/9999/steps/1')
      .send({ completed: true })
      .expect(404));

  it('PATCH step returns 404 for unknown step', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'S');
    const inst = await createInstance(tmpl.id);

    await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}/steps/9999`)
      .send({ completed: true })
      .expect(404);
  });

  it('PATCH step returns 409 on ABANDONED instance', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'Step');
    const inst = await createInstance(tmpl.id);

    // Abandon the instance
    await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}`)
      .send({ status: InstanceStatus.ABANDONED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}/steps/${inst.steps[0].id}`)
      .send({ completed: true })
      .expect(409);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/instances/:id (status update)
  // ---------------------------------------------------------------------------

  it('PATCH /:id sets status to ABANDONED', async () => {
    const tmpl = await createTemplate();
    await addStep(tmpl.id, 'S');
    const inst = await createInstance(tmpl.id);

    const res = await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}`)
      .send({ status: InstanceStatus.ABANDONED })
      .expect(200);

    expect(res.body.status).toBe(InstanceStatus.ABANDONED);
  });

  it('PATCH /:id returns 404 for unknown instance', () =>
    request(app.getHttpServer())
      .patch('/api/instances/9999')
      .send({ status: InstanceStatus.ABANDONED })
      .expect(404));

  it('PATCH /:id returns 400 for invalid status', async () => {
    const tmpl = await createTemplate();
    const inst = await createInstance(tmpl.id);
    await request(app.getHttpServer())
      .patch(`/api/instances/${inst.id}`)
      .send({ status: 'INVALID_STATUS' })
      .expect(400);
  });
});
