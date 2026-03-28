import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TemplatesModule } from '../template/template.module';
import { TemplateStepModule } from './template-step.module';
import { Template } from '../template/template.entity';
import { TemplateStep } from './template-step.entity';

describe('TemplateSteps API (integration)', () => {
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

  /** Helper: create a template and return its id */
  async function createTemplate(name = 'Test Template'): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/templates')
      .send({ name })
      .expect(201);
    return res.body.id as number;
  }

  /** Helper: create a step and return it */
  async function createStep(
    templateId: number,
    title: string,
    instructions?: string,
  ) {
    const res = await request(app.getHttpServer())
      .post(`/api/templates/${templateId}/steps`)
      .send({ title, ...(instructions && { instructions }) })
      .expect(201);
    return res.body as { id: number; position: number; title: string };
  }

  // ---------------------------------------------------------------------------
  // POST – create step
  // ---------------------------------------------------------------------------

  it('POST assigns position 100 for the first step', async () => {
    const tmplId = await createTemplate();
    const res = await request(app.getHttpServer())
      .post(`/api/templates/${tmplId}/steps`)
      .send({ title: 'Step 1' })
      .expect(201);
    expect(res.body.position).toBe(100);
  });

  it('POST appends subsequent steps at last + 100', async () => {
    const tmplId = await createTemplate();
    await createStep(tmplId, 'Step 1');
    await createStep(tmplId, 'Step 2');
    const step3 = await createStep(tmplId, 'Step 3');
    expect(step3.position).toBe(300);
  });

  it('POST returns 404 for unknown template', () =>
    request(app.getHttpServer())
      .post('/api/templates/9999/steps')
      .send({ title: 'X' })
      .expect(404));

  it('POST returns 400 for missing title', async () => {
    const tmplId = await createTemplate();
    await request(app.getHttpServer())
      .post(`/api/templates/${tmplId}/steps`)
      .send({})
      .expect(400);
  });

  // ---------------------------------------------------------------------------
  // PUT – update step
  // ---------------------------------------------------------------------------

  it('PUT updates title and instructions', async () => {
    const tmplId = await createTemplate();
    const step = await createStep(tmplId, 'Old Title');

    const res = await request(app.getHttpServer())
      .put(`/api/templates/${tmplId}/steps/${step.id}`)
      .send({ title: 'New Title', instructions: 'Do this' })
      .expect(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.instructions).toBe('Do this');
  });

  it('PUT returns 404 for unknown step', async () => {
    const tmplId = await createTemplate();
    await request(app.getHttpServer())
      .put(`/api/templates/${tmplId}/steps/9999`)
      .send({ title: 'X' })
      .expect(404);
  });

  // ---------------------------------------------------------------------------
  // DELETE – remove step
  // ---------------------------------------------------------------------------

  it('DELETE removes the step and returns 204', async () => {
    const tmplId = await createTemplate();
    const step = await createStep(tmplId, 'To delete');

    await request(app.getHttpServer())
      .delete(`/api/templates/${tmplId}/steps/${step.id}`)
      .expect(204);

    // Step is gone – template GET should show empty steps
    const tmplRes = await request(app.getHttpServer())
      .get(`/api/templates/${tmplId}`)
      .expect(200);
    expect(tmplRes.body.steps).toHaveLength(0);
  });

  it('DELETE returns 404 for unknown step', async () => {
    const tmplId = await createTemplate();
    await request(app.getHttpServer())
      .delete(`/api/templates/${tmplId}/steps/9999`)
      .expect(404);
  });

  // ---------------------------------------------------------------------------
  // PATCH move – reordering
  // ---------------------------------------------------------------------------

  it('PATCH move/last sets position to beforeStep.position + 100', async () => {
    const tmplId = await createTemplate();
    const stepA = await createStep(tmplId, 'A'); // pos 100
    const stepB = await createStep(tmplId, 'B'); // pos 200
    const stepC = await createStep(tmplId, 'C'); // pos 300

    // Move A to last (after C)
    const res = await request(app.getHttpServer())
      .patch(`/api/templates/${tmplId}/steps/${stepA.id}/move`)
      .send({ beforeStepId: stepC.id })
      .expect(200);
    expect(res.body.position).toBe(400); // 300 + 100
    void stepB;
  });

  it('PATCH move/first sets position to afterStep.position / 2', async () => {
    const tmplId = await createTemplate();
    const stepA = await createStep(tmplId, 'A'); // pos 100
    const stepC = await createStep(tmplId, 'C'); // pos 200

    // Move C to first (before A)
    const res = await request(app.getHttpServer())
      .patch(`/api/templates/${tmplId}/steps/${stepC.id}/move`)
      .send({ afterStepId: stepA.id })
      .expect(200);
    expect(res.body.position).toBe(50); // 100 / 2
  });

  it('PATCH move between two steps calculates midpoint', async () => {
    const tmplId = await createTemplate();
    const stepA = await createStep(tmplId, 'A'); // pos 100
    const stepB = await createStep(tmplId, 'B'); // pos 200
    const stepC = await createStep(tmplId, 'C'); // pos 300

    // Move C between A and B
    const res = await request(app.getHttpServer())
      .patch(`/api/templates/${tmplId}/steps/${stepC.id}/move`)
      .send({ beforeStepId: stepA.id, afterStepId: stepB.id })
      .expect(200);
    expect(res.body.position).toBe(150); // (100 + 200) / 2
  });

  it('PATCH move returns 404 for unknown template', () =>
    request(app.getHttpServer())
      .patch('/api/templates/9999/steps/1/move')
      .send({ beforeStepId: 0 })
      .expect(404));

  it('PATCH move returns 404 for unknown step', async () => {
    const tmplId = await createTemplate();
    await request(app.getHttpServer())
      .patch(`/api/templates/${tmplId}/steps/9999/move`)
      .send({ beforeStepId: 0 })
      .expect(404);
  });

  it('PATCH move rebalances and keeps strict ordering after gap exhaustion', async () => {
    const tmplId = await createTemplate();
    // A at 100, B at 200 form the initial bounds.
    // We create 8 extra steps and insert each one between A and the previous
    // closest-to-A step. This halves the gap each iteration:
    // 100, 50, 25, 12.5, 6.25, 3.125, 1.5625, 0.78125 → triggers rebalance on the 8th insert.
    const a = await createStep(tmplId, 'A'); // pos 100
    const b = await createStep(tmplId, 'B'); // pos 200

    const extras: { id: number }[] = [];
    for (let i = 0; i < 8; i++) {
      extras.push(await createStep(tmplId, `E${i}`)); // pos 300, 400, ...
    }

    // rightAfterA tracks the step currently sitting just to the right of A
    let rightAfterA = b.id;

    for (const extra of extras) {
      const res = await request(app.getHttpServer())
        .patch(`/api/templates/${tmplId}/steps/${extra.id}/move`)
        .send({ beforeStepId: a.id, afterStepId: rightAfterA })
        .expect(200);

      // The newly inserted step is now the closest step to A
      rightAfterA = extra.id;
      void res;
    }

    // After all inserts (which trigger at least one rebalance), all steps
    // must have strictly increasing positions.
    const finalRes = await request(app.getHttpServer())
      .get(`/api/templates/${tmplId}`)
      .expect(200);
    const finalSteps: Array<{ id: number; position: number }> = finalRes.body.steps;
    expect(finalSteps).toHaveLength(10); // a + b + 8 extras
    for (let i = 0; i < finalSteps.length - 1; i++) {
      expect(finalSteps[i].position).toBeLessThan(finalSteps[i + 1].position);
    }
  });
});
