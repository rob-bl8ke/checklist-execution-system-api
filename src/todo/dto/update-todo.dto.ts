import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TodoPriority } from '../enums/todo-priority.enum';

export class UpdateTodoDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsDateString()
  @IsOptional()
  dueDate?: string | null;

  @IsEnum(TodoPriority)
  @IsOptional()
  priority?: TodoPriority;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
