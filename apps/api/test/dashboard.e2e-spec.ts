import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClerkService } from '../src/users/clerk.service';
import { IncidentSeverity, IncidentStatus, Role, User } from '@prisma/client';

describe('DashboardController (e2e)', () => {
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

  const mockAnalystUser: User = {
    id: 'user-analyst-1',
    clerk_user_id: 'clerk_analyst_1',
    email: 'analyst@flowpulse.io',
    name: 'Analyst User',
    role: Role.ANALYST,
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
          if (where.clerk_user_id === 'clerk_analyst_1') return Promise.resolve(mockAnalystUser);
          if (where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
          if (where.id === mockAnalystUser.id) return Promise.resolve(mockAnalystUser);
          return Promise.resolve(null);
        }),
      },
      automation: {
        count: jest.fn().mockResolvedValue(8),
      },
      execution: {
        count: jest.fn().mockResolvedValue(150),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'SUCCESS', _count: { _all: 120 } },
          { status: 'FAILED', _count: { _all: 10 } },
          { status: 'TIMEOUT', _count: { _all: 5 } },
          { status: 'RUNNING', _count: { _all: 15 } },
        ]),
      },
      incident: {
        count: jest.fn().mockResolvedValue(4),
        groupBy: jest.fn().mockImplementation(({ by }) => {
          if (by.includes('status')) {
            return Promise.resolve([
              { status: IncidentStatus.OPEN, _count: { _all: 2 } },
              { status: IncidentStatus.ACKNOWLEDGED, _count: { _all: 1 } },
              { status: IncidentStatus.INVESTIGATING, _count: { _all: 1 } },
              { status: IncidentStatus.RESOLVED, _count: { _all: 25 } },
            ]);
          }
          if (by.includes('severity')) {
            return Promise.resolve([
              { severity: IncidentSeverity.CRITICAL, _count: { _all: 1 } },
              { severity: IncidentSeverity.HIGH, _count: { _all: 2 } },
              { severity: IncidentSeverity.MEDIUM, _count: { _all: 1 } },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray) => {
        const text = Array.isArray(strings) ? strings.join(' ') : String(strings);
        if (text.includes('mtta_seconds') && text.includes('mttr_seconds')) {
          return [{ mtta_seconds: 145.2, mttr_seconds: 620.8 }];
        }
        if (text.includes('date_trunc')) {
          return [
            {
              bucket: new Date('2026-09-27T00:00:00.000Z'),
              total: 50,
              success: 45,
              failed: 3,
              timeout: 2,
            },
          ];
        }
        if (text.includes('FROM incidents i')) {
          return [
            {
              id: 'inc-priority-1',
              status: IncidentStatus.OPEN,
              severity: IncidentSeverity.CRITICAL,
              opened_at: new Date('2026-09-27T11:00:00.000Z'),
              automation_id: 'aut-1',
              automation_name: 'Payment Processing',
              user_id: null,
              user_name: null,
              user_email: null,
            },
          ];
        }
        return [];
      }),
    };

    const mockClerkService = {
      verify: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'admin-token') {
          return { sub: 'clerk_admin_1', email: 'admin@flowpulse.io', name: 'Admin User' };
        }
        if (token === 'analyst-token') {
          return { sub: 'clerk_analyst_1', email: 'analyst@flowpulse.io', name: 'Analyst User' };
        }
        throw new Error('Invalid Clerk token');
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

  describe('Authentication & Authorization', () => {
    it('should return 401 Problem Details when unauthenticated', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/dashboard/metrics');

      expect(res.status).toBe(401);
      expect(res.body.type).toBe('https://httpstatuses.io/401');
      expect(res.body.status).toBe(401);
    });

    it('should return 401 when invalid token is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe(401);
    });

    it('should return 200 OK for ADMIN user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('7d');
      expect(res.body.summary.active_automations).toBe(8);
      expect(res.body.summary.executions).toBe(150);
      expect(res.body.summary.failures).toBe(15);
      expect(res.body.summary.open_incidents).toBe(4);
      expect(res.body.summary.mtta_seconds).toBe(145);
      expect(res.body.summary.mttr_seconds).toBe(621);
      expect(res.body.summary.success_rate).toBeCloseTo(88.89, 1);
      expect(Array.isArray(res.body.execution_series)).toBe(true);
      expect(res.body.incidents_by_status).toEqual({
        OPEN: 2,
        ACKNOWLEDGED: 1,
        INVESTIGATING: 1,
        RESOLVED: 25,
      });
      expect(res.body.open_incidents_by_severity).toEqual({
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
        CRITICAL: 1,
      });
      expect(res.body.recent_incidents).toHaveLength(1);
      expect(res.body.recent_incidents[0].id).toBe('inc-priority-1');
      expect(res.body.recent_incidents[0].automation.name).toBe('Payment Processing');
    });

    it('should return 200 OK for ANALYST user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics')
        .set('Authorization', 'Bearer analyst-token');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('7d');
    });

    it('should query execution stats excluding test executions (is_test: false)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics')
        .set('Authorization', 'Bearer admin-token');

      const mockPrisma = app.get(PrismaService);
      expect(mockPrisma.execution.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_test: false }),
        }),
      );
    });
  });

  describe('Period Query Validation & Variations', () => {
    it('should reject invalid period with 422 Unprocessable Entity RFC 7807', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics?period=99d')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(422);
      expect(res.body.type).toBe('https://httpstatuses.io/422');
      expect(res.body.status).toBe(422);
      expect(res.body.detail).toBeDefined();
    });

    it('should accept period=24h and return 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics?period=24h')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('24h');
      expect(res.body.execution_series.length).toBeGreaterThanOrEqual(24);
    });

    it('should accept period=7d and return 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics?period=7d')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('7d');
      expect(res.body.execution_series.length).toBeGreaterThanOrEqual(7);
    });

    it('should accept period=30d and return 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/metrics?period=30d')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('30d');
      expect(res.body.execution_series.length).toBeGreaterThanOrEqual(30);
    });
  });
});
