import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Template } from './template/template.entity';
import { TemplateStep } from './template-step/template-step.entity';
import { TemplatesModule } from './template/template.module';
import { TemplateStepModule } from './template-step/template-step.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'checklist.db',
      entities: [Template, TemplateStep],
      synchronize: false,
      migrations: ['dist/database/migrations/*.js'],
      migrationsRun: false,
    }),
    TemplatesModule,
    TemplateStepModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
