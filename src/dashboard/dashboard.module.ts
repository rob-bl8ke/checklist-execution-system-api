import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instance } from '../instance/instance.entity';
import { InstanceStep } from '../instance/instance-step.entity';
import { Todo } from '../todo/todo.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ReminderModule } from '../reminder/reminder.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instance, InstanceStep, Todo]),
    ReminderModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
