import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClerkService } from '../src/users/clerk.service';
import { Role, User } from '@prisma/client';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  const mockAnalystUser: User = {
    id: '11111111-1111-4111-a111-111111111111',
    clerk_user_id: 'clerk_analyst_001',
    email: 'analyst@flowpulse.io',
    name: 'Analyst User',
    role: Role.ANALYST,
    created_at: new Date('2026-09-27T20:00:00.000Z'),
    updated_at: new Date('2026-09-27T20:00:00.000Z'),
  };

  const mockAdminUser: User = {
    id: '22222222-2222-4222-a222-222222222222',
    clerk_user_id: 'clerk_admin_002',
    email: 'admin@flowpulse.io',
    name: 'Admin User',
    role: Role.ADMIN,
    created_at: new Date('2026-09-27T20:00:00.000Z'),
    updated_at: new Date('2026-09-27T20:00:00.000Z'),
  };

  beforeAll(async () => {
    process.env.FLOWPULSE_ADMIN_EMAILS = 'admin@flowpulse.io';

    const mockPrismaService = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.clerk_user_id === 'clerk_analyst_001') return Promise.resolve(mockAnalystUser);
          if (where.clerk_user_id === 'clerk_admin_002') return Promise.resolve(mockAdminUser);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'generated-uuid',
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...mockAnalystUser,
            ...data,
          }),
        ),
      },
    };

    const mockClerkService = {
      verify: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'valid-analyst-token') {
          return {
            sub: 'clerk_analyst_001',
            email: 'analyst@flowpulse.io',
            email_verified: true,
            name: 'Analyst User',
          };
        }
        if (token === 'valid-admin-token') {
          return {
            sub: 'clerk_admin_002',
            email: 'admin@flowpulse.io',
            email_verified: true,
            name: 'Admin User',
          };
        }
        throw new Error('Invalid or expired token');
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

  describe('GET /api/v1/users/me', () => {
    it('should return 401 Problem Details with request_id when token is missing', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({
        type: 'https://httpstatuses.io/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing or invalid authorization token',
        instance: '/api/v1/users/me',
      });
      expect(response.body.request_id).toBeDefined();
    });

    it('should return 401 Problem Details with request_id when token is invalid', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body.status).toBe(401);
      expect(response.body.request_id).toBeDefined();
    });

    it('should return 200 OK with persisted user profile and persisted role from database', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer valid-analyst-token')
        .expect(200);

      expect(response.body).toEqual({
        id: mockAnalystUser.id,
        clerk_user_id: mockAnalystUser.clerk_user_id,
        email: mockAnalystUser.email,
        name: mockAnalystUser.name,
        role: 'ANALYST',
        created_at: mockAnalystUser.created_at.toISOString(),
        updated_at: mockAnalystUser.updated_at.toISOString(),
      });
    });
  });

  describe('RBAC on restricted route: GET /api/v1/users/admin-test', () => {
    it('should return 403 Forbidden with request_id when accessed by an ANALYST', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/admin-test')
        .set('Authorization', 'Bearer valid-analyst-token')
        .expect(403);

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({
        type: 'https://httpstatuses.io/403',
        title: 'Forbidden',
        status: 403,
        instance: '/api/v1/users/admin-test',
      });
      expect(response.body.detail).toContain('ADMIN');
      expect(response.body.request_id).toBeDefined();
    });

    it('should return 200 OK when accessed by an ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/admin-test')
        .set('Authorization', 'Bearer valid-admin-token')
        .expect(200);

      expect(response.body.message).toBe('Admin access granted');
      expect(response.body.user.role).toBe('ADMIN');
    });
  });

  describe('POST /api/v1/users/sync', () => {
    it('should return 200 OK and be idempotent', async () => {
      const response1 = await request(app.getHttpServer())
        .post('/api/v1/users/sync')
        .set('Authorization', 'Bearer valid-analyst-token')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .post('/api/v1/users/sync')
        .set('Authorization', 'Bearer valid-analyst-token')
        .expect(200);

      expect(response1.body.id).toBe(response2.body.id);
      expect(response1.body.role).toBe('ANALYST');
      expect(response2.body.role).toBe('ANALYST');
    });
  });
});
