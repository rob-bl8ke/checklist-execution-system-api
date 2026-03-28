import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TodosService } from './todos.service';
import { Todo } from './todo.entity';

const mockTodoRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

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
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns an empty array when no todos exist', async () => {
      mockTodoRepo.find.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
      expect(mockTodoRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('returns all todos ordered by createdAt DESC', async () => {
      const todos = [
        { id: 2, title: 'Second', completed: false },
        { id: 1, title: 'First', completed: false },
      ];
      mockTodoRepo.find.mockResolvedValue(todos);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a todo with title only', async () => {
      const created = { id: 1, title: 'My Todo', description: null, completed: false, completedAt: null };
      mockTodoRepo.create.mockReturnValue(created);
      mockTodoRepo.save.mockResolvedValue({ ...created });

      const result = await service.create({ title: 'My Todo' });
      expect(mockTodoRepo.create).toHaveBeenCalledWith({
        title: 'My Todo',
        description: null,
        completed: false,
        completedAt: null,
      });
      expect(result.title).toBe('My Todo');
      expect(result.description).toBeNull();
    });

    it('creates a todo with title and description', async () => {
      const created = { id: 1, title: 'T', description: 'Desc', completed: false, completedAt: null };
      mockTodoRepo.create.mockReturnValue(created);
      mockTodoRepo.save.mockResolvedValue({ ...created });

      const result = await service.create({ title: 'T', description: 'Desc' });
      expect(mockTodoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Desc' }),
      );
      expect(result.description).toBe('Desc');
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('throws NotFoundException when todo does not exist', async () => {
      mockTodoRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates the title only', async () => {
      const existing = { id: 1, title: 'Old', description: null, completed: false, completedAt: null };
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { title: 'New' });
      expect(result.title).toBe('New');
      expect(result.completed).toBe(false);
    });

    it('sets completedAt when completed is toggled to true', async () => {
      const existing = { id: 1, title: 'T', description: null, completed: false, completedAt: null };
      mockTodoRepo.findOne.mockResolvedValue({ ...existing });
      mockTodoRepo.save.mockImplementation(async (t: Todo) => t);

      const result = await service.update(1, { completed: true });
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when completed is toggled to false', async () => {
      const existing = { id: 1, title: 'T', description: null, completed: true, completedAt: new Date() };
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
      const existing = { id: 1, title: 'T', completed: false };
      mockTodoRepo.findOne.mockResolvedValue(existing);
      mockTodoRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(mockTodoRepo.remove).toHaveBeenCalledWith(existing);
    });
  });
});
