import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClerkService } from '../src/users/clerk.service';
import { AutomationStatus, IntegrationStatus, Role, User } from '@prisma/client';

describe('AutomationsController (e2e)', () => {
  let app: INestApplication;

  const mockAdminUser: User = {
    id: 'admin-uuid-001',
    clerk_user_id: 'clerk_admin_001',
    email: 'admin@flowpulse.io',
    name: 'Admin User',
    role: Role.ADMIN,
    created_at: new Date('2026-09-27T20:00:00.000Z'),
    updated_at: new Date('2026-09-27T20:00:00.000Z'),
  };

  const mockAnalystUser: User = {
    id: 'analyst-uuid-002',
    clerk_user_id: 'clerk_analyst_002',
    email: 'analyst@flowpulse.io',
    name: 'Analyst User',
    role: Role.ANALYST,
    created_at: new Date('2026-09-27T20:00:00.000Z'),
    updated_at: new Date('2026-09-27T20:00:00.000Z'),
  };

  type AutomationTestRecord = {
    id: string;
    integration_status?: IntegrationStatus;
    [key: string]: unknown;
  };
  type ApiKeyTestRecord = {
    id: string;
    automation_id: string;
    [key: string]: unknown;
  };

  const automationsDatabase: AutomationTestRecord[] = [];
  const apiKeysDatabase: ApiKeyTestRecord[] = [];

  beforeAll(async () => {
    process.env.FLOWPULSE_ADMIN_EMAILS = 'admin@flowpulse.io';

    const mockPrismaService = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.clerk_user_id === 'clerk_admin_001') return Promise.resolve(mockAdminUser);
          if (where.clerk_user_id === 'clerk_analyst_002') return Promise.resolve(mockAnalystUser);
          return Promise.resolve(null);
        }),
      },
      automation: {
        create: jest.fn().mockImplementation(({ data }) => {
          const newAuto = {
            id: `aut-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
            owner: mockAdminUser,
          };
          automationsDatabase.push(newAuto);
          return Promise.resolve(newAuto);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(automationsDatabase)),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const auto = automationsDatabase.find((a) => a.id === where.id);
          if (!auto) return Promise.resolve(null);
          const keys = apiKeysDatabase
            .filter((k) => k.automation_id === auto.id)
            .map(({ key_hash: _h, ...rest }) => rest);
          return Promise.resolve({
            ...auto,
            owner: mockAdminUser,
            api_keys: keys,
          });
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const index = automationsDatabase.findIndex((a) => a.id === where.id);
          if (index === -1) return Promise.resolve(null);
          automationsDatabase[index] = {
            ...automationsDatabase[index],
            ...data,
            updated_at: new Date(),
          };
          return Promise.resolve(automationsDatabase[index]);
        }),
      },
      apiKey: {
        create: jest.fn().mockImplementation(({ data }) => {
          const newKey = {
            id: `key-${Date.now()}`,
            ...data,
            created_at: new Date(),
            revoked_at: null,
            last_used_at: null,
          };
          apiKeysDatabase.push(newKey);
          return Promise.resolve(newKey);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const key = apiKeysDatabase.find(
            (k) => k.id === where.id && k.automation_id === where.automation_id,
          );
          return Promise.resolve(key || null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const key = apiKeysDatabase.find((k) => k.id === where.id);
          if (key) {
            Object.assign(key, data);
            return Promise.resolve(key);
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            apiKeysDatabase.filter((k) => k.automation_id === where.automation_id),
          );
        }),
      },
    };

    const mockClerkService = {
      verify: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'admin-token') {
          return { sub: 'clerk_admin_001', email: 'admin@flowpulse.io', name: 'Admin User' };
        }
        if (token === 'analyst-token') {
          return { sub: 'clerk_analyst_002', email: 'analyst@flowpulse.io', name: 'Analyst User' };
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

  describe('POST /api/v1/automations', () => {
    it('should return 401 when token is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/automations')
        .send({
          name: 'Test Automation',
          criticality: 'HIGH',
          expected_duration_seconds: 60,
        })
        .expect(401);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.request_id).toBeDefined();
    });

    it('should return 403 when user is ANALYST', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/automations')
        .set('Authorization', 'Bearer analyst-token')
        .send({
          name: 'Test Automation',
          criticality: 'HIGH',
          expected_duration_seconds: 60,
        })
        .expect(403);

      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('should return 422 when expected_duration_seconds <= 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/automations')
        .set('Authorization', 'Bearer admin-token')
        .send({
          name: 'Test Automation',
          criticality: 'HIGH',
          expected_duration_seconds: 0,
        })
        .expect(422);

      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('should create automation when user is ADMIN with status DRAFT and integration_status PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/automations')
        .set('Authorization', 'Bearer admin-token')
        .send({
          name: 'Order Processing',
          description: 'E-commerce order pipeline',
          criticality: 'HIGH',
          expected_duration_seconds: 120,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Order Processing');
      expect(res.body.status).toBe(AutomationStatus.DRAFT);
      expect(res.body.integration_status).toBe(IntegrationStatus.PENDING);
    });
  });

  describe('API Key Generation and Safe Exposure', () => {
    let createdAutoId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/automations')
        .set('Authorization', 'Bearer admin-token')
        .send({
          name: 'Key Test Auto',
          criticality: 'MEDIUM',
          expected_duration_seconds: 30,
        })
        .expect(201);
      createdAutoId = res.body.id;
    });

    it('should allow ADMIN to generate key and return secret one-time', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/automations/${createdAutoId}/api-keys`)
        .set('Authorization', 'Bearer admin-token')
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.prefix).toBeDefined();
      expect(res.body.secret).toBeDefined();
      expect(res.body.secret.startsWith('fp_live_')).toBe(true);
      expect(res.body.key_hash).toBeUndefined();
    });

    it('GET /api/v1/automations/:id should NEVER return secret or key_hash', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/automations/${createdAutoId}`)
        .set('Authorization', 'Bearer analyst-token')
        .expect(200);

      expect(res.body.api_keys).toBeDefined();
      expect(res.body.api_keys.length).toBeGreaterThan(0);
      for (const key of res.body.api_keys) {
        expect(key.secret).toBeUndefined();
        expect(key.key_hash).toBeUndefined();
        expect(key.prefix).toBeDefined();
      }
    });

    it('should allow ADMIN to revoke key', async () => {
      const keyId = apiKeysDatabase[0].id;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/automations/${createdAutoId}/api-keys/${keyId}/revoke`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(res.body.revoked_at).toBeDefined();
    });
  });

  describe('Activation and Deactivation Workflow', () => {
    let autoId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/automations')
        .set('Authorization', 'Bearer admin-token')
        .send({
          name: 'Activation Flow Auto',
          criticality: 'CRITICAL',
          expected_duration_seconds: 45,
        })
        .expect(201);
      autoId = res.body.id;
    });

    it('should block activation with 422 Problem Details when integration_status is PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/automations/${autoId}/activate`)
        .set('Authorization', 'Bearer admin-token')
        .expect(422);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.detail).toContain('validated integration test');
    });

    it('should allow activation when integration_status is VALIDATED', async () => {
      // Simulate real integration validation
      const auto = automationsDatabase.find((a) => a.id === autoId);
      auto.integration_status = IntegrationStatus.VALIDATED;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/automations/${autoId}/activate`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(res.body.status).toBe(AutomationStatus.ACTIVE);
    });

    it('should allow deactivation', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/automations/${autoId}/deactivate`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(res.body.status).toBe(AutomationStatus.INACTIVE);
    });
  });
});
