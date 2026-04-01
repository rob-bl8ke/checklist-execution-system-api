import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TodosService, sortTodos } from './todos.service';
import { Todo } from './todo.entity';
import { TodoPriority } from './enums/todo-priority.enum';

const mockTodoRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    title: 'Test',
    description: null,
    dueDate: null,
    priority: TodoPriority.NORMAL,
    completed: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: null,
    ...overrides,
  } as Todo;
}

describe('TodosService', () => {
  let service: TodosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: getRepositoryToken(Todo), useValue: mockTodoRepo },
      ],
    }).compile();
    service = module.get<TodosService>(TodosService);
  });

  // ---------------------------------------------------------------------------
  // sortTodos (pure function)
  // ---------------------------------------------------------------------------

  describe('sortTodos', () => {
    it('returns empty array unchanged', () => {
      expect(sortTodos([])).toEqual([]);
    });

    it('puts dated incomplete todos before undated incomplete todos', () => {
      const undated = makeTodo({ id: 1, dueDate: null });
      const dated = makeTodo({ id: 2, dueDate: '2026-04-10' });
      const result = sortTodos([undated, dated]);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it('sorts dated incomplete todos by dueDate ascending', () => {
      const later = makeTodo({ id: 1, dueDate: '2026-04-10' });
      const earlier = makeTodo({ id: 2, dueDate: '2026-04-05' });
      const result = sortTodos([later, earlier]);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it('sorts undated incomplete todos by priority then newest', () => {
      const low = makeTodo({ id: 1, priority: TodoPriority.LOW, createdAt: new Date('2026-03-01') });
      const critical = makeTodo({ id: 2, priority: TodoPriority.CRITICAL, createdAt: new Date('2026-03-01') });
      const result = sortTodos([low, critical]);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it('sorts same-priority undated todos by createdAt descending', () => {
      const older = makeTodo({ id: 1, createdAt: new Date('2026-01-01') });
      const newer = makeTodo({ id: 2, createdAt: new Date('2026-03-01') });
      const result = sortTodos([older, newer]);
      expect(result[0].id).toBe(2);
    });

    it('puts completed todos after all incomplete todos', () => {
      const incomplete = makeTodo({ id: 1, completed: false });
      const completed = makeTodo({ id: 2, completed: true, completedAt: new Date() });
      const result = sortTodos([completed, incomplete]);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('sorts completed todos by completedAt descending', () => {
      const older = makeTodo({ id: 1, completed: true, completedAt: new Date('2026-01-01') });
      const newer = makeTodo({ id: 2, completed: true, completedAt: new Date('2026-03-01') });
      const result = sortTodos([older, newer]);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it('overdue dated todo sorts before future dated todo', () => {
      const overdue = makeTodo({ id: 1, dueDate: '2026-03-01' });
      const future = makeTodo({ id: 2, dueDate: '2026-05-01' });
      const result = sortTodos([future, overdue]);
      expect(result[0].id).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns an empty array when no todos exist', async () => {
      mockTodoRepo.find.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
      expect(mockTodoRepo.find).toHaveBeenCalledWith();
    });

    it('returns todos sorted by sortTodos ordering', async () => {
      const todos = [
        makeTodo({ id: 1, completed: true, completedAt: new Date() }),
        makeTodo({ id: 2, completed: false }),
      ];
      mockTodoRepo.find.mockResolvedValue(todos);
      const result = await service.findAll();
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a todo with title only, applying defaults', async () => {
      const created = makeTodo({ id: 1, title: 'My Todo' });
      mockTodoRepo.create.mockReturnValue(created);
      mockTodoRepo.save.mockResolvedValue({ ...created });

      const result = await service.create({ title: 'My Todo' });
      expect(mockTodoRepo.create).toHaveBeenCalledWith({
        title: 'My Todo',
        description: null,
        dueDate: null,
        priority: TodoPriority.NORMAL,
        completed: false,
        completedAt: null,
      });
      expect(result.priority).toBe(TodoPriority.NORMAL);
      expect(result.dueDate).toBeNull();
    });

    it('creates a todo with dueDate and priority', async () => {
      const created = makeTodo({ id: 1, dueDate: '2026-04-10', priority: TodoPriority.HIGH });
      mockTodoRepo.create.mockReturnValue(created);
      mockTodoRepo.save.mockResolvedValue({ ...created });

      await service.create({ title: 'T', dueDate: '2026-04-10', priority: TodoPriority.HIGH });
      expect(mockTodoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: '2026-04-10', priority: TodoPriority.HIGH }),
      );
    });

    it('creates a todo with description', async () => {
      const created = makeTodo({ id: 1, description: 'Detail' });
      mockTodoRepo.create.mockReturnValue(created);
      mockTodoRepo.save.mockResolvedValue({ ...created });

      const result = await service.create({ title: 'T', description: 'Detail' });
      expect(result.description).toBe('Detail');
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('throws NotFoundException when todo does not exist', async () => {
      mockTodoRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates the title only', async () => {
      const existing = makeTodo({ id: 1, title: 'Old' });
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { title: 'New' });
      expect(result.title).toBe('New');
    });

    it('updates dueDate', async () => {
      const existing = makeTodo({ id: 1 });
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { dueDate: '2026-05-01' });
      expect(result.dueDate).toBe('2026-05-01');
    });

    it('clears dueDate when null is passed', async () => {
      const existing = makeTodo({ id: 1, dueDate: '2026-04-01' });
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { dueDate: null });
      expect(result.dueDate).toBeNull();
    });

    it('clears description when null is passed', async () => {
      const existing = makeTodo({ id: 1, description: 'old' });
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { description: null });
      expect(result.description).toBeNull();
    });

    it('updates priority', async () => {
      const existing = makeTodo({ id: 1 });
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { priority: TodoPriority.CRITICAL });
      expect(result.priority).toBe(TodoPriority.CRITICAL);
    });

    it('sets completedAt when completed is toggled to true', async () => {
      const existing = makeTodo({ id: 1, completed: false });
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { completed: true });
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when completed is toggled to false', async () => {
      const existing = makeTodo({ id: 1, completed: true, completedAt: new Date() });
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { completed: false });
      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('throws NotFoundException when todo does not exist', async () => {
      mockTodoRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('removes the todo when it exists', async () => {
      const existing = makeTodo({ id: 1 });
      mockTodoRepo.findOne.mockResolvedValue(existing);
      mockTodoRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(mockTodoRepo.remove).toHaveBeenCalledWith(existing);
    });
  });
});
