import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId = req.headers[REQUEST_ID_HEADER] as string;
    const requestId = existingId && existingId.trim().length > 0 ? existingId : uuidv4();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    (req as Request & { requestId?: string }).requestId = requestId;

    next();
  }
}
