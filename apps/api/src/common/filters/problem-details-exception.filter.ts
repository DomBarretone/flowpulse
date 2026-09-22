import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  request_id: string;
  errors?: unknown;
}

@Catch()
export class ProblemDetailsExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        detail = res;
        title = exception.name || this.getDefaultTitle(status);
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        title = (resObj.error as string) || this.getDefaultTitle(status);

        if (Array.isArray(resObj.message)) {
          detail = resObj.message.join('; ');
          errors = resObj.message;
        } else if (typeof resObj.message === 'string') {
          detail = resObj.message;
        } else {
          detail = exception.message || this.getDefaultTitle(status);
        }
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
    }

    const requestId =
      request.requestId || (request.headers[REQUEST_ID_HEADER] as string) || 'unknown';

    const problemDetails: ProblemDetails = {
      type: `https://httpstatuses.io/${status}`,
      title,
      status,
      detail,
      instance: request.url,
      request_id: requestId,
      ...(errors ? { errors } : {}),
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json(problemDetails);
  }

  private getDefaultTitle(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Unprocessable Entity';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service Unavailable';
      default:
        return 'Internal Server Error';
    }
  }
}
