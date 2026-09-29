import { HttpStatus, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { ArgumentsHost } from '@nestjs/common';
import { Span, trace } from '@opentelemetry/api';

type MockResponse = {
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
};

type MockRequest = {
  url: string;
  headers: Record<string, string>;
  requestId: string;
};

describe('ProblemDetailsExceptionFilter', () => {
  let filter: ProblemDetailsExceptionFilter;
  let mockResponse: MockResponse;
  let mockRequest: MockRequest;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new ProblemDetailsExceptionFilter();
    mockResponse = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/v1/test',
      headers: {},
      requestId: 'req-uuid-1234',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
    jest.restoreAllMocks();
  });

  it('should format RFC 7807 response with request_id and omit trace_id when no active span', () => {
    jest.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);

    const exception = new NotFoundException('Resource not found');
    filter.catch(exception, mockHost);

    expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://httpstatuses.io/404',
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found',
        instance: '/api/v1/test',
        request_id: 'req-uuid-1234',
      }),
    );
    const sentJson = mockResponse.json.mock.calls[0][0];
    expect(sentJson.trace_id).toBeUndefined();
  });

  it('should include trace_id in RFC 7807 response when active span exists', () => {
    const fakeTraceId = '5bf92f3577b34da6a3ce929d0e0e4736';
    jest.spyOn(trace, 'getActiveSpan').mockReturnValue({
      spanContext: () => ({
        traceId: fakeTraceId,
        spanId: '10f067aa0ba902b7',
        traceFlags: 1,
      }),
    } as unknown as Span);

    const exception = new UnprocessableEntityException('Validation failed');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://httpstatuses.io/422',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Validation failed',
        instance: '/api/v1/test',
        request_id: 'req-uuid-1234',
        trace_id: fakeTraceId,
      }),
    );
  });
});
