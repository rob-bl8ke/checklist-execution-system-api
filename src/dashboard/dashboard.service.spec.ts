import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Instance } from '../instance/instance.entity';
import { InstanceStep } from '../instance/instance-step.entity';
import { InstanceStatus } from '../instance/enums/instance-status.enum';
import { Todo } from '../todo/todo.entity';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const mockInstanceRepo = {
  find: jest.fn(),
};

const mockStepRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockTodoRepo = {
  find: jest.fn(),
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStepRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Instance), useValue: mockInstanceRepo },
        { provide: getRepositoryToken(InstanceStep), useValue: mockStepRepo },
        { provide: getRepositoryToken(Todo), useValue: mockTodoRepo },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  // ---------------------------------------------------------------------------
  // getToday — empty state
  // ---------------------------------------------------------------------------

  describe('getToday', () => {
    it('returns empty runs and todos when nothing is active', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);

      const result = await service.getToday();
      expect(result).toEqual({ runs: [], todos: [] });
      // Should not query steps when no instances
      expect(mockStepRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns only IN_PROGRESS instances', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);

      await service.getToday();
      expect(mockInstanceRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: InstanceStatus.IN_PROGRESS },
        }),
      );
    });

    it('returns only incomplete todos', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);

      await service.getToday();
      expect(mockTodoRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { completed: false },
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('maps instance progress correctly', async () => {
      const steps = [
        { id: 1, instanceId: 10, completed: true },
        { id: 2, instanceId: 10, completed: true },
        { id: 3, instanceId: 10, completed: false },
      ];
      const instance = {
        id: 10,
        name: 'Run A',
        status: InstanceStatus.IN_PROGRESS,
        nextStepId: 3,
        steps,
      };
      mockInstanceRepo.find.mockResolvedValue([instance]);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          step_id: 3,
          step_instance_id: 10,
          step_title: 'Step Three',
          step_rendered_instructions: 'Do X',
        },
      ]);
      mockTodoRepo.find.mockResolvedValue([]);

      const result = await service.getToday();
      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].progress).toEqual({ completed: 2, total: 3 });
      expect(result.runs[0].nextStep).toEqual({
        id: 3,
        title: 'Step Three',
        renderedInstructions: 'Do X',
      });
    });

    it('sets nextStep to null when instance has no nextStepId', async () => {
      const instance = {
        id: 20,
        name: 'Run B',
        status: InstanceStatus.IN_PROGRESS,
        nextStepId: null,
        steps: [{ id: 5, instanceId: 20, completed: true }],
      };
      mockInstanceRepo.find.mockResolvedValue([instance]);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);

      const result = await service.getToday();
      expect(result.runs[0].nextStep).toBeNull();
    });

    it('returns incomplete todos populated in response', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      const todos = [
        { id: 1, title: 'Todo A', completed: false },
        { id: 2, title: 'Todo B', completed: false },
      ];
      mockTodoRepo.find.mockResolvedValue(todos);

      const result = await service.getToday();
      expect(result.todos).toHaveLength(2);
      expect(result.todos[0].title).toBe('Todo A');
    });
  });
});
