import { HttpLoggingInterceptor } from '../src/common/logging/http-logging.interceptor';
import { JsonLoggerService } from '../src/common/logging/json-logger.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;
  let loggerMock: { log: jest.Mock };

  beforeEach(() => {
    loggerMock = {
      log: jest.fn(),
    };
    interceptor = new HttpLoggingInterceptor(loggerMock as unknown as JsonLoggerService);
  });

  it('should log http_request_completed on successful request', (done) => {
    const mockRequest = {
      method: 'GET',
      originalUrl: '/api/v1/health',
      url: '/api/v1/health',
    };
    const mockResponse = {
      statusCode: 200,
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ status: 'ok' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: () => {
        expect(loggerMock.log).toHaveBeenCalledWith(
          expect.objectContaining({
            event_name: 'http_request_completed',
            method: 'GET',
            path: '/api/v1/health',
            status_code: 200,
            duration_ms: expect.any(Number),
          }),
        );
        done();
      },
    });
  });

  it('should log http_request_completed on failed request', (done) => {
    const mockRequest = {
      method: 'POST',
      originalUrl: '/api/v1/executions',
      url: '/api/v1/executions',
    };
    const mockResponse = {
      statusCode: 500,
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => throwError(() => ({ status: 422 })),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: () => {
        expect(loggerMock.log).toHaveBeenCalledWith(
          expect.objectContaining({
            event_name: 'http_request_completed',
            method: 'POST',
            path: '/api/v1/executions',
            status_code: 422,
            duration_ms: expect.any(Number),
          }),
        );
        done();
      },
    });
  });
});
