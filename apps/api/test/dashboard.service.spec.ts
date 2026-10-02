import { DashboardService } from '../src/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';

describe('DashboardService (Unit)', () => {
  let service: DashboardService;
  let prismaMock: {
    automation: { count: jest.Mock };
    execution: { count: jest.Mock; groupBy: jest.Mock };
    incident: { count: jest.Mock; groupBy: jest.Mock };
    $queryRaw: jest.Mock;
  };

  const fixedNow = new Date('2026-09-27T12:00:00.000Z');

  beforeEach(() => {
    prismaMock = {
      automation: {
        count: jest.fn().mockResolvedValue(10),
      },
      execution: {
        count: jest.fn().mockResolvedValue(100),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'SUCCESS', _count: { _all: 80 } },
          { status: 'FAILED', _count: { _all: 15 } },
          { status: 'TIMEOUT', _count: { _all: 5 } },
          { status: 'RUNNING', _count: { _all: 10 } },
        ]),
      },
      incident: {
        count: jest.fn().mockResolvedValue(3),
        groupBy: jest.fn().mockImplementation(({ by, where: _where }) => {
          if (by.includes('status')) {
            return Promise.resolve([
              { status: IncidentStatus.OPEN, _count: { _all: 2 } },
              { status: IncidentStatus.ACKNOWLEDGED, _count: { _all: 1 } },
              { status: IncidentStatus.RESOLVED, _count: { _all: 10 } },
            ]);
          }
          if (by.includes('severity')) {
            return Promise.resolve([
              { severity: IncidentSeverity.HIGH, _count: { _all: 2 } },
              { severity: IncidentSeverity.LOW, _count: { _all: 1 } },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray) => {
        const text = Array.isArray(strings) ? strings.join(' ') : String(strings);
        if (text.includes('mtta_seconds') && text.includes('mttr_seconds')) {
          return [{ mtta_seconds: 180.4, mttr_seconds: 720.6 }];
        }
        if (text.includes('date_trunc')) {
          return [
            {
              bucket: new Date('2026-09-27T00:00:00.000Z'),
              total: 50,
              success: 40,
              failed: 8,
              timeout: 2,
            },
          ];
        }
        if (text.includes('recent_incidents') || text.includes('FROM incidents i')) {
          return [
            {
              id: 'inc-1',
              status: IncidentStatus.OPEN,
              severity: IncidentSeverity.CRITICAL,
              opened_at: new Date('2026-09-27T11:50:00.000Z'),
              automation_id: 'aut-1',
              automation_name: 'Billing Sync',
              user_id: null,
              user_name: null,
              user_email: null,
            },
            {
              id: 'inc-2',
              status: IncidentStatus.ACKNOWLEDGED,
              severity: IncidentSeverity.HIGH,
              opened_at: new Date('2026-09-27T11:40:00.000Z'),
              automation_id: 'aut-2',
              automation_name: 'Invoice Pipeline',
              user_id: 'user-1',
              user_name: 'John Doe',
              user_email: 'john@flowpulse.io',
            },
          ];
        }
        return [];
      }),
    };

    service = new DashboardService(prismaMock as unknown as PrismaService);
  });

  describe('Temporal Windows and Limits', () => {
    it('should compute exact 24h start window in UTC', () => {
      const start = service.getStartTime('24h', fixedNow);
      expect(start.toISOString()).toBe('2026-09-26T12:00:00.000Z');
      expect(fixedNow.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('should compute exact 7d start window in UTC (default)', () => {
      const start = service.getStartTime('7d', fixedNow);
      expect(start.toISOString()).toBe('2026-09-20T12:00:00.000Z');
      expect(fixedNow.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should compute exact 30d start window in UTC', () => {
      const start = service.getStartTime('30d', fixedNow);
      expect(start.toISOString()).toBe('2026-08-28T12:00:00.000Z');
      expect(fixedNow.getTime() - start.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should fallback to 7d when period is unrecognized or default', async () => {
      const result = await service.getMetrics(
        {} as unknown as { period: string } as never,
        fixedNow,
      );
      expect(result.period).toBe('7d');
      expect(result.generated_at).toBe(fixedNow.toISOString());
    });
  });

  describe('Summary Metrics: Counts, Rates, and Failures', () => {
    it('should return active_automations from global state without temporal filter', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(prismaMock.automation.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
      expect(result.summary.active_automations).toBe(10);
    });

    it('should calculate executions including RUNNING and failures as FAILED + TIMEOUT', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      // 80 SUCCESS + 15 FAILED + 5 TIMEOUT + 10 RUNNING = 110
      expect(result.summary.executions).toBe(110);
      // 15 FAILED + 5 TIMEOUT = 20
      expect(result.summary.failures).toBe(20);
    });

    it('should calculate success_rate excluding RUNNING from denominator (SUCCESS / (SUCCESS+FAILED+TIMEOUT)*100)', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      // 80 / (80 + 15 + 5) * 100 = 80.0
      expect(result.summary.success_rate).toBe(80);
    });

    it('should return success_rate as null when denominator is zero without NaN or Infinity', async () => {
      prismaMock.execution.groupBy.mockResolvedValueOnce([
        { status: 'RUNNING', _count: { _all: 5 } },
      ]);
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(result.summary.executions).toBe(5);
      expect(result.summary.failures).toBe(0);
      expect(result.summary.success_rate).toBeNull();
    });

    it('should return open_incidents counting OPEN, ACKNOWLEDGED, INVESTIGATING and excluding RESOLVED', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(prismaMock.incident.count).toHaveBeenCalledWith({
        where: {
          status: {
            in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING],
          },
        },
      });
      expect(result.summary.open_incidents).toBe(3);
    });

    it('should query executions with where: { is_test: false } to exclude validation runs from KPIs', async () => {
      await service.getMetrics({ period: '7d' }, fixedNow);
      expect(prismaMock.execution.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {
          is_test: false,
          created_at: {
            gte: expect.any(Date),
            lte: fixedNow,
          },
        },
        _count: {
          _all: true,
        },
      });
    });

    it('should compute operational KPIs strictly ignoring is_test=true (e.g. 4 SUCCESS, 1 FAILED -> 80% success rate)', async () => {
      // Simula 4 SUCCESS e 1 FAILED operacionais (o 1 SUCCESS de teste foi filtrado pelo is_test: false no banco)
      prismaMock.execution.groupBy.mockResolvedValueOnce([
        { status: 'SUCCESS', _count: { _all: 4 } },
        { status: 'FAILED', _count: { _all: 1 } },
      ]);

      const result = await service.getMetrics({ period: '7d' }, fixedNow);

      expect(result.summary.executions).toBe(5);
      expect(result.summary.failures).toBe(1);
      expect(result.summary.success_rate).toBe(80);
    });
  });

  describe('MTTA and MTTR Determinations', () => {
    it('should round non-null MTTA and MTTR values to nearest integer seconds', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(result.summary.mtta_seconds).toBe(180); // Math.round(180.4)
      expect(result.summary.mttr_seconds).toBe(721); // Math.round(720.6)
    });

    it('should return null for MTTA and MTTR when no eligible incidents exist in period', async () => {
      prismaMock.$queryRaw.mockImplementationOnce(async (_strings: TemplateStringsArray) => {
        return [{ mtta_seconds: null, mttr_seconds: null }];
      });
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(result.summary.mtta_seconds).toBeNull();
      expect(result.summary.mttr_seconds).toBeNull();
    });
  });

  describe('Incident Distributions (Status and Severity)', () => {
    it('should return incidents_by_status with all status keys initialized, including 0 for missing ones', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(result.incidents_by_status).toEqual({
        OPEN: 2,
        ACKNOWLEDGED: 1,
        INVESTIGATING: 0, // was not in mock group, filled with 0
        RESOLVED: 10,
      });
    });

    it('should return open_incidents_by_severity with all 4 severities initialized and excluding RESOLVED', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(prismaMock.incident.groupBy).toHaveBeenCalledWith({
        by: ['severity'],
        where: {
          status: {
            not: IncidentStatus.RESOLVED,
          },
        },
        _count: {
          _all: true,
        },
      });
      expect(result.open_incidents_by_severity).toEqual({
        LOW: 1,
        MEDIUM: 0,
        HIGH: 2,
        CRITICAL: 0,
      });
    });
  });

  describe('Recent Incidents Ordering and Projection', () => {
    it('should return up to 5 prioritized incidents without sensitive fields or Clerk IDs', async () => {
      const result = await service.getMetrics({ period: '7d' }, fixedNow);
      expect(result.recent_incidents).toHaveLength(2);

      const first = result.recent_incidents[0];
      expect(first.id).toBe('inc-1');
      expect(first.status).toBe(IncidentStatus.OPEN);
      expect(first.severity).toBe(IncidentSeverity.CRITICAL);
      expect(first.automation.name).toBe('Billing Sync');
      expect(first.assigned_to).toBeNull();
      expect((first as unknown as Record<string, unknown>).clerk_user_id).toBeUndefined();

      const second = result.recent_incidents[1];
      expect(second.id).toBe('inc-2');
      expect(second.status).toBe(IncidentStatus.ACKNOWLEDGED);
      expect(second.severity).toBe(IncidentSeverity.HIGH);
      expect(second.assigned_to).toEqual({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@flowpulse.io',
      });
    });
  });

  describe('Execution Series & Gap Filling', () => {
    it('should generate continuous hourly buckets for 24h and fill empty intervals with zero', () => {
      const startTime = new Date('2026-09-26T12:00:00.000Z');
      const now = new Date('2026-09-27T12:00:00.000Z');
      const rawRows = [
        {
          bucket: new Date('2026-09-26T14:00:00.000Z'),
          total: 10,
          success: 8,
          failed: 1,
          timeout: 1,
        },
      ];

      const series = service.buildExecutionSeries('24h', startTime, now, rawRows);
      // From 12:00 Sept 26 to 12:00 Sept 27 inclusive = 25 hourly buckets
      expect(series.length).toBeGreaterThanOrEqual(24);
      expect(series[0].timestamp).toBe('2026-09-26T12:00:00.000Z');
      expect(series[series.length - 1].timestamp).toBe('2026-09-27T12:00:00.000Z');

      const matchedBucket = series.find((b) => b.timestamp === '2026-09-26T14:00:00.000Z');
      expect(matchedBucket).toBeDefined();
      expect(matchedBucket?.total).toBe(10);
      expect(matchedBucket?.success).toBe(8);

      const emptyBucket = series.find((b) => b.timestamp === '2026-09-26T13:00:00.000Z');
      expect(emptyBucket).toBeDefined();
      expect(emptyBucket?.total).toBe(0);
      expect(emptyBucket?.success).toBe(0);
      expect(emptyBucket?.failed).toBe(0);
      expect(emptyBucket?.timeout).toBe(0);
    });

    it('should generate continuous daily buckets for 7d with gap filling', () => {
      const startTime = new Date('2026-09-20T12:00:00.000Z');
      const now = new Date('2026-09-27T12:00:00.000Z');
      const series = service.buildExecutionSeries('7d', startTime, now, []);

      expect(series.length).toBe(8); // Sept 20 to Sept 27 inclusive
      expect(series[0].timestamp).toBe('2026-09-20T00:00:00.000Z');
      expect(series[series.length - 1].timestamp).toBe('2026-09-27T00:00:00.000Z');
      for (const bucket of series) {
        expect(bucket.total).toBe(0);
      }
    });

    it('should generate continuous daily buckets for 30d with gap filling', () => {
      const startTime = new Date('2026-08-28T12:00:00.000Z');
      const now = new Date('2026-09-27T12:00:00.000Z');
      const series = service.buildExecutionSeries('30d', startTime, now, []);

      expect(series.length).toBe(31); // 31 days inclusive from Aug 28 to Sept 27
      expect(series[0].timestamp).toBe('2026-08-28T00:00:00.000Z');
      expect(series[series.length - 1].timestamp).toBe('2026-09-27T00:00:00.000Z');
    });

    it('should query execution series filtering out is_test = TRUE for standard periods (7d/30d)', async () => {
      await service.getMetrics({ period: '7d' }, fixedNow);

      const rawCalls = prismaMock.$queryRaw.mock.calls;
      const seriesCall = rawCalls.find((call) => {
        const text = Array.isArray(call[0]) ? call[0].join(' ') : String(call[0]);
        return text.includes('date_trunc') && text.includes('executions');
      });

      expect(seriesCall).toBeDefined();
      const querySql = Array.isArray(seriesCall[0])
        ? seriesCall[0].join(' ')
        : String(seriesCall[0]);
      expect(querySql).toMatch(/is_test\s*=\s*FALSE/i);
    });

    it('should query execution series filtering out is_test = TRUE for hourly period (24h)', async () => {
      await service.getMetrics({ period: '24h' }, fixedNow);

      const rawCalls = prismaMock.$queryRaw.mock.calls;
      const seriesCall = rawCalls.find((call) => {
        const text = Array.isArray(call[0]) ? call[0].join(' ') : String(call[0]);
        return text.includes('date_trunc') && text.includes('hour');
      });

      expect(seriesCall).toBeDefined();
      const querySql = Array.isArray(seriesCall[0])
        ? seriesCall[0].join(' ')
        : String(seriesCall[0]);
      expect(querySql).toMatch(/is_test\s*=\s*FALSE/i);
    });
  });
});
