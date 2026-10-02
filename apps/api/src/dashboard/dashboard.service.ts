import { Injectable } from '@nestjs/common';
import { AutomationStatus, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardPeriod, QueryDashboardMetricsDto } from './dto/query-dashboard-metrics.dto';
import {
  DashboardMetricsResponseDto,
  ExecutionSeriesBucketDto,
  RecentIncidentItemDto,
} from './dto/dashboard-metrics-response.dto';

interface ExecutionSeriesRawRow {
  bucket: Date | string;
  total: number | bigint;
  success: number | bigint;
  failed: number | bigint;
  timeout: number | bigint;
}

interface MttaMttrRawRow {
  mtta_seconds: number | null;
  mttr_seconds: number | null;
}

interface RecentIncidentRawRow {
  id: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  opened_at: Date;
  automation_id: string;
  automation_name: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computa a data inicial (startTime) com base no período e timestamp "now" de referência.
   */
  getStartTime(period: DashboardPeriod, now: Date): Date {
    switch (period) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '7d':
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  async getMetrics(
    query: QueryDashboardMetricsDto,
    referenceNow?: Date,
  ): Promise<DashboardMetricsResponseDto> {
    const period = query.period || '7d';
    // Instante único congelado para todas as agregações
    const now = referenceNow ?? new Date();
    const startTime = this.getStartTime(period, now);

    const [
      activeAutomationsCount,
      executionStatusGroups,
      openIncidentsCount,
      mttaMttrResult,
      executionSeriesRows,
      incidentStatusGroups,
      openIncidentSeverityGroups,
      recentIncidentsRows,
    ] = await Promise.all([
      // 1. Automações ativas no estado global
      this.prisma.automation.count({
        where: { status: AutomationStatus.ACTIVE },
      }),

      // 2. Execuções operacionais agrupadas por status dentro da janela temporal (exclui is_test = true)
      this.prisma.execution.groupBy({
        by: ['status'],
        where: {
          is_test: false,
          created_at: {
            gte: startTime,
            lte: now,
          },
        },
        _count: {
          _all: true,
        },
      }),

      // 3. Incidentes abertos no backlog atual (OPEN, ACKNOWLEDGED, INVESTIGATING)
      this.prisma.incident.count({
        where: {
          status: {
            in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING],
          },
        },
      }),

      // 4. MTTA e MTTR médios em segundos no PostgreSQL
      this.prisma.$queryRaw<MttaMttrRawRow[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (acknowledged_at - opened_at))) FILTER (WHERE acknowledged_at IS NOT NULL)::float AS mtta_seconds,
          AVG(EXTRACT(EPOCH FROM (resolved_at - opened_at))) FILTER (WHERE resolved_at IS NOT NULL)::float AS mttr_seconds
        FROM incidents
        WHERE opened_at >= ${startTime} AND opened_at <= ${now}
      `,

      // 5. Agregação temporal da série de execuções operacionais (exclui is_test = true)
      period === '24h'
        ? this.prisma.$queryRaw<ExecutionSeriesRawRow[]>`
            SELECT
              date_trunc('hour', created_at) AS bucket,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS success,
              COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
              COUNT(*) FILTER (WHERE status = 'TIMEOUT')::int AS timeout
            FROM executions
            WHERE is_test = FALSE AND created_at >= ${startTime} AND created_at <= ${now}
            GROUP BY bucket
            ORDER BY bucket ASC
          `
        : this.prisma.$queryRaw<ExecutionSeriesRawRow[]>`
            SELECT
              date_trunc('day', created_at) AS bucket,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS success,
              COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
              COUNT(*) FILTER (WHERE status = 'TIMEOUT')::int AS timeout
            FROM executions
            WHERE is_test = FALSE AND created_at >= ${startTime} AND created_at <= ${now}
            GROUP BY bucket
            ORDER BY bucket ASC
          `,

      // 6. Distribuição global de incidentes por status
      this.prisma.incident.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),

      // 7. Distribuição de incidentes ativos não resolvidos por severidade
      this.prisma.incident.groupBy({
        by: ['severity'],
        where: {
          status: {
            not: IncidentStatus.RESOLVED,
          },
        },
        _count: {
          _all: true,
        },
      }),

      // 8. Até 5 incidentes recentes ordenados: (1) não resolvidos, (2) severidade, (3) opened_at DESC
      this.prisma.$queryRaw<RecentIncidentRawRow[]>`
        SELECT
          i.id,
          i.status,
          i.severity,
          i.opened_at,
          a.id AS automation_id,
          a.name AS automation_name,
          u.id AS user_id,
          u.name AS user_name,
          u.email AS user_email
        FROM incidents i
        JOIN automations a ON i.automation_id = a.id
        LEFT JOIN users u ON i.assigned_to_id = u.id
        ORDER BY
          CASE WHEN i.status = 'RESOLVED' THEN 1 ELSE 0 END ASC,
          CASE i.severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            WHEN 'LOW' THEN 4
            ELSE 5
          END ASC,
          i.opened_at DESC
        LIMIT 5
      `,
    ]);

    // Resumo de execuções
    let successCount = 0;
    let failedCount = 0;
    let timeoutCount = 0;
    let runningCount = 0;

    for (const group of executionStatusGroups) {
      const count = group._count._all;
      if (group.status === 'SUCCESS') successCount += count;
      else if (group.status === 'FAILED') failedCount += count;
      else if (group.status === 'TIMEOUT') timeoutCount += count;
      else if (group.status === 'RUNNING') runningCount += count;
    }

    const totalExecutions = successCount + failedCount + timeoutCount + runningCount;
    const failures = failedCount + timeoutCount;
    const denominator = successCount + failedCount + timeoutCount;
    const success_rate =
      denominator > 0 ? Number(((successCount / denominator) * 100).toFixed(2)) : null;

    // MTTA e MTTR
    const mttaRaw = mttaMttrResult[0]?.mtta_seconds;
    const mttrRaw = mttaMttrResult[0]?.mttr_seconds;
    const mtta_seconds =
      mttaRaw != null && Number.isFinite(mttaRaw) ? Math.round(Number(mttaRaw)) : null;
    const mttr_seconds =
      mttrRaw != null && Number.isFinite(mttrRaw) ? Math.round(Number(mttrRaw)) : null;

    // Preenchimento contínuo de lacunas (Gap Filling) na série temporal
    const execution_series = this.buildExecutionSeries(period, startTime, now, executionSeriesRows);

    // Distribuição de incidentes por status (sempre todas as chaves)
    const incidents_by_status = {
      OPEN: 0,
      ACKNOWLEDGED: 0,
      INVESTIGATING: 0,
      RESOLVED: 0,
    };
    for (const group of incidentStatusGroups) {
      if (group.status in incidents_by_status) {
        incidents_by_status[group.status] = group._count._all;
      }
    }

    // Distribuição de incidentes ativos por severidade (sempre todas as chaves)
    const open_incidents_by_severity = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const group of openIncidentSeverityGroups) {
      if (group.severity in open_incidents_by_severity) {
        open_incidents_by_severity[group.severity] = group._count._all;
      }
    }

    // Mapeamento seguro de incidentes recentes
    const recent_incidents: RecentIncidentItemDto[] = recentIncidentsRows.map((row) => ({
      id: row.id,
      status: row.status,
      severity: row.severity,
      opened_at: new Date(row.opened_at),
      automation: {
        id: row.automation_id,
        name: row.automation_name,
      },
      assigned_to: row.user_id
        ? {
            id: row.user_id,
            name: row.user_name || 'Desconhecido',
            email: row.user_email || '',
          }
        : null,
    }));

    return {
      period,
      generated_at: now.toISOString(),
      summary: {
        active_automations: activeAutomationsCount,
        executions: totalExecutions,
        success_rate,
        failures,
        open_incidents: openIncidentsCount,
        mtta_seconds,
        mttr_seconds,
      },
      execution_series,
      incidents_by_status,
      open_incidents_by_severity,
      recent_incidents,
    };
  }

  /**
   * Constrói a linha contínua de buckets temporais preenchendo intervalos vazios com 0.
   */
  buildExecutionSeries(
    period: DashboardPeriod,
    startTime: Date,
    now: Date,
    rows: ExecutionSeriesRawRow[],
  ): ExecutionSeriesBucketDto[] {
    const isHour = period === '24h';
    const stepMs = isHour ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const startBucket = isHour
      ? new Date(
          Date.UTC(
            startTime.getUTCFullYear(),
            startTime.getUTCMonth(),
            startTime.getUTCDate(),
            startTime.getUTCHours(),
            0,
            0,
            0,
          ),
        )
      : new Date(
          Date.UTC(
            startTime.getUTCFullYear(),
            startTime.getUTCMonth(),
            startTime.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );

    const endBucket = isHour
      ? new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            0,
            0,
            0,
          ),
        )
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const bucketMap = new Map<
      string,
      { total: number; success: number; failed: number; timeout: number }
    >();

    for (const row of rows) {
      const iso = new Date(row.bucket).toISOString();
      bucketMap.set(iso, {
        total: Number(row.total),
        success: Number(row.success),
        failed: Number(row.failed),
        timeout: Number(row.timeout),
      });
    }

    const series: ExecutionSeriesBucketDto[] = [];
    let cursor = startBucket.getTime();

    while (cursor <= endBucket.getTime()) {
      const iso = new Date(cursor).toISOString();
      const existing = bucketMap.get(iso);

      series.push({
        timestamp: iso,
        total: existing ? existing.total : 0,
        success: existing ? existing.success : 0,
        failed: existing ? existing.failed : 0,
        timeout: existing ? existing.timeout : 0,
      });

      cursor += stepMs;
    }

    return series;
  }
}
