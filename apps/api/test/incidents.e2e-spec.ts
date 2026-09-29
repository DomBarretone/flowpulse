import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClerkService } from '../src/users/clerk.service';
import { OpenRouterService } from '../src/ai/openrouter.service';
import {
  Criticality,
  ExecutionStatus,
  IncidentEventType,
  IncidentSeverity,
  IncidentStatus,
  Role,
  User,
} from '@prisma/client';

describe('IncidentsController (e2e)', () => {
  let app: INestApplication;

  const mockAdminUser: User = {
    id: 'user-admin-1',
    clerk_user_id: 'clerk_admin_1',
    email: 'admin@flowpulse.io',
    name: 'Admin User',
    role: Role.ADMIN,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAnalyst1: User = {
    id: 'user-analyst-1',
    clerk_user_id: 'clerk_analyst_1',
    email: 'analyst1@flowpulse.io',
    name: 'Analyst One',
    role: Role.ANALYST,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAnalyst2: User = {
    id: 'user-analyst-2',
    clerk_user_id: 'clerk_analyst_2',
    email: 'analyst2@flowpulse.io',
    name: 'Analyst Two',
    role: Role.ANALYST,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAutomation = {
    id: 'aut-active-1',
    name: 'Critical Order Pipeline',
    criticality: Criticality.HIGH,
    expected_duration_seconds: 60,
  };

  const mockRawSensitiveError =
    'Connection error with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.abcdef and fp_live_1234567890abcdef1234567890abcdef and user=billing.admin@flowpulse.io';

  const mockExecution = {
    id: 'exec-1',
    external_execution_id: 'ext-run-001',
    status: ExecutionStatus.FAILED,
    started_at: new Date('2026-09-27T10:00:00Z'),
    finished_at: new Date('2026-09-27T10:01:00Z'),
    duration_ms: 60000,
    error_message: mockRawSensitiveError,
    is_test: false,
  };

  type IncidentRecord = {
    id: string;
    automation_id: string;
    execution_id: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    assigned_to_id: string | null;
    opened_at: Date;
    acknowledged_at: Date | null;
    investigating_at: Date | null;
    resolved_at: Date | null;
    resolution_notes: string | null;
    created_at: Date;
    updated_at: Date;
  };

  type EventRecord = {
    id: string;
    incident_id: string;
    actor_user_id: string | null;
    event_type: IncidentEventType;
    from_status: IncidentStatus | null;
    to_status: IncidentStatus | null;
    note: string | null;
    created_at: Date;
  };

  type AiAnalysisRecord = {
    id: string;
    incident_id: string;
    requested_by_id: string;
    model: string;
    summary: string;
    likely_causes: unknown;
    evidence: unknown;
    next_steps: unknown;
    confidence: unknown;
    provider_request_id: string | null;
    latency_ms: number | null;
    created_at: Date;
  };

  let incidentsDb: IncidentRecord[] = [];
  let eventsDb: EventRecord[] = [];
  let aiAnalysesDb: AiAnalysisRecord[] = [];

  let openRouterMockFail = false;

  beforeAll(async () => {
    const mockPrismaService = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.clerk_user_id === 'clerk_admin_1') return Promise.resolve(mockAdminUser);
          if (where.clerk_user_id === 'clerk_analyst_1') return Promise.resolve(mockAnalyst1);
          if (where.clerk_user_id === 'clerk_analyst_2') return Promise.resolve(mockAnalyst2);
          if (where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
          if (where.id === mockAnalyst1.id) return Promise.resolve(mockAnalyst1);
          if (where.id === mockAnalyst2.id) return Promise.resolve(mockAnalyst2);
          return Promise.resolve(null);
        }),
      },
      incident: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const inc = incidentsDb.find((i) => i.id === where.id);
          if (!inc) return Promise.resolve(null);
          const assignedUser = [mockAdminUser, mockAnalyst1, mockAnalyst2].find(
            (u) => u.id === inc.assigned_to_id,
          );
          return Promise.resolve({
            ...inc,
            automation: mockAutomation,
            execution: mockExecution,
            assigned_to: assignedUser || null,
          });
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
          const inc = incidentsDb.find((i) => i.id === where.id);
          if (!inc) throw new Error('Not found');
          const assignedUser = [mockAdminUser, mockAnalyst1, mockAnalyst2].find(
            (u) => u.id === inc.assigned_to_id,
          );
          return Promise.resolve({
            ...inc,
            automation: mockAutomation,
            execution: mockExecution,
            assigned_to: assignedUser || null,
          });
        }),
        findMany: jest.fn().mockImplementation(({ where, skip = 0, take = 20 }) => {
          let items = [...incidentsDb];
          if (where?.status) items = items.filter((i) => i.status === where.status);
          if (where?.severity) items = items.filter((i) => i.severity === where.severity);
          if (where?.assigned_to_id)
            items = items.filter((i) => i.assigned_to_id === where.assigned_to_id);

          const paginated = items.slice(skip, skip + take).map((inc) => {
            const assignedUser = [mockAdminUser, mockAnalyst1, mockAnalyst2].find(
              (u) => u.id === inc.assigned_to_id,
            );
            return {
              ...inc,
              automation: mockAutomation,
              assigned_to: assignedUser || null,
            };
          });
          return Promise.resolve(paginated);
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          let items = [...incidentsDb];
          if (where?.status) items = items.filter((i) => i.status === where.status);
          if (where?.severity) items = items.filter((i) => i.severity === where.severity);
          return Promise.resolve(items.length);
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          const inc = incidentsDb.find((i) => i.id === where.id);
          if (!inc || inc.status !== where.status) {
            return Promise.resolve({ count: 0 });
          }
          Object.assign(inc, data);
          return Promise.resolve({ count: 1 });
        }),
      },
      incidentEvent: {
        create: jest.fn().mockImplementation(({ data }) => {
          const evt: EventRecord = {
            id: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            incident_id: data.incident_id,
            actor_user_id: data.actor_user_id || null,
            event_type: data.event_type,
            from_status: data.from_status || null,
            to_status: data.to_status || null,
            note: data.note || null,
            created_at: new Date(),
          };
          eventsDb.push(evt);
          return Promise.resolve(evt);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const events = eventsDb.filter((e) => e.incident_id === where.incident_id);
          const mapped = events.map((e) => {
            const actor = [mockAdminUser, mockAnalyst1, mockAnalyst2].find(
              (u) => u.id === e.actor_user_id,
            );
            return {
              ...e,
              actor: actor ? { id: actor.id, name: actor.name, email: actor.email } : null,
            };
          });
          return Promise.resolve(mapped);
        }),
      },
      aiAnalysis: {
        create: jest.fn().mockImplementation(({ data }) => {
          const created: AiAnalysisRecord = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            incident_id: data.incident_id,
            requested_by_id: data.requested_by_id,
            model: data.model,
            summary: data.summary,
            likely_causes: data.likely_causes,
            evidence: data.evidence,
            next_steps: data.next_steps,
            confidence: data.confidence,
            provider_request_id: data.provider_request_id,
            latency_ms: data.latency_ms,
            created_at: new Date(),
          };
          aiAnalysesDb.push(created);
          return Promise.resolve({
            ...created,
            requested_by: mockAnalyst1,
          });
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const items = aiAnalysesDb.filter((a) => a.incident_id === where.incident_id);
          return Promise.resolve(
            items.map((a) => ({
              ...a,
              requested_by: mockAnalyst1,
            })),
          );
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      }),
    };

    const mockClerkService = {
      verify: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'admin-token') {
          return { sub: 'clerk_admin_1', email: 'admin@flowpulse.io', name: 'Admin User' };
        }
        if (token === 'analyst-1-token') {
          return { sub: 'clerk_analyst_1', email: 'analyst1@flowpulse.io', name: 'Analyst One' };
        }
        if (token === 'analyst-2-token') {
          return { sub: 'clerk_analyst_2', email: 'analyst2@flowpulse.io', name: 'Analyst Two' };
        }
        throw new Error('Invalid token');
      }),
      getUserDetails: jest.fn(),
    };

    const mockOpenRouterService = {
      analyzeIncident: jest.fn().mockImplementation(async () => {
        if (openRouterMockFail) {
          const { ServiceUnavailableException } = await import('@nestjs/common');
          throw new ServiceUnavailableException('OpenRouter provider 503');
        }
        return {
          output: {
            summary: 'E2E Root Cause Analysis Summary',
            likely_causes: [{ cause: 'Gateway timeout', rationale: 'Network delay' }],
            evidence: ['Timeout log line'],
            next_steps: ['Check network gateway'],
            confidence: 0.88,
          },
          model: 'anthropic/claude-haiku-4.5',
          provider_request_id: 'e2e-req-123',
          latency_ms: 250,
        };
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(ClerkService)
      .useValue(mockClerkService)
      .overrideProvider(OpenRouterService)
      .useValue(mockOpenRouterService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    openRouterMockFail = false;
    incidentsDb = [];
    eventsDb = [];
    aiAnalysesDb = [];
  });

  describe('Authentication & Authorization Guards', () => {
    it('GET /api/v1/incidents should return 401 Problem Details when unauthenticated', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/incidents');
      expect(res.status).toBe(401);
      expect(res.body.type).toBe('https://httpstatuses.io/401');
      expect(res.body.request_id).toBeDefined();
    });

    it('POST /api/v1/incidents/inc-1/acknowledge should return 401 when token is missing', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/incidents/inc-1/acknowledge');
      expect(res.status).toBe(401);
      expect(res.body.request_id).toBeDefined();
    });
  });

  describe('GET /api/v1/incidents and Detail Sanitization', () => {
    it('should return 200 OK list for authenticated ANALYST', async () => {
      incidentsDb.push({
        id: 'inc-open-e2e',
        automation_id: mockAutomation.id,
        execution_id: mockExecution.id,
        status: IncidentStatus.OPEN,
        severity: IncidentSeverity.HIGH,
        assigned_to_id: null,
        opened_at: new Date(),
        acknowledged_at: null,
        investigating_at: null,
        resolved_at: null,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/incidents')
        .set('Authorization', 'Bearer analyst-1-token');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].id).toBe('inc-open-e2e');
    });

    it('GET /api/v1/incidents/:id should sanitize error_message expunging Bearer tokens, API keys and emails', async () => {
      incidentsDb.push({
        id: 'inc-detail-sanitized',
        automation_id: mockAutomation.id,
        execution_id: mockExecution.id,
        status: IncidentStatus.OPEN,
        severity: IncidentSeverity.HIGH,
        assigned_to_id: null,
        opened_at: new Date(),
        acknowledged_at: null,
        investigating_at: null,
        resolved_at: null,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/incidents/inc-detail-sanitized')
        .set('Authorization', 'Bearer analyst-1-token');

      expect(res.status).toBe(200);
      const errorMsg = res.body.execution.error_message;
      expect(errorMsg).toBe(
        'Connection error with Bearer [REDACTED] and [REDACTED] and user=[REDACTED]',
      );
      expect(errorMsg).not.toContain('eyJhbGci');
      expect(errorMsg).not.toContain('fp_live_');
      expect(errorMsg).not.toContain('flowpulse.io');
    });
  });

  describe('Full Incident Lifecycle and Concurrency (Fluxo 2)', () => {
    it('should complete the entire lifecycle: OPEN -> ACKNOWLEDGED -> INVESTIGATING -> AI Analysis -> RESOLVED', async () => {
      // 1. Incidente criado como OPEN (Change 03)
      const incidentId = 'inc-lifecycle-test';
      incidentsDb.push({
        id: incidentId,
        automation_id: mockAutomation.id,
        execution_id: mockExecution.id,
        status: IncidentStatus.OPEN,
        severity: IncidentSeverity.HIGH,
        assigned_to_id: null,
        opened_at: new Date(),
        acknowledged_at: null,
        investigating_at: null,
        resolved_at: null,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 2. Analyst 1 assume o incidente (Acknowledge)
      const ackRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/acknowledge`)
        .set('Authorization', 'Bearer analyst-1-token');

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.status).toBe('ACKNOWLEDGED');
      expect(ackRes.body.assigned_to_id).toBe(mockAnalyst1.id);
      expect(ackRes.body.acknowledged_at).toBeDefined();

      // 3. Concorrência: Analyst 2 tenta assumir o mesmo incidente -> 409 Conflict
      const concurrentAckRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/acknowledge`)
        .set('Authorization', 'Bearer analyst-2-token');

      expect(concurrentAckRes.status).toBe(409);
      expect(concurrentAckRes.body.type).toBe('https://httpstatuses.io/409');

      // 4. RBAC Ownership: Analyst 2 tenta investigar incidente de Analyst 1 -> 403 Forbidden
      const forbiddenInvestigate = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/investigate`)
        .set('Authorization', 'Bearer analyst-2-token');

      expect(forbiddenInvestigate.status).toBe(403);
      expect(forbiddenInvestigate.body.type).toBe('https://httpstatuses.io/403');

      // 5. Analyst 1 inicia a investigação -> 200 OK
      const invRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/investigate`)
        .set('Authorization', 'Bearer analyst-1-token');

      expect(invRes.status).toBe(200);
      expect(invRes.body.status).toBe('INVESTIGATING');
      expect(invRes.body.investigating_at).toBeDefined();

      // 6. Solicitação de Análise de IA com falha mockada (503) -> Incidente permanece INVESTIGATING
      openRouterMockFail = true;
      const failedAiRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/ai-analysis`)
        .set('Authorization', 'Bearer analyst-1-token');

      expect(failedAiRes.status).toBe(503);
      expect(failedAiRes.body.type).toBe('https://httpstatuses.io/503');
      expect(incidentsDb.find((i) => i.id === incidentId)?.status).toBe(
        IncidentStatus.INVESTIGATING,
      );

      // 7. Solicitação de Análise de IA com sucesso -> 201 Created, status permanece INVESTIGATING
      openRouterMockFail = false;
      const successAiRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/ai-analysis`)
        .set('Authorization', 'Bearer analyst-1-token');

      expect(successAiRes.status).toBe(201);
      expect(successAiRes.body.summary).toBe('E2E Root Cause Analysis Summary');
      expect(successAiRes.body.confidence).toBe(0.88);
      expect(incidentsDb.find((i) => i.id === incidentId)?.status).toBe(
        IncidentStatus.INVESTIGATING,
      );

      // 8. Resolução sem notas (ou < 10 chars) -> 422 Unprocessable Entity
      const invalidResolveRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/resolve`)
        .set('Authorization', 'Bearer analyst-1-token')
        .send({ resolution_notes: 'Curto' });

      expect(invalidResolveRes.status).toBe(422);

      // 9. Resolução com notas válidas -> 200 OK, status RESOLVED
      const validResolveRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/resolve`)
        .set('Authorization', 'Bearer analyst-1-token')
        .send({
          resolution_notes: 'Reiniciado o serviço com timeout estendido e novo pool.',
        });

      expect(validResolveRes.status).toBe(200);
      expect(validResolveRes.body.status).toBe('RESOLVED');
      expect(validResolveRes.body.resolved_at).toBeDefined();
      expect(validResolveRes.body.resolution_notes).toBe(
        'Reiniciado o serviço com timeout estendido e novo pool.',
      );

      // 10. Tentativa de re-execução em incidente RESOLVED -> 409 Conflict
      const reResolveRes = await request(app.getHttpServer())
        .post(`/api/v1/incidents/${incidentId}/resolve`)
        .set('Authorization', 'Bearer analyst-1-token')
        .send({
          resolution_notes: 'Tentativa de resolver novamente incidente fechado.',
        });

      expect(reResolveRes.status).toBe(409);

      // 11. Consulta de Eventos (Timeline) -> deve conter todos os eventos na ordem cronológica
      const eventsRes = await request(app.getHttpServer())
        .get(`/api/v1/incidents/${incidentId}/events`)
        .set('Authorization', 'Bearer analyst-1-token');

      expect(eventsRes.status).toBe(200);
      const eventTypes = eventsRes.body.map((e: { event_type: string }) => e.event_type);
      expect(eventTypes).toContain(IncidentEventType.ACKNOWLEDGED);
      expect(eventTypes).toContain(IncidentEventType.INVESTIGATION_STARTED);
      expect(eventTypes).toContain(IncidentEventType.AI_ANALYSIS_REQUESTED);
      expect(eventTypes).toContain(IncidentEventType.AI_ANALYSIS_COMPLETED);
      expect(eventTypes).toContain(IncidentEventType.RESOLVED);
    });
  });
});
