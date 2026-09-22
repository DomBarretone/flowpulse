import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemDetailsExceptionFilter } from '../src/common/filters/problem-details-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
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

  it('GET /api/v1/health should return 200 OK without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);

    // Verify x-request-id header propagation
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('Non-existent route should return RFC 7807 problem details format with 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/non-existent-route')
      .expect(404);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      type: 'https://httpstatuses.io/404',
      status: 404,
      instance: '/api/v1/non-existent-route',
    });
    expect(response.body.request_id).toBeDefined();
  });
});
