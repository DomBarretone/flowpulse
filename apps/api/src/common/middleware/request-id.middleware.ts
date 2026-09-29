import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { trace } from '@opentelemetry/api';
import { requestContext } from '../logging/request-context';

export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-trace-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId = req.headers[REQUEST_ID_HEADER] as string;
    const requestId = existingId && existingId.trim().length > 0 ? existingId : uuidv4();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    (req as Request & { requestId?: string; traceId?: string }).requestId = requestId;

    const activeSpan = trace.getActiveSpan();
    const traceId = activeSpan?.spanContext().traceId;
    if (traceId) {
      res.setHeader(TRACE_ID_HEADER, traceId);
      (req as Request & { requestId?: string; traceId?: string }).traceId = traceId;
    }

    requestContext.run({ requestId, traceId }, () => {
      next();
    });
  }
}
