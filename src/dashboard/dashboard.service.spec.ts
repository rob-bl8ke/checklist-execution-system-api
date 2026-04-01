import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Instance } from '../instance/instance.entity';
import { InstanceStep } from '../instance/instance-step.entity';
import { InstanceStatus } from '../instance/enums/instance-status.enum';
import { Todo } from '../todo/todo.entity';
import { RemindersService } from '../reminder/reminders.service';

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

const mockRemindersService = {
  getAgenda: jest.fn(),
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStepRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    // Default: no reminders
    mockRemindersService.getAgenda.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Instance), useValue: mockInstanceRepo },
        { provide: getRepositoryToken(InstanceStep), useValue: mockStepRepo },
        { provide: getRepositoryToken(Todo), useValue: mockTodoRepo },
        { provide: RemindersService, useValue: mockRemindersService },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  // ---------------------------------------------------------------------------
  // getToday — empty state
  // ---------------------------------------------------------------------------

  describe('getToday', () => {
    it('returns empty runs, todos, and reminders when nothing is active', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);

      const result = await service.getToday();
      expect(result).toEqual({
        runs: [],
        todos: [],
        reminders: { dueNow: [], upcoming: [] },
      });
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

    // -------------------------------------------------------------------------
    // Reminders integration
    // -------------------------------------------------------------------------

    it('places occurrences in dueNow when isInPrepWindow and OPEN', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);
      const dueItem = {
        reminderId: 1,
        title: 'Daily Standup',
        occurrenceDate: '2026-04-01',
        status: 'OPEN',
        isInPrepWindow: true,
        isOverdue: false,
        daysUntilOccurrence: 0,
      };
      mockRemindersService.getAgenda.mockResolvedValue([dueItem]);

      const result = await service.getToday(7);
      expect(result.reminders.dueNow).toHaveLength(1);
      expect(result.reminders.dueNow[0].reminderId).toBe(1);
      expect(result.reminders.upcoming).toHaveLength(0);
    });

    it('places occurrences in upcoming when not in prep window and OPEN', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);
      const upcomingItem = {
        reminderId: 2,
        title: 'Sprint Retro',
        occurrenceDate: '2026-04-05',
        status: 'OPEN',
        isInPrepWindow: false,
        isOverdue: false,
        daysUntilOccurrence: 4,
      };
      mockRemindersService.getAgenda.mockResolvedValue([upcomingItem]);

      const result = await service.getToday(7);
      expect(result.reminders.upcoming).toHaveLength(1);
      expect(result.reminders.dueNow).toHaveLength(0);
    });

    it('excludes completed/dismissed occurrences from both dueNow and upcoming', async () => {
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue([]);
      const completedItem = {
        reminderId: 3,
        title: 'Done Reminder',
        occurrenceDate: '2026-04-01',
        status: 'COMPLETED',
        isInPrepWindow: true,
        isOverdue: false,
        daysUntilOccurrence: 0,
      };
      const dismissedItem = {
        reminderId: 4,
        title: 'Dismissed Reminder',
        occurrenceDate: '2026-04-03',
        status: 'DISMISSED',
        isInPrepWindow: false,
        isOverdue: false,
        daysUntilOccurrence: 2,
      };
      mockRemindersService.getAgenda.mockResolvedValue([
        completedItem,
        dismissedItem,
      ]);

      const result = await service.getToday(7);
      expect(result.reminders.dueNow).toHaveLength(0);
      expect(result.reminders.upcoming).toHaveLength(0);
    });

    it('runs and todos remain unaffected by reminder state', async () => {
      const todos = [{ id: 1, title: 'A Todo', completed: false }];
      mockInstanceRepo.find.mockResolvedValue([]);
      mockTodoRepo.find.mockResolvedValue(todos);
      mockRemindersService.getAgenda.mockResolvedValue([
        {
          reminderId: 1,
          title: 'A Reminder',
          occurrenceDate: '2026-04-01',
          status: 'OPEN',
          isInPrepWindow: true,
          isOverdue: false,
          daysUntilOccurrence: 0,
        },
      ]);

      const result = await service.getToday(7);
      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('A Todo');
      expect(result.runs).toHaveLength(0);
    });
  });
});
