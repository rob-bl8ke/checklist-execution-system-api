import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from './template.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { ReminderDefinition } from '../reminder/reminder-definition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Template, ReminderDefinition])],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
