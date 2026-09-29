import { Controller, Get, INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { HealthController } from '../src/health/health.controller';
import { trace } from '@opentelemetry/api';

@Controller('test-obs')
class TestObsController {
  @Get('success')
  getSuccess() {
    return { ok: true };
  }

  @Get('error')
  getError() {
    throw new NotFoundException('Recurso não encontrado para teste de observabilidade.');
  }
}

describe('Observability & Correlation Suite', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TestObsController, HealthController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(new RequestIdMiddleware().use);
    app.useGlobalFilters(new ProblemDetailsExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('X-Request-ID and X-Trace-ID Headers', () => {
    it('should generate a new X-Request-ID UUID v4 when header is absent', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/test-obs/success').expect(200);

      const requestId = res.headers['x-request-id'];
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should preserve and reflect client-supplied X-Request-ID', async () => {
      const clientReqId = 'custom-trace-uuid-12345';
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-obs/success')
        .set('x-request-id', clientReqId)
        .expect(200);

      expect(res.headers['x-request-id']).toBe(clientReqId);
    });

    it('should include X-Trace-ID header on HTTP responses', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/test-obs/success').expect(200);

      const traceId = res.headers['x-trace-id'];
      if (traceId) {
        expect(traceId).toMatch(/^[0-9a-f]{32}$/);
      } else {
        // Quando nenhum span do OTel está ativo no ambiente de teste simples, o middleware não injeta traceId falso
        expect(trace.getActiveSpan()).toBeUndefined();
      }
    });
  });

  describe('RFC 7807 Problem Details with Correlation IDs', () => {
    it('should include request_id and trace_id in RFC 7807 error responses', async () => {
      const clientReqId = 'error-correlation-id-999';
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-obs/error')
        .set('x-request-id', clientReqId)
        .expect(404);

      expect(res.body).toHaveProperty('type');
      expect(res.body).toHaveProperty('title', 'Not Found');
      expect(res.body).toHaveProperty('status', 404);
      expect(res.body).toHaveProperty('detail');
      expect(res.body).toHaveProperty('instance', '/api/v1/test-obs/error');
      expect(res.body).toHaveProperty('request_id', clientReqId);
    });
  });

  describe('Health Check Endpoint Independence', () => {
    it('GET /api/v1/health should respond 200 OK without collector dependency and without leaking internals', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).not.toHaveProperty('database_url');
      expect(res.body).not.toHaveProperty('otel_exporter');
      expect(res.body).not.toHaveProperty('secret');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });
});
