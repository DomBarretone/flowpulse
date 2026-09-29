import './tracing';
import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemDetailsExceptionFilter } from './common/filters/problem-details-exception.filter';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { HttpLoggingInterceptor } from './common/logging/http-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(JsonLoggerService));
  app.useGlobalInterceptors(app.get(HttpLoggingInterceptor));

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-request-id',
      'traceparent',
      'tracestate',
    ],
    exposedHeaders: ['x-request-id', 'x-trace-id'],
  });

  // Global API Prefix /api/v1
  app.setGlobalPrefix('api/v1');

  // Global RFC 7807 Problem Details Exception Filter
  app.useGlobalFilters(new ProblemDetailsExceptionFilter());

  // Global ValidationPipe rejecting invalid/unknown fields with 422 Unprocessable Entity
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  // OpenAPI / Swagger setup at /api/docs
  const config = new DocumentBuilder()
    .setTitle('FlowPulse API')
    .setDescription('FlowPulse Observability & Incident Response API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.BACKEND_PORT || 3001;
  await app.listen(port);
}

void bootstrap();
