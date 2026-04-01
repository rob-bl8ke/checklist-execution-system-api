import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instance } from '../instance/instance.entity';
import { InstanceStep } from '../instance/instance-step.entity';
import { InstanceStatus } from '../instance/enums/instance-status.enum';
import { Todo } from '../todo/todo.entity';
import { sortTodos } from '../todo/todos.service';
import { RemindersService, ReminderAgendaItem } from '../reminder/reminders.service';

export interface DashboardNextStep {
  id: number;
  title: string;
  renderedInstructions: string | null;
}

export interface DashboardRun {
  id: number;
  name: string;
  progress: { completed: number; total: number };
  nextStep: DashboardNextStep | null;
}

export interface DashboardResponse {
  runs: DashboardRun[];
  todos: Todo[];
  reminders: {
    dueNow: ReminderAgendaItem[];
    upcoming: ReminderAgendaItem[];
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Instance)
    private readonly instanceRepo: Repository<Instance>,
    @InjectRepository(InstanceStep)
    private readonly stepRepo: Repository<InstanceStep>,
    @InjectRepository(Todo)
    private readonly todoRepo: Repository<Todo>,
    private readonly remindersService: RemindersService,
  ) {}

  async getToday(upcomingDays = 7): Promise<DashboardResponse> {
    // Fetch all IN_PROGRESS instances with their steps (for progress counts)
    const instances = await this.instanceRepo.find({
      where: { status: InstanceStatus.IN_PROGRESS },
      relations: { steps: true },
    });

    // Fetch next steps in one query using next_step_id join
    const instanceIds = instances.map((i) => i.id);
    const nextStepMap = new Map<number, InstanceStep>();

    if (instanceIds.length > 0) {
      const nextSteps = await this.stepRepo
        .createQueryBuilder('step')
        .innerJoin(
          Instance,
          'instance',
          'instance.next_step_id = step.id AND instance.id IN (:...ids)',
          { ids: instanceIds },
        )
        .select([
          'step.id',
          'step.instanceId',
          'step.title',
          'step.renderedInstructions',
        ])
        .getRawMany<{
          step_id: number;
          step_instance_id: number;
          step_title: string;
          step_rendered_instructions: string | null;
        }>();

      for (const row of nextSteps) {
        nextStepMap.set(row.step_instance_id, {
          id: row.step_id,
          instanceId: row.step_instance_id,
          stepOrder: 0,
          title: row.step_title,
          renderedInstructions: row.step_rendered_instructions,
          instructionsTemplate: null,
          completed: false,
          completedAt: null,
          notes: null,
          instance: null as unknown as Instance,
        });
      }
    }

    const runs: DashboardRun[] = instances.map((instance) => {
      const total = instance.steps.length;
      const completed = instance.steps.filter((s) => s.completed).length;
      const nextStep =
        instance.nextStepId != null
          ? (nextStepMap.get(instance.id) ?? null)
          : null;

      return {
        id: instance.id,
        name: instance.name,
        progress: { completed, total },
        nextStep: nextStep
          ? {
              id: nextStep.id,
              title: nextStep.title,
              renderedInstructions: nextStep.renderedInstructions,
            }
          : null,
      };
    });

    const allTodos = await this.todoRepo.find();
    const todos = sortTodos(allTodos).filter((t) => !t.completed);

    // Reminder occurrences
    const today = new Date().toISOString().slice(0, 10);
    const horizonMs =
      new Date(`${today}T00:00:00Z`).getTime() + upcomingDays * 86_400_000;
    const horizon = new Date(horizonMs).toISOString().slice(0, 10);

    let allAgenda: ReminderAgendaItem[] = [];
    if (upcomingDays > 0) {
      allAgenda = await this.remindersService.getAgenda(today, horizon);
    } else {
      // upcomingDays = 0: only dueNow (prep window already started)
      allAgenda = await this.remindersService.getAgenda(today, today);
    }

    const dueNow = allAgenda.filter(
      (item) => item.isInPrepWindow && item.status === 'OPEN',
    );
    const upcoming = allAgenda.filter(
      (item) =>
        !item.isInPrepWindow &&
        item.status === 'OPEN' &&
        item.occurrenceDate <= horizon,
    );

    return { runs, todos, reminders: { dueNow, upcoming } };
  }
}

