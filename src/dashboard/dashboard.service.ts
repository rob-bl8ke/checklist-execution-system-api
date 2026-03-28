import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instance } from '../instance/instance.entity';
import { InstanceStep } from '../instance/instance-step.entity';
import { InstanceStatus } from '../instance/enums/instance-status.enum';
import { Todo } from '../todo/todo.entity';

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
  ) {}

  async getToday(): Promise<DashboardResponse> {
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
      const nextStep = instance.nextStepId != null
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

    const todos = await this.todoRepo.find({
      where: { completed: false },
      order: { createdAt: 'DESC' },
    });

    return { runs, todos };
  }
}
