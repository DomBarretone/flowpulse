import { Global, Module } from '@nestjs/common';
import { JsonLoggerService } from './json-logger.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { SanitizerService } from '../sanitization/sanitizer.service';

@Global()
@Module({
  providers: [SanitizerService, JsonLoggerService, HttpLoggingInterceptor],
  exports: [SanitizerService, JsonLoggerService, HttpLoggingInterceptor],
})
export class LoggingModule {}
