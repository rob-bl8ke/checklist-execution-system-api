import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Template } from './template/template.entity';
import { TemplateStep } from './template-step/template-step.entity';
import { Instance } from './instance/instance.entity';
import { InstanceStep } from './instance/instance-step.entity';
import { TemplatesModule } from './template/template.module';
import { TemplateStepModule } from './template-step/template-step.module';
import { InstanceModule } from './instance/instance.module';
import { Todo } from './todo/todo.entity';
import { TodoModule } from './todo/todo.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReminderDefinition } from './reminder/reminder-definition.entity';
import { ReminderOccurrenceState } from './reminder/reminder-occurrence-state.entity';
import { ReminderModule } from './reminder/reminder.module';
import { Note } from './note/note.entity';
import { NoteVersion } from './note/note-version.entity';
import { NoteTag } from './note/note-tag.entity';
import { NoteModule } from './note/note.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH ?? 'checklist.db',
      entities: [
        Template,
        TemplateStep,
        Instance,
        InstanceStep,
        Todo,
        ReminderDefinition,
        ReminderOccurrenceState,
        Note,
        NoteVersion,
        NoteTag,
      ],
      synchronize: false,
      migrations: ['dist/database/migrations/*.js'],
      migrationsRun: false,
    }),
    TemplatesModule,
    TemplateStepModule,
    InstanceModule,
    TodoModule,
    DashboardModule,
    ReminderModule,
    NoteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
