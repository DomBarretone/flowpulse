import { SanitizerService } from '../src/common/sanitization/sanitizer.service';

describe('SanitizerService', () => {
  let sanitizer: SanitizerService;

  beforeEach(() => {
    sanitizer = new SanitizerService();
  });

  it('should redact Bearer tokens', () => {
    const raw = 'Request failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcnhSN';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe('Request failed with Bearer [REDACTED]');
    expect(result).not.toContain('eyJhbGci');
  });

  it('should redact standalone JWT tokens', () => {
    const raw = 'Token was: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload_data.signature_data';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe('Token was: [REDACTED]');
  });

  it('should redact FlowPulse live API keys (fp_live_*)', () => {
    const raw = 'Using key fp_live_1234567890abcdef1234567890abcdef for authentication';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe('Using key [REDACTED] for authentication');
    expect(result).not.toContain('fp_live_');
  });

  it('should redact provider keys (sk_*, pk_*)', () => {
    const raw = 'Failed with sk_live_abcdef123456 and pk_test_fedcba654321';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe('Failed with [REDACTED] and [REDACTED]');
    expect(result).not.toContain('sk_live_');
    expect(result).not.toContain('pk_test_');
  });

  it('should redact email addresses', () => {
    const raw = 'Notification sent to operator.john.doe@company.internal.org failed';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe('Notification sent to [REDACTED] failed');
    expect(result).not.toContain('john.doe');
  });

  it('should redact sensitive query parameters in URLs', () => {
    const raw =
      'GET https://external-service.io/webhook?token=secret_tok_123&env=prod&password=admin123';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe(
      'GET https://external-service.io/webhook?token=[REDACTED]&env=prod&password=[REDACTED]',
    );
    expect(result).not.toContain('secret_tok_123');
    expect(result).not.toContain('admin123');
  });

  it('should redact credential assignments (password=, secret=, etc.)', () => {
    const raw =
      'Config dump: password="mySecretPassword!", secret: \'superSecretValue\', auth=myAuthToken';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe(
      'Config dump: password="[REDACTED]", secret: \'[REDACTED]\', auth=[REDACTED]',
    );
    expect(result).not.toContain('mySecretPassword!');
    expect(result).not.toContain('superSecretValue');
  });

  it('should preserve non-sensitive operational text', () => {
    const raw =
      'Database connection timeout on query SELECT * FROM orders WHERE status = "PENDING" at line 42';
    const result = sanitizer.sanitize(raw);
    expect(result).toBe(raw);
  });

  it('should handle null, undefined and empty strings safely', () => {
    expect(sanitizer.sanitize(null)).toBe('');
    expect(sanitizer.sanitize(undefined)).toBe('');
    expect(sanitizer.sanitize('')).toBe('');
  });
});
