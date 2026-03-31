import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Template } from './template.entity';

const mockQb = {
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const mockRepo = {
  createQueryBuilder: jest.fn(() => mockQb),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('TemplatesService', () => {
  let service: TemplatesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: getRepositoryToken(Template), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<TemplatesService>(TemplatesService);
  });

  describe('findAll', () => {
    it('returns templates with numeric stepCount', async () => {
      mockQb.getRawMany.mockResolvedValue([
        { id: '1', name: 'Template A', stepCount: '3' },
        { id: '2', name: 'Template B', stepCount: '0' },
      ]);
      const result = await service.findAll();
      expect(result).toEqual([
        { id: 1, name: 'Template A', stepCount: 3 },
        { id: 2, name: 'Template B', stepCount: 0 },
      ]);
    });

    it('returns empty array when no templates exist', async () => {
      mockQb.getRawMany.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns the template when found', async () => {
      const template = { id: 1, name: 'T', steps: [], description: null, variablePrefix: null, variableSuffix: null } as unknown as Template;
      mockRepo.findOne.mockResolvedValue(template);
      await expect(service.findOne(1)).resolves.toBe(template);
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and saves a template', async () => {
      const dto = { name: 'New', description: 'Desc' };
      const entity = { id: 1, ...dto, steps: [] } as unknown as Template;
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);
      await expect(service.create(dto)).resolves.toBe(entity);
      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(entity);
    });
  });

  describe('update', () => {
    it('updates name and returns the saved template', async () => {
      const template = { id: 1, name: 'Old', description: null, steps: [], variablePrefix: null, variableSuffix: null } as unknown as Template;
      const saved = { ...template, name: 'New' } as Template;
      mockRepo.findOne.mockResolvedValue(template);
      mockRepo.save.mockResolvedValue(saved);
      const result = await service.update(1, { name: 'New' });
      expect(result).toBe(saved);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes the template via ORM cascade', async () => {
      const template = { id: 1, name: 'T', steps: [], description: null, variablePrefix: null, variableSuffix: null } as unknown as Template;
      mockRepo.findOne.mockResolvedValue(template);
      mockRepo.remove.mockResolvedValue(template);
      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(mockRepo.remove).toHaveBeenCalledWith(template);
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
