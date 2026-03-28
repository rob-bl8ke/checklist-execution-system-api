import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo } from './todo.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly todoRepo: Repository<Todo>,
  ) {}

  findAll(): Promise<Todo[]> {
    return this.todoRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateTodoDto): Promise<Todo> {
    const todo = this.todoRepo.create({
      title: dto.title,
      description: dto.description ?? null,
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
      todo.description = dto.description;
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
