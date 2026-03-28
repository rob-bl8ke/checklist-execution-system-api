import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateStep } from './template-step.entity';
import { Template } from '../template/template.entity';
import { CreateTemplateStepDto } from './dto/create-template-step.dto';
import { UpdateTemplateStepDto } from './dto/update-template-step.dto';
import { MoveTemplateStepDto } from './dto/move-template-step.dto';

@Injectable()
export class TemplateStepsService {
  constructor(
    @InjectRepository(TemplateStep)
    private readonly stepRepo: Repository<TemplateStep>,
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
  ) {}

  private async assertTemplateExists(templateId: number): Promise<void> {
    const exists = await this.templateRepo.existsBy({ id: templateId });
    if (!exists) {
      throw new NotFoundException(`Template with id ${templateId} not found`);
    }
  }

  private async findOneStep(
    templateId: number,
    stepId: number,
  ): Promise<TemplateStep> {
    const step = await this.stepRepo.findOne({
      where: { id: stepId, templateId },
    });
    if (!step) {
      throw new NotFoundException(
        `Step with id ${stepId} not found in template ${templateId}`,
      );
    }
    return step;
  }

  async create(
    templateId: number,
    dto: CreateTemplateStepDto,
  ): Promise<TemplateStep> {
    await this.assertTemplateExists(templateId);
    const lastStep = await this.stepRepo.findOne({
      where: { templateId },
      order: { position: 'DESC' },
    });
    const position = lastStep ? lastStep.position + 100 : 100;
    const step = this.stepRepo.create({ ...dto, templateId, position });
    return this.stepRepo.save(step);
  }

  async update(
    templateId: number,
    stepId: number,
    dto: UpdateTemplateStepDto,
  ): Promise<TemplateStep> {
    const step = await this.findOneStep(templateId, stepId);
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    Object.assign(step, patch);
    return this.stepRepo.save(step);
  }

  async remove(templateId: number, stepId: number): Promise<void> {
    const step = await this.findOneStep(templateId, stepId);
    await this.stepRepo.remove(step);
  }

  async move(
    templateId: number,
    stepId: number,
    dto: MoveTemplateStepDto,
  ): Promise<TemplateStep> {
    await this.assertTemplateExists(templateId);
    const { beforeStepId, afterStepId } = dto;

    if (beforeStepId == null && afterStepId == null) {
      throw new BadRequestException(
        'At least one of beforeStepId or afterStepId must be provided',
      );
    }

    const step = await this.findOneStep(templateId, stepId);
    let newPosition: number;

    if (beforeStepId != null && afterStepId != null) {
      const beforeStep = await this.findOneStep(templateId, beforeStepId);
      const afterStep = await this.findOneStep(templateId, afterStepId);
      const gap = afterStep.position - beforeStep.position;

      if (gap < 1) {
        await this.rebalance(templateId);
        const reBefore = await this.findOneStep(templateId, beforeStepId);
        const reAfter = await this.findOneStep(templateId, afterStepId);
        newPosition = (reBefore.position + reAfter.position) / 2;
        // Refetch the step being moved to use the post-rebalance entity
        const reStep = await this.findOneStep(templateId, stepId);
        reStep.position = newPosition;
        return this.stepRepo.save(reStep);
      }

      newPosition = (beforeStep.position + afterStep.position) / 2;
    } else if (afterStepId != null) {
      // Moving to first position
      const afterStep = await this.findOneStep(templateId, afterStepId);
      newPosition = afterStep.position / 2;
    } else {
      // Moving to last position (beforeStepId != null)
      const beforeStep = await this.findOneStep(templateId, beforeStepId!);
      newPosition = beforeStep.position + 100;
    }

    step.position = newPosition;
    return this.stepRepo.save(step);
  }

  private async rebalance(templateId: number): Promise<void> {
    const steps = await this.stepRepo.find({
      where: { templateId },
      order: { position: 'ASC' },
    });
    for (let i = 0; i < steps.length; i++) {
      steps[i].position = (i + 1) * 100;
    }
    await this.stepRepo.save(steps);
  }
}
