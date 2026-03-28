import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instance } from './instance.entity';
import { InstanceStep } from './instance-step.entity';
import { Template } from '../template/template.entity';
import { InstancesService } from './instances.service';
import { InstancesController } from './instances.controller';
import { VariableExtractionService } from './variable-extraction.service';

@Module({
  imports: [TypeOrmModule.forFeature([Instance, InstanceStep, Template])],
  controllers: [InstancesController],
  providers: [InstancesService, VariableExtractionService],
  exports: [InstancesService, VariableExtractionService],
})
export class InstanceModule {}
