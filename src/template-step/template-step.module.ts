import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateStep } from './template-step.entity';
import { Template } from '../template/template.entity';
import { TemplateStepsService } from './template-steps.service';
import { TemplateStepsController } from './template-steps.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TemplateStep, Template])],
  controllers: [TemplateStepsController],
  providers: [TemplateStepsService],
  exports: [TemplateStepsService],
})
export class TemplateStepModule {}
