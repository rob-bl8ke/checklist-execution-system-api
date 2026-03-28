import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Checklist Execution System API')
    .setDescription(
      'REST API for the Runbook + Todo manager — templates, runs, and todos.',
    )
    .setVersion('1.0')
    .addTag('templates')
    .addTag('template-steps')
    .addTag('instances')
    .addTag('instance-steps')
    .addTag('todos')
    .addTag('dashboard')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
