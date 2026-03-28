import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InstancesService } from './instances.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { UpdateInstanceStatusDto } from './dto/update-instance-status.dto';

@ApiTags('instances')
@Controller('instances')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInstanceDto) {
    return this.instancesService.create(dto);
  }

  @Get()
  findAll() {
    return this.instancesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.instancesService.findOne(id);
  }

  @Patch(':instanceId/steps/:stepId')
  completeStep(
    @Param('instanceId', ParseIntPipe) instanceId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: CompleteStepDto,
  ) {
    return this.instancesService.completeStep(instanceId, stepId, dto);
  }

  @Patch(':id')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstanceStatusDto,
  ) {
    return this.instancesService.updateStatus(id, dto);
  }
}
