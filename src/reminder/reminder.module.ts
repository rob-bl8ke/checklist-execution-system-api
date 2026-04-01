import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderDefinition } from './reminder-definition.entity';
import { ReminderOccurrenceState } from './reminder-occurrence-state.entity';
import { Template } from '../template/template.entity';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReminderDefinition,
      ReminderOccurrenceState,
      Template,
    ]),
  ],
  controllers: [RemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class ReminderModule {}
