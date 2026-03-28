import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TemplateStepsService } from './template-steps.service';
import { TemplateStep } from './template-step.entity';
import { Template } from '../template/template.entity';

const mockTemplateRepo = {
  existsBy: jest.fn(),
};

const mockStepRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('TemplateStepsService', () => {
  let service: TemplateStepsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateStepsService,
        { provide: getRepositoryToken(TemplateStep), useValue: mockStepRepo },
        { provide: getRepositoryToken(Template), useValue: mockTemplateRepo },
      ],
    }).compile();
    service = module.get<TemplateStepsService>(TemplateStepsService);
  });

  describe('create', () => {
    it('assigns position 100 when no existing steps', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(true);
      mockStepRepo.findOne.mockResolvedValue(null);
      const step = { id: 1, templateId: 1, position: 100, title: 'S1' } as TemplateStep;
      mockStepRepo.create.mockReturnValue(step);
      mockStepRepo.save.mockResolvedValue(step);

      await service.create(1, { title: 'S1' });
      expect(mockStepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 1, position: 100, title: 'S1' }),
      );
    });

    it('appends at last position + 100', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(true);
      mockStepRepo.findOne.mockResolvedValue({ position: 200 } as TemplateStep);
      const step = { id: 3, templateId: 1, position: 300, title: 'S3' } as TemplateStep;
      mockStepRepo.create.mockReturnValue(step);
      mockStepRepo.save.mockResolvedValue(step);

      await service.create(1, { title: 'S3' });
      expect(mockStepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ position: 300 }),
      );
    });

    it('throws NotFoundException for unknown template', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(false);
      await expect(service.create(999, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates title and returns the saved step', async () => {
      const step = { id: 1, templateId: 1, position: 100, title: 'Old' } as TemplateStep;
      const saved = { ...step, title: 'New' } as TemplateStep;
      mockStepRepo.findOne.mockResolvedValue(step);
      mockStepRepo.save.mockResolvedValue(saved);
      await expect(service.update(1, 1, { title: 'New' })).resolves.toBe(saved);
    });

    it('throws NotFoundException for unknown step', async () => {
      mockStepRepo.findOne.mockResolvedValue(null);
      await expect(service.update(1, 999, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes the step', async () => {
      const step = { id: 1, templateId: 1, position: 100, title: 'S' } as TemplateStep;
      mockStepRepo.findOne.mockResolvedValue(step);
      mockStepRepo.remove.mockResolvedValue(step);
      await expect(service.remove(1, 1)).resolves.toBeUndefined();
      expect(mockStepRepo.remove).toHaveBeenCalledWith(step);
    });

    it('throws NotFoundException for unknown step', async () => {
      mockStepRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('move', () => {
    it('calculates midpoint when between two steps', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(true);
      const stepToMove = { id: 2, templateId: 1, position: 200 } as TemplateStep;
      const before = { id: 1, templateId: 1, position: 100 } as TemplateStep;
      const after = { id: 3, templateId: 1, position: 300 } as TemplateStep;
      mockStepRepo.findOne
        .mockResolvedValueOnce(stepToMove)
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      mockStepRepo.save.mockImplementation(async (s: TemplateStep) => s);

      const result = await service.move(1, 2, { beforeStepId: 1, afterStepId: 3 });
      expect(result.position).toBe(200); // (100 + 300) / 2
    });

    it('sets position to first when only afterStepId given', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(true);
      const stepToMove = { id: 3, templateId: 1, position: 300 } as TemplateStep;
      const afterStep = { id: 1, templateId: 1, position: 100 } as TemplateStep;
      mockStepRepo.findOne
        .mockResolvedValueOnce(stepToMove)
        .mockResolvedValueOnce(afterStep);
      mockStepRepo.save.mockImplementation(async (s: TemplateStep) => s);

      const result = await service.move(1, 3, { afterStepId: 1 });
      expect(result.position).toBe(50); // 100 / 2
    });

    it('sets position to last when only beforeStepId given', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(true);
      const stepToMove = { id: 1, templateId: 1, position: 100 } as TemplateStep;
      const beforeStep = { id: 3, templateId: 1, position: 300 } as TemplateStep;
      mockStepRepo.findOne
        .mockResolvedValueOnce(stepToMove)
        .mockResolvedValueOnce(beforeStep);
      mockStepRepo.save.mockImplementation(async (s: TemplateStep) => s);

      const result = await service.move(1, 1, { beforeStepId: 3 });
      expect(result.position).toBe(400); // 300 + 100
    });

    it('throws BadRequestException when neither id provided', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(true);
      const step = { id: 1, templateId: 1, position: 100 } as TemplateStep;
      mockStepRepo.findOne.mockResolvedValue(step);
      await expect(service.move(1, 1, {})).rejects.toThrow(BadRequestException);
    });

    it('triggers rebalance when gap < 1 between neighbours', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(true);
      const stepToMove = { id: 2, templateId: 1, position: 100.4 } as TemplateStep;
      const beforeStep = { id: 1, templateId: 1, position: 100 } as TemplateStep;
      const afterStep = { id: 3, templateId: 1, position: 100.5 } as TemplateStep;
      // Post-rebalance mocks
      const reBeforeStep = { id: 1, templateId: 1, position: 100 } as TemplateStep;
      const reAfterStep = { id: 3, templateId: 1, position: 300 } as TemplateStep;
      const reStepToMove = { id: 2, templateId: 1, position: 200 } as TemplateStep;

      mockStepRepo.findOne
        .mockResolvedValueOnce(stepToMove)
        .mockResolvedValueOnce(beforeStep)
        .mockResolvedValueOnce(afterStep)
        .mockResolvedValueOnce(reBeforeStep)
        .mockResolvedValueOnce(reAfterStep)
        .mockResolvedValueOnce(reStepToMove);

      mockStepRepo.find.mockResolvedValue([
        { id: 1, templateId: 1, position: 100 },
        { id: 2, templateId: 1, position: 100.4 },
        { id: 3, templateId: 1, position: 100.5 },
      ]);
      mockStepRepo.save.mockImplementation(async (s: unknown) => s);

      const result = await service.move(1, 2, { beforeStepId: 1, afterStepId: 3 });
      expect(mockStepRepo.find).toHaveBeenCalled();
      expect(result.position).toBe(200); // (100 + 300) / 2 after rebalance
    });

    it('throws NotFoundException for unknown template', async () => {
      mockTemplateRepo.existsBy.mockResolvedValue(false);
      await expect(
        service.move(999, 1, { beforeStepId: 0, afterStepId: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
