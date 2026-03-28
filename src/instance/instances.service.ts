import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Instance } from './instance.entity';
import { InstanceStep } from './instance-step.entity';
import { InstanceStatus } from './enums/instance-status.enum';
import { Template } from '../template/template.entity';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { UpdateInstanceStatusDto } from './dto/update-instance-status.dto';

export interface NextStepSummary {
  id: number;
  title: string;
}

export interface Progress {
  completed: number;
  total: number;
}

export interface InstanceSummary {
  id: number;
  name: string;
  status: InstanceStatus;
  createdAt: Date;
  nextStep: NextStepSummary | null;
  progress: Progress;
}

@Injectable()
export class InstancesService {
  constructor(
    @InjectRepository(Instance)
    private readonly instanceRepo: Repository<Instance>,
    @InjectRepository(InstanceStep)
    private readonly stepRepo: Repository<InstanceStep>,
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateInstanceDto): Promise<Instance> {
    const template = await this.templateRepo.findOne({
      where: { id: dto.templateId },
      relations: { steps: true },
      order: { steps: { position: 'ASC' } },
    });
    if (!template) {
      throw new NotFoundException(
        `Template with id ${dto.templateId} not found`,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1. Create instance (nextStepId = null initially to avoid circular FK)
      const instance = qr.manager.create(Instance, {
        templateId: dto.templateId,
        name: dto.name,
        variables: dto.variables ?? null,
        status: InstanceStatus.IN_PROGRESS,
        nextStepId: null,
      });
      const savedInstance = await qr.manager.save(Instance, instance);

      // 2. Copy template steps as instance steps
      const instanceSteps: InstanceStep[] = [];
      for (let i = 0; i < template.steps.length; i++) {
        const ts = template.steps[i];
        const step = qr.manager.create(InstanceStep, {
          instanceId: savedInstance.id,
          stepOrder: i + 1,
          title: ts.title,
          instructionsTemplate: ts.instructions,
          renderedInstructions: this.renderInstructions(
            ts.instructions,
            dto.variables ?? null,
          ),
          completed: false,
          completedAt: null,
          notes: null,
        });
        const savedStep = await qr.manager.save(InstanceStep, step);
        instanceSteps.push(savedStep);
      }

      // 3. Set next_step_id to the first step (resolves circular-FK)
      if (instanceSteps.length > 0) {
        savedInstance.nextStepId = instanceSteps[0].id;
        await qr.manager.save(Instance, savedInstance);
      }

      await qr.commitTransaction();

      savedInstance.steps = instanceSteps;
      return savedInstance;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findAll(): Promise<InstanceSummary[]> {
    const instances = await this.instanceRepo.find({
      relations: { steps: true },
      order: { steps: { stepOrder: 'ASC' } },
    });
    return instances.map((i) => this.toSummary(i));
  }

  async findOne(id: number): Promise<Instance & { nextStep: NextStepSummary | null; progress: Progress }> {
    const instance = await this.loadWithSteps(id);
    return Object.assign(instance, this.computeMeta(instance));
  }

  // ---------------------------------------------------------------------------
  // Step completion toggle (tasks 3.6 + 3.7 auto-status)
  // ---------------------------------------------------------------------------

  async completeStep(
    instanceId: number,
    stepId: number,
    dto: CompleteStepDto,
  ): Promise<InstanceStep> {
    const instance = await this.loadWithSteps(instanceId);

    if (instance.status === InstanceStatus.ABANDONED) {
      throw new ConflictException(
        'Cannot toggle steps on an ABANDONED instance',
      );
    }

    const step = instance.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(
        `Step ${stepId} not found in instance ${instanceId}`,
      );
    }

    step.completed = dto.completed;
    step.completedAt = dto.completed ? new Date() : null;
    await this.stepRepo.save(step);

    // Reflect updated step in the in-memory array
    const updatedSteps = instance.steps.map((s) =>
      s.id === stepId ? step : s,
    );

    // Recalculate next_step_id
    const nextIncomplete = updatedSteps
      .filter((s) => !s.completed)
      .sort((a, b) => a.stepOrder - b.stepOrder)[0] ?? null;

    instance.nextStepId = nextIncomplete?.id ?? null;

    // Auto-transition to COMPLETED when all steps done
    if (dto.completed && updatedSteps.every((s) => s.completed)) {
      instance.status = InstanceStatus.COMPLETED;
    }

    // Revert to IN_PROGRESS when un-completing on a COMPLETED instance
    if (!dto.completed && instance.status === InstanceStatus.COMPLETED) {
      instance.status = InstanceStatus.IN_PROGRESS;
    }

    await this.instanceRepo.save(instance);
    return step;
  }

  // ---------------------------------------------------------------------------
  // Status update (task 3.7 ABANDONED endpoint)
  // ---------------------------------------------------------------------------

  async updateStatus(
    id: number,
    dto: UpdateInstanceStatusDto,
  ): Promise<Instance> {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) {
      throw new NotFoundException(`Instance with id ${id} not found`);
    }
    instance.status = dto.status;
    return this.instanceRepo.save(instance);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async loadWithSteps(id: number): Promise<Instance> {
    const instance = await this.instanceRepo.findOne({
      where: { id },
      relations: { steps: true },
      order: { steps: { stepOrder: 'ASC' } },
    });
    if (!instance) {
      throw new NotFoundException(`Instance with id ${id} not found`);
    }
    return instance;
  }

  private toSummary(instance: Instance): InstanceSummary {
    return {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      createdAt: instance.createdAt,
      ...this.computeMeta(instance),
    };
  }

  private computeMeta(instance: Instance): {
    nextStep: NextStepSummary | null;
    progress: Progress;
  } {
    const steps = instance.steps ?? [];
    const completed = steps.filter((s) => s.completed).length;
    const total = steps.length;

    const nextStepEntity = instance.nextStepId
      ? (steps.find((s) => s.id === instance.nextStepId) ?? null)
      : null;
    const nextStep = nextStepEntity
      ? { id: nextStepEntity.id, title: nextStepEntity.title }
      : null;

    return { nextStep, progress: { completed, total } };
  }

  private renderInstructions(
    template: string | null,
    variables: Record<string, string> | null,
  ): string | null {
    if (!template) return null;
    if (!variables || Object.keys(variables).length === 0) return template;
    return template.replace(
      /{{(.*?)}}/g,
      (_, key: string) => variables[key.trim()] ?? `{{${key}}}`,
    );
  }
}
