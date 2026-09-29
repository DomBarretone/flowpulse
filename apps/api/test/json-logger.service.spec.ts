import { JsonLoggerService } from '../src/common/logging/json-logger.service';
import { SanitizerService } from '../src/common/sanitization/sanitizer.service';
import { requestContext } from '../src/common/logging/request-context';
import { Span, trace } from '@opentelemetry/api';

describe('JsonLoggerService', () => {
  let logger: JsonLoggerService;
  let sanitizer: SanitizerService;

  beforeEach(() => {
    sanitizer = new SanitizerService();
    logger = new JsonLoggerService(sanitizer);
    jest.restoreAllMocks();
  });

  it('should emit structured JSON log with mandatory fields outside HTTP context', () => {
    const formatted = logger.formatLog('info', 'Service initialized successfully', ['Bootstrap']);

    expect(formatted.timestamp).toBeDefined();
    expect(new Date(formatted.timestamp).toISOString()).toBe(formatted.timestamp);
    expect(formatted.level).toBe('info');
    expect(formatted.service).toBe('flowpulse-api');
    expect(formatted.environment).toBeDefined();
    expect(formatted.event_name).toBe('application_log');
    expect(formatted.request_id).toBeNull();
    expect(formatted.trace_id).toBeNull();
    expect(formatted.message).toBe('Service initialized successfully');
    expect(formatted.context).toBe('Bootstrap');
  });

  it('should include real request_id and trace_id when available in context', () => {
    const fakeRequestId = 'req-12345-abcde';
    const fakeTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';

    jest.spyOn(trace, 'getActiveSpan').mockReturnValue({
      spanContext: () => ({
        traceId: fakeTraceId,
        spanId: '00f067aa0ba902b7',
        traceFlags: 1,
      }),
    } as unknown as Span);

    requestContext.run({ requestId: fakeRequestId, traceId: fakeTraceId }, () => {
      const formatted = logger.formatLog(
        'info',
        {
          event_name: 'test_event',
          detail: 'Sample operation',
        },
        [],
      );

      expect(formatted.event_name).toBe('test_event');
      expect(formatted.request_id).toBe(fakeRequestId);
      expect(formatted.trace_id).toBe(fakeTraceId);
      expect(formatted.detail).toBe('Sample operation');
    });
  });

  it('should sanitize fp_live_ API keys, Bearer tokens, and passwords in log payloads', () => {
    const sensitivePayload = {
      event_name: 'automation_created',
      message: 'Created key fp_live_1234567890abcdef1234567890abcdef',
      authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
      password: 'super_secret_password',
      secret: 'another_secret',
      nested: {
        x_api_key: 'fp_live_abcdef1234567890abcdef1234567890',
        token: 'sk_live_secret123456789',
      },
    };

    const formatted = logger.formatLog('info', sensitivePayload, []);
    const serialized = JSON.stringify(formatted);

    expect(serialized).not.toContain('fp_live_1234567890abcdef1234567890abcdef');
    expect(serialized).not.toContain('super_secret_password');
    expect(serialized).not.toContain('another_secret');
    expect(serialized).not.toContain('sk_live_secret123456789');
    expect(formatted.authorization).toBe('[REDACTED]');
    expect(formatted.password).toBe('[REDACTED]');
    expect(formatted.secret).toBe('[REDACTED]');
    const nested = formatted.nested as Record<string, unknown>;
    expect(nested.x_api_key).toBe('[REDACTED]');
    expect(nested.token).toBe('[REDACTED]');
  });
});
