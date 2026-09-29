import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { JsonLoggerService } from './json-logger.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: JsonLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const startTime = Date.now();
    const method = req.method;
    const path = req.originalUrl || req.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode;
          this.logger.log({
            event_name: 'http_request_completed',
            method,
            path,
            status_code: statusCode,
            duration_ms: durationMs,
          });
        },
        error: (err: unknown) => {
          const durationMs = Date.now() - startTime;
          let statusCode = 500;
          if (err && typeof err === 'object') {
            const errObj = err as Record<string, unknown>;
            if (typeof errObj.getStatus === 'function') {
              const resStatus = (errObj.getStatus as () => unknown)();
              if (typeof resStatus === 'number') {
                statusCode = resStatus;
              }
            } else if (typeof errObj.status === 'number') {
              statusCode = errObj.status;
            } else if (typeof errObj.statusCode === 'number') {
              statusCode = errObj.statusCode;
            }
          }
          this.logger.log({
            event_name: 'http_request_completed',
            method,
            path,
            status_code: statusCode,
            duration_ms: durationMs,
          });
        },
      }),
    );
  }
}
