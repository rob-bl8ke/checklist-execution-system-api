import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instance } from '../instance/instance.entity';
import { InstanceStep } from '../instance/instance-step.entity';
import { Todo } from '../todo/todo.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Instance, InstanceStep, Todo])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
