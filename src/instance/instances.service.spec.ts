import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InstancesService } from './instances.service';
import { Instance } from './instance.entity';
import { InstanceStep } from './instance-step.entity';
import { InstanceStatus } from './enums/instance-status.enum';
import { Template } from '../template/template.entity';

// ---------------------------------------------------------------------------
// Mock queryRunner for transaction test
// ---------------------------------------------------------------------------
const mockQr = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    create: jest.fn(),
    save: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQr),
};

const mockInstanceRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockStepRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockTemplateRepo = {
  findOne: jest.fn(),
};

describe('InstancesService', () => {
  let service: InstancesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstancesService,
        { provide: getRepositoryToken(Instance), useValue: mockInstanceRepo },
        { provide: getRepositoryToken(InstanceStep), useValue: mockStepRepo },
        { provide: getRepositoryToken(Template), useValue: mockTemplateRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<InstancesService>(InstancesService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('throws NotFoundException when template does not exist', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ templateId: 999, name: 'Run', variables: {} }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates instance with rendered steps and sets nextStepId', async () => {
      const templateSteps = [
        { id: 1, title: 'Step 1', instructions: 'Deploy {{service}}', position: 100 },
        { id: 2, title: 'Step 2', instructions: null, position: 200 },
      ];
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 1,
        steps: templateSteps,
        variablePrefix: null,
        variableSuffix: null,
      });

      const savedInstance = { id: 10, nextStepId: null, templateId: 1, name: 'Run A', variables: { service: 'api' }, status: InstanceStatus.IN_PROGRESS };
      const savedStep1 = { id: 101, instanceId: 10, stepOrder: 1, title: 'Step 1', renderedInstructions: 'Deploy api', completed: false };
      const savedStep2 = { id: 102, instanceId: 10, stepOrder: 2, title: 'Step 2', renderedInstructions: null, completed: false };

      mockQr.manager.create
        .mockReturnValueOnce(savedInstance)  // Instance
        .mockReturnValueOnce(savedStep1)     // step 1
        .mockReturnValueOnce(savedStep2);    // step 2

      mockQr.manager.save
        .mockResolvedValueOnce(savedInstance) // initial instance save
        .mockResolvedValueOnce(savedStep1)    // step 1
        .mockResolvedValueOnce(savedStep2)    // step 2
        .mockResolvedValueOnce({ ...savedInstance, nextStepId: 101 }); // nextStepId update

      const result = await service.create({ templateId: 1, name: 'Run A', variables: { service: 'api' } });

      expect(mockQr.startTransaction).toHaveBeenCalled();
      expect(mockQr.commitTransaction).toHaveBeenCalled();
      expect(mockQr.rollbackTransaction).not.toHaveBeenCalled();
      expect(result.steps).toHaveLength(2);
    });

    it('uses custom delimiters when template has variablePrefix and variableSuffix', async () => {
      const templateSteps = [
        { id: 1, title: 'Step 1', instructions: 'Deploy @{service} to @{env}', position: 100 },
      ];
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 1,
        steps: templateSteps,
        variablePrefix: '@{',
        variableSuffix: '}',
      });

      const savedInstance = {
        id: 20, nextStepId: null, templateId: 1,
        name: 'Custom Run', variables: { service: 'api', env: 'prod' },
        status: InstanceStatus.IN_PROGRESS,
      };
      const savedStep = {
        id: 201, instanceId: 20, stepOrder: 1, title: 'Step 1',
        renderedInstructions: 'Deploy api to prod', completed: false,
      };

      mockQr.manager.create
        .mockReturnValueOnce(savedInstance)
        .mockReturnValueOnce(savedStep);

      mockQr.manager.save
        .mockResolvedValueOnce(savedInstance)
        .mockResolvedValueOnce(savedStep)
        .mockResolvedValueOnce({ ...savedInstance, nextStepId: 201 });

      await service.create({ templateId: 1, name: 'Custom Run', variables: { service: 'api', env: 'prod' } });

      // Verify the rendered instructions passed to create contain the substituted values
      const stepCreateCall = mockQr.manager.create.mock.calls[1];
      expect(stepCreateCall[1].renderedInstructions).toBe('Deploy api to prod');
    });

    it('leaves custom-delimiter placeholders intact when variable is missing', async () => {
      const templateSteps = [
        { id: 1, title: 'Step 1', instructions: 'Deploy @{service}', position: 100 },
      ];
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 1,
        steps: templateSteps,
        variablePrefix: '@{',
        variableSuffix: '}',
      });

      const savedInstance = {
        id: 30, nextStepId: null, templateId: 1,
        name: 'Missing Var', variables: {},
        status: InstanceStatus.IN_PROGRESS,
      };
      const savedStep = {
        id: 301, instanceId: 30, stepOrder: 1, title: 'Step 1',
        renderedInstructions: 'Deploy @{service}', completed: false,
      };

      mockQr.manager.create
        .mockReturnValueOnce(savedInstance)
        .mockReturnValueOnce(savedStep);
      mockQr.manager.save
        .mockResolvedValueOnce(savedInstance)
        .mockResolvedValueOnce(savedStep)
        .mockResolvedValueOnce({ ...savedInstance, nextStepId: 301 });

      await service.create({ templateId: 1, name: 'Missing Var', variables: {} });

      const stepCreateCall = mockQr.manager.create.mock.calls[1];
      // Variables map is empty so renderInstructions returns the template unchanged
      expect(stepCreateCall[1].renderedInstructions).toBe('Deploy @{service}');
    });

    it('applies a single pipe transform when rendering step instructions', async () => {
      const templateSteps = [
        { id: 1, title: 'Step 1', instructions: 'Service: {{service | upper}}', position: 100 },
      ];
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 1, steps: templateSteps, variablePrefix: null, variableSuffix: null,
      });

      const savedInstance = {
        id: 40, nextStepId: null, templateId: 1,
        name: 'Transform Run', variables: { service: 'api' },
        status: InstanceStatus.IN_PROGRESS,
      };
      const savedStep = {
        id: 401, instanceId: 40, stepOrder: 1, title: 'Step 1',
        renderedInstructions: 'Service: API', completed: false,
      };

      mockQr.manager.create.mockReturnValueOnce(savedInstance).mockReturnValueOnce(savedStep);
      mockQr.manager.save
        .mockResolvedValueOnce(savedInstance)
        .mockResolvedValueOnce(savedStep)
        .mockResolvedValueOnce({ ...savedInstance, nextStepId: 401 });

      await service.create({ templateId: 1, name: 'Transform Run', variables: { service: 'api' } });

      const stepCreateCall = mockQr.manager.create.mock.calls[1];
      expect(stepCreateCall[1].renderedInstructions).toBe('Service: API');
    });

    it('applies chained pipe transforms when rendering step instructions', async () => {
      const templateSteps = [
        { id: 1, title: 'Step 1', instructions: 'Path: {{title | remove_spaces | lower}}', position: 100 },
      ];
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 1, steps: templateSteps, variablePrefix: null, variableSuffix: null,
      });

      const savedInstance = {
        id: 50, nextStepId: null, templateId: 1,
        name: 'Chain Run', variables: { title: 'My Service' },
        status: InstanceStatus.IN_PROGRESS,
      };
      const savedStep = {
        id: 501, instanceId: 50, stepOrder: 1, title: 'Step 1',
        renderedInstructions: 'Path: myservice', completed: false,
      };

      mockQr.manager.create.mockReturnValueOnce(savedInstance).mockReturnValueOnce(savedStep);
      mockQr.manager.save
        .mockResolvedValueOnce(savedInstance)
        .mockResolvedValueOnce(savedStep)
        .mockResolvedValueOnce({ ...savedInstance, nextStepId: 501 });

      await service.create({ templateId: 1, name: 'Chain Run', variables: { title: 'My Service' } });

      const stepCreateCall = mockQr.manager.create.mock.calls[1];
      expect(stepCreateCall[1].renderedInstructions).toBe('Path: myservice');
    });

    it('applies parameterized transform when rendering step instructions', async () => {
      const templateSteps = [
        { id: 1, title: 'Step 1', instructions: 'Version: {{version | replace(".", "_")}}', position: 100 },
      ];
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 1, steps: templateSteps, variablePrefix: null, variableSuffix: null,
      });

      const savedInstance = {
        id: 60, nextStepId: null, templateId: 1,
        name: 'Param Run', variables: { version: '1.2.3' },
        status: InstanceStatus.IN_PROGRESS,
      };
      const savedStep = {
        id: 601, instanceId: 60, stepOrder: 1, title: 'Step 1',
        renderedInstructions: 'Version: 1_2_3', completed: false,
      };

      mockQr.manager.create.mockReturnValueOnce(savedInstance).mockReturnValueOnce(savedStep);
      mockQr.manager.save
        .mockResolvedValueOnce(savedInstance)
        .mockResolvedValueOnce(savedStep)
        .mockResolvedValueOnce({ ...savedInstance, nextStepId: 601 });

      await service.create({ templateId: 1, name: 'Param Run', variables: { version: '1.2.3' } });

      const stepCreateCall = mockQr.manager.create.mock.calls[1];
      expect(stepCreateCall[1].renderedInstructions).toBe('Version: 1_2_3');
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns instance summaries with progress and nextStep', async () => {
      const steps = [
        { id: 1, stepOrder: 1, title: 'Step A', completed: true },
        { id: 2, stepOrder: 2, title: 'Step B', completed: false },
      ] as InstanceStep[];
      const instance = {
        id: 1, name: 'Run 1', status: InstanceStatus.IN_PROGRESS,
        createdAt: new Date(), nextStepId: 2, steps,
      } as unknown as Instance;
      mockInstanceRepo.find.mockResolvedValue([instance]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].progress).toEqual({ completed: 1, total: 2 });
      expect(result[0].nextStep).toEqual({ id: 2, title: 'Step B' });
    });

    it('returns nextStep: null when instance is completed', async () => {
      const steps = [
        { id: 1, stepOrder: 1, title: 'Only', completed: true },
      ] as InstanceStep[];
      const instance = {
        id: 1, name: 'Done', status: InstanceStatus.COMPLETED,
        createdAt: new Date(), nextStepId: null, steps,
      } as unknown as Instance;
      mockInstanceRepo.find.mockResolvedValue([instance]);

      const [summary] = await service.findAll();
      expect(summary.nextStep).toBeNull();
      expect(summary.progress).toEqual({ completed: 1, total: 1 });
    });

    it('returns empty array when no instances exist', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('throws NotFoundException for unknown instance', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('returns instance with progress and nextStep', async () => {
      const steps = [
        { id: 1, stepOrder: 1, title: 'S1', completed: false },
      ] as InstanceStep[];
      const instance = {
        id: 1, name: 'R', status: InstanceStatus.IN_PROGRESS,
        createdAt: new Date(), nextStepId: 1, steps,
      } as unknown as Instance;
      mockInstanceRepo.findOne.mockResolvedValue(instance);

      const result = await service.findOne(1);
      expect(result.nextStep).toEqual({ id: 1, title: 'S1' });
      expect(result.progress).toEqual({ completed: 0, total: 1 });
    });
  });

  // ---------------------------------------------------------------------------
  // completeStep
  // ---------------------------------------------------------------------------

  describe('completeStep', () => {
    function buildInstance(
      steps: Partial<InstanceStep>[],
      overrides: Partial<Instance> = {},
    ): Instance {
      return {
        id: 1, name: 'R', status: InstanceStatus.IN_PROGRESS,
        nextStepId: steps[0]?.id ?? null,
        steps: steps as InstanceStep[],
        ...overrides,
      } as unknown as Instance;
    }

    it('completes a step and advances nextStepId', async () => {
      const instance = buildInstance([
        { id: 1, stepOrder: 1, completed: false },
        { id: 2, stepOrder: 2, completed: false },
      ]);
      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockStepRepo.save.mockImplementation(async (s: InstanceStep) => s);
      mockInstanceRepo.save.mockImplementation(async (i: Instance) => i);

      const result = await service.completeStep(1, 1, { completed: true });
      expect(result.completed).toBe(true);
      expect(instance.nextStepId).toBe(2);
      expect(instance.status).toBe(InstanceStatus.IN_PROGRESS);
    });

    it('auto-sets COMPLETED when last step is completed', async () => {
      const instance = buildInstance([
        { id: 1, stepOrder: 1, completed: false },
      ]);
      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockStepRepo.save.mockImplementation(async (s: InstanceStep) => s);
      mockInstanceRepo.save.mockImplementation(async (i: Instance) => i);

      await service.completeStep(1, 1, { completed: true });
      expect(instance.status).toBe(InstanceStatus.COMPLETED);
      expect(instance.nextStepId).toBeNull();
    });

    it('reverts COMPLETED to IN_PROGRESS when step is un-completed', async () => {
      const instance = buildInstance(
        [{ id: 1, stepOrder: 1, completed: true }],
        { status: InstanceStatus.COMPLETED, nextStepId: null },
      );
      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockStepRepo.save.mockImplementation(async (s: InstanceStep) => s);
      mockInstanceRepo.save.mockImplementation(async (i: Instance) => i);

      await service.completeStep(1, 1, { completed: false });
      expect(instance.status).toBe(InstanceStatus.IN_PROGRESS);
      expect(instance.nextStepId).toBe(1);
    });

    it('throws ConflictException on ABANDONED instance', async () => {
      const instance = buildInstance(
        [{ id: 1, stepOrder: 1, completed: false }],
        { status: InstanceStatus.ABANDONED },
      );
      mockInstanceRepo.findOne.mockResolvedValue(instance);
      await expect(
        service.completeStep(1, 1, { completed: true }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown step', async () => {
      const instance = buildInstance([{ id: 1, stepOrder: 1, completed: false }]);
      mockInstanceRepo.findOne.mockResolvedValue(instance);
      await expect(
        service.completeStep(1, 999, { completed: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for unknown instance', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(
        service.completeStep(999, 1, { completed: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateStatus
  // ---------------------------------------------------------------------------

  describe('updateStatus', () => {
    it('sets status to ABANDONED', async () => {
      const instance = { id: 1, status: InstanceStatus.IN_PROGRESS } as Instance;
      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockInstanceRepo.save.mockImplementation(async (i: Instance) => i);

      const result = await service.updateStatus(1, { status: InstanceStatus.ABANDONED });
      expect(result.status).toBe(InstanceStatus.ABANDONED);
    });

    it('throws NotFoundException for unknown instance', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(999, { status: InstanceStatus.ABANDONED }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
