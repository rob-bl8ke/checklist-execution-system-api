import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TemplateStepsService } from './template-steps.service';
import { CreateTemplateStepDto } from './dto/create-template-step.dto';
import { UpdateTemplateStepDto } from './dto/update-template-step.dto';
import { MoveTemplateStepDto } from './dto/move-template-step.dto';

@ApiTags('template-steps')
@Controller('templates/:templateId/steps')
export class TemplateStepsController {
  constructor(private readonly stepsService: TemplateStepsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: CreateTemplateStepDto,
  ) {
    return this.stepsService.create(templateId, dto);
  }

  @Put(':stepId')
  update(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: UpdateTemplateStepDto,
  ) {
    return this.stepsService.update(templateId, stepId, dto);
  }

  @Delete(':stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
  ) {
    await this.stepsService.remove(templateId, stepId);
  }

  @Patch(':stepId/move')
  move(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: MoveTemplateStepDto,
  ) {
    return this.stepsService.move(templateId, stepId, dto);
  }
}
