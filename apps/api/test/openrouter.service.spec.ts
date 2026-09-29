import { ServiceUnavailableException } from '@nestjs/common';
import { OpenRouterService } from '../src/ai/openrouter.service';
import { IncidentAnalysisContext } from '../src/ai/dto/ai-analysis-output.dto';

describe('OpenRouterService', () => {
  let service: OpenRouterService;
  const originalFetch = global.fetch;

  const sampleContext: IncidentAnalysisContext = {
    automation: {
      name: 'Order Processing Pipeline',
      criticality: 'HIGH',
      expected_duration_seconds: 45,
    },
    incident: {
      severity: 'HIGH',
      status: 'INVESTIGATING',
      opened_at: new Date('2026-09-27T20:00:00Z'),
    },
    execution: {
      status: 'FAILED',
      started_at: new Date('2026-09-27T19:59:00Z'),
      finished_at: new Date('2026-09-27T20:00:00Z'),
      duration_ms: 60000,
      error_message: 'Timeout communicating with billing gateway at 192.168.1.5',
    },
  };

  const validStructuredPayload = {
    summary: 'Falha de comunicação e timeout no gateway de faturamento.',
    likely_causes: [
      {
        cause: 'Indisponibilidade transitória do gateway de pagamentos',
        rationale: 'A conexão expirou após 60.000ms sem resposta do endpoint de cobrança.',
      },
    ],
    evidence: [
      'Execução finalizada com status FAILED após 60000ms',
      'Timeout communicating with billing gateway',
    ],
    next_steps: [
      'Verificar conectividade de rede com o gateway de faturamento',
      'Checar métricas de saúde do serviço externo',
    ],
    confidence: 0.85,
  };

  beforeEach(() => {
    service = new OpenRouterService();
    process.env.OPENROUTER_API_KEY = 'test_openrouter_key_12345';
    process.env.OPENROUTER_MODEL = 'anthropic/claude-haiku-4.5';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENROUTER_TIMEOUT_MS = '1000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should successfully call OpenRouter and return structured response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: 'gen-req-12345',
        choices: [
          {
            message: {
              content: JSON.stringify(validStructuredPayload),
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const result = await service.analyzeIncident(sampleContext);

    expect(result).toBeDefined();
    expect(result.output.summary).toBe(validStructuredPayload.summary);
    expect(result.output.confidence).toBe(0.85);
    expect(result.output.likely_causes).toHaveLength(1);
    expect(result.model).toBe('anthropic/claude-haiku-4.5');
    expect(result.provider_request_id).toBe('gen-req-12345');

    // Verifica que fetch foi chamado com os headers e response_format corretos
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(options.headers['Authorization']).toBe('Bearer test_openrouter_key_12345');
    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.response_format.type).toBe('json_schema');
    expect(parsedBody.response_format.json_schema.strict).toBe(true);
    expect(parsedBody.provider.require_parameters).toBe(true);
  });

  it('should throw ServiceUnavailableException when OpenRouter returns non-200 (e.g. 503, 401, 429)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(service.analyzeIncident(sampleContext)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should throw ServiceUnavailableException when request times out via AbortController', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    await expect(service.analyzeIncident(sampleContext)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should throw ServiceUnavailableException when choices array is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        choices: [],
      }),
    });

    await expect(service.analyzeIncident(sampleContext)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should throw ServiceUnavailableException when content is invalid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Not a JSON text',
            },
          },
        ],
      }),
    });

    await expect(service.analyzeIncident(sampleContext)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should throw ServiceUnavailableException when confidence is outside 0..1', async () => {
    const invalidConfidencePayload = {
      ...validStructuredPayload,
      confidence: 1.5,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(invalidConfidencePayload),
            },
          },
        ],
      }),
    });

    await expect(service.analyzeIncident(sampleContext)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should throw ServiceUnavailableException when required properties are missing in payload', async () => {
    const missingPropsPayload = {
      summary: 'Some summary',
      // likely_causes ausente
      evidence: [],
      next_steps: [],
      confidence: 0.5,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(missingPropsPayload),
            },
          },
        ],
      }),
    });

    await expect(service.analyzeIncident(sampleContext)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should never expose OPENROUTER_API_KEY in exception messages', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network failure with key test_openrouter_key_12345'));

    try {
      await service.analyzeIncident(sampleContext);
      fail('Expected exception to be thrown');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const msg = (error as ServiceUnavailableException).message;
      expect(msg).not.toContain('test_openrouter_key_12345');
    }
  });
});
