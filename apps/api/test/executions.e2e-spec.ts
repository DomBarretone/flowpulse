import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClerkService } from '../src/users/clerk.service';
import {
  Automation,
  AutomationStatus,
  Criticality,
  ExecutionStatus,
  IncidentSeverity,
  IncidentStatus,
  IntegrationStatus,
  Role,
  User,
} from '@prisma/client';

describe('ExecutionsController (e2e)', () => {
  let app: INestApplication;

  const validTestKey = 'fp_live_testkey1234567890abcdef1234567890abcdef1234567890abcdef12345678';
  const validTestKeyHash = crypto.createHash('sha256').update(validTestKey).digest('hex');

  const revokedKey = 'fp_live_revokedkey1234567890abcdef1234567890abcdef1234567890abcdef1234';
  const revokedKeyHash = crypto.createHash('sha256').update(revokedKey).digest('hex');

  const mockActiveAutomation: Automation = {
    id: 'aut-active-e2e',
    name: 'Active Order Flow',
    description: 'E2E active automation',
    owner_id: 'user-admin-1',
    criticality: Criticality.HIGH,
    expected_duration_seconds: 60,
    status: AutomationStatus.ACTIVE,
    integration_status: IntegrationStatus.VALIDATED,
    created_at: new Date('2026-09-27T19:00:00Z'),
    updated_at: new Date('2026-09-27T19:00:00Z'),
  };

  const mockDraftAutomation: Automation = {
    id: 'aut-draft-e2e',
    name: 'Draft New Flow',
    description: 'E2E draft automation',
    owner_id: 'user-admin-1',
    criticality: Criticality.MEDIUM,
    expected_duration_seconds: 60,
    status: AutomationStatus.DRAFT,
    integration_status: IntegrationStatus.PENDING,
    created_at: new Date('2026-09-27T19:00:00Z'),
    updated_at: new Date('2026-09-27T19:00:00Z'),
  };

  type ExecutionTestRecord = {
    id: string;
    automation_id: string;
    external_execution_id: string;
    [key: string]: unknown;
  };
  type IncidentTestRecord = {
    id: string;
    execution_id: string;
    [key: string]: unknown;
  };

  const executionsDb: ExecutionTestRecord[] = [];
  const incidentsDb: IncidentTestRecord[] = [];
  const automationsMap: Record<string, Automation> = {
    [mockActiveAutomation.id]: { ...mockActiveAutomation },
    [mockDraftAutomation.id]: { ...mockDraftAutomation },
  };

  const mockAdminUser: User = {
    id: 'user-admin-1',
    clerk_user_id: 'clerk_admin_1',
    email: 'admin@flowpulse.io',
    name: 'Admin User',
    role: Role.ADMIN,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeAll(async () => {
    const mockPrismaService = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.clerk_user_id === 'clerk_admin_1') return Promise.resolve(mockAdminUser);
          return Promise.resolve(null);
        }),
      },
      apiKey: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.key_hash === validTestKeyHash) {
            return Promise.resolve({
              id: 'key-active-1',
              automation_id: mockActiveAutomation.id,
              key_hash: validTestKeyHash,
              prefix: 'fp_live_testkey1',
              created_at: new Date(),
              revoked_at: null,
              last_used_at: null,
              automation: automationsMap[mockActiveAutomation.id],
            });
          }
          if (where.key_hash === revokedKeyHash) {
            return Promise.resolve({
              id: 'key-revoked-1',
              automation_id: mockActiveAutomation.id,
              key_hash: revokedKeyHash,
              prefix: 'fp_live_revokedk',
              created_at: new Date(),
              revoked_at: new Date(),
              last_used_at: null,
              automation: automationsMap[mockActiveAutomation.id],
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      automation: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(automationsMap[where.id] || null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          if (automationsMap[where.id]) {
            Object.assign(automationsMap[where.id], data);
            return Promise.resolve(automationsMap[where.id]);
          }
          return Promise.resolve(null);
        }),
      },
      execution: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.automation_id_external_execution_id) {
            const found = executionsDb.find(
              (e) =>
                e.automation_id === where.automation_id_external_execution_id.automation_id &&
                e.external_execution_id ===
                  where.automation_id_external_execution_id.external_execution_id,
            );
            if (!found) return Promise.resolve(null);
            const incident = incidentsDb.find((i) => i.execution_id === found.id);
            return Promise.resolve({ ...found, incident: incident || null });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newExec = {
            id: `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            ...data,
            created_at: new Date(),
          };
          executionsDb.push(newExec);
          return Promise.resolve(newExec);
        }),
        findMany: jest.fn().mockImplementation(() => {
          return Promise.resolve(
            executionsDb.map((e) => {
              const incident = incidentsDb.find((i) => i.execution_id === e.id);
              return {
                ...e,
                incident: incident
                  ? { id: incident.id, status: incident.status, severity: incident.severity }
                  : null,
              };
            }),
          );
        }),
      },
      incident: {
        create: jest.fn().mockImplementation(({ data }) => {
          const newInc = {
            id: `inc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            ...data,
            opened_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          };
          incidentsDb.push(newInc);
          return Promise.resolve(newInc);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            incidentsDb.find((i) => i.execution_id === where.execution_id) || null,
          );
        }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockPrismaService);
        }),
    };

    const mockClerkService = {
      verify: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'admin-token') {
          return { sub: 'clerk_admin_1', email: 'admin@flowpulse.io', name: 'Admin User' };
        }
        throw new Error('Invalid token');
      }),
      getUserDetails: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(ClerkService)
      .useValue(mockClerkService)
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

  describe('POST /api/v1/executions Authentication with ApiKeyGuard', () => {
    it('should return 401 Problem Details with request_id when x-api-key is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/executions')
        .send({
          external_execution_id: 'run-001',
          status: 'SUCCESS',
          started_at: '2026-09-27T19:00:00.000Z',
        })
        .expect(401);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.request_id).toBeDefined();
    });

    it('should return 401 when x-api-key format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/executions')
        .set('x-api-key', 'invalid-format-key')
        .send({
          external_execution_id: 'run-001',
          status: 'SUCCESS',
          started_at: '2026-09-27T19:00:00.000Z',
        })
        .expect(401);

      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('should return 401 when x-api-key is revoked', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/executions')
        .set('x-api-key', revokedKey)
        .send({
          external_execution_id: 'run-001',
          status: 'SUCCESS',
          started_at: '2026-09-27T19:00:00.000Z',
        })
        .expect(401);

      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('Real Integration Test event (is_test: true)', () => {
    it('should validate integration and update integration_status to VALIDATED without creating incident even if FAILED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/executions')
        .set('x-api-key', validTestKey)
        .send({
          external_execution_id: 'test-real-001',
          status: 'FAILED',
          started_at: '2026-09-27T19:00:00.000Z',
          is_test: true,
          error_message: 'Simulated connection failure during integration test',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.is_test).toBe(true);
      expect(res.body.incident_id).toBeNull();
      expect(automationsMap[mockActiveAutomation.id].integration_status).toBe(
        IntegrationStatus.VALIDATED,
      );
    });
  });

  describe('Productive Execution Ingestion & Incident Boundary', () => {
    it('should ingest SUCCESS execution without creating incident', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/executions')
        .set('x-api-key', validTestKey)
        .send({
          external_execution_id: 'prod-run-001',
          status: 'SUCCESS',
          started_at: '2026-09-27T19:10:00.000Z',
          finished_at: '2026-09-27T19:11:00.000Z',
          duration_ms: 60000,
          is_test: false,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(ExecutionStatus.SUCCESS);
      expect(res.body.incident_id).toBeNull();
    });

    it('should ingest FAILED productive execution and automatically create Incident OPEN with derived severity', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/executions')
        .set('x-api-key', validTestKey)
        .send({
          external_execution_id: 'prod-run-002-fail',
          status: 'FAILED',
          started_at: '2026-09-27T19:20:00.000Z',
          error_message: 'Database connection lost',
          is_test: false,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(ExecutionStatus.FAILED);
      expect(res.body.incident_id).toBeDefined();

      const createdIncident = incidentsDb.find((i) => i.id === res.body.incident_id);
      expect(createdIncident).toBeDefined();
      expect(createdIncident.status).toBe(IncidentStatus.OPEN);
      expect(createdIncident.severity).toBe(IncidentSeverity.CRITICAL);
    });

    it('should handle idempotent resend with 200 OK without duplicating execution or incident', async () => {
      const initialIncidentsCount = incidentsDb.length;
      const initialExecutionsCount = executionsDb.length;

      const res = await request(app.getHttpServer())
        .post('/api/v1/executions')
        .set('x-api-key', validTestKey)
        .send({
          external_execution_id: 'prod-run-002-fail',
          status: 'FAILED',
          started_at: '2026-09-27T19:20:00.000Z',
          error_message: 'Database connection lost',
          is_test: false,
        })
        .expect(200);

      expect(res.body.external_execution_id).toBe('prod-run-002-fail');
      expect(res.body.incident_id).toBeDefined();
      expect(incidentsDb.length).toBe(initialIncidentsCount);
      expect(executionsDb.length).toBe(initialExecutionsCount);
    });
  });

  describe('GET /api/v1/executions History Query', () => {
    it('should return executions list with incident info when queried with Clerk token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/executions')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});
