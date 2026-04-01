import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo } from './todo.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoPriority } from './enums/todo-priority.enum';

const PRIORITY_RANK: Record<TodoPriority, number> = {
  [TodoPriority.CRITICAL]: 0,
  [TodoPriority.HIGH]: 1,
  [TodoPriority.NORMAL]: 2,
  [TodoPriority.LOW]: 3,
};

export function sortTodos(todos: Todo[]): Todo[] {
  const incomplete = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => t.completed);

  incomplete.sort((a, b) => {
    // dated items before undated
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    // both dated: ascending
    if (a.dueDate && b.dueDate) {
      const dateCmp = a.dueDate.localeCompare(b.dueDate);
      if (dateCmp !== 0) return dateCmp;
    }
    // priority
    const pCmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pCmp !== 0) return pCmp;
    // newest first
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  completed.sort((a, b) => {
    const aTime = a.completedAt?.getTime() ?? 0;
    const bTime = b.completedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return [...incomplete, ...completed];
}

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly todoRepo: Repository<Todo>,
  ) {}

  async findAll(): Promise<Todo[]> {
    const todos = await this.todoRepo.find();
    return sortTodos(todos);
  }

  async create(dto: CreateTodoDto): Promise<Todo> {
    const todo = this.todoRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ?? null,
      priority: dto.priority ?? TodoPriority.NORMAL,
      completed: false,
      completedAt: null,
    });
    return this.todoRepo.save(todo);
  }

  async update(id: number, dto: UpdateTodoDto): Promise<Todo> {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (!todo) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }

    if (dto.title !== undefined) {
      todo.title = dto.title;
    }
    if (dto.description !== undefined) {
      todo.description = dto.description ?? null;
    }
    if (dto.dueDate !== undefined) {
      todo.dueDate = dto.dueDate ?? null;
    }
    if (dto.priority !== undefined) {
      todo.priority = dto.priority;
    }
    if (dto.completed !== undefined) {
      todo.completed = dto.completed;
      todo.completedAt = dto.completed ? new Date() : null;
    }

    return this.todoRepo.save(todo);
  }

  async remove(id: number): Promise<void> {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (!todo) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    await this.todoRepo.remove(todo);
  }
}

