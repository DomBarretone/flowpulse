export type DashboardPeriod = '24h' | '7d' | '30d';

export interface DashboardSummary {
  active_automations: number;
  executions: number;
  success_rate: number | null;
  failures: number;
  open_incidents: number;
  mtta_seconds: number | null;
  mttr_seconds: number | null;
}

export interface ExecutionSeriesBucket {
  timestamp: string;
  total: number;
  success: number;
  failed: number;
  timeout: number;
}

export interface IncidentsByStatus {
  OPEN: number;
  ACKNOWLEDGED: number;
  INVESTIGATING: number;
  RESOLVED: number;
}

export interface OpenIncidentsBySeverity {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

export interface RecentIncidentItem {
  id: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  opened_at: string;
  automation: {
    id: string;
    name: string;
  };
  assigned_to: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface DashboardMetricsResponse {
  period: DashboardPeriod;
  generated_at: string;
  summary: DashboardSummary;
  execution_series: ExecutionSeriesBucket[];
  incidents_by_status: IncidentsByStatus;
  open_incidents_by_severity: OpenIncidentsBySeverity;
  recent_incidents: RecentIncidentItem[];
}

export class DashboardApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly data?: unknown,
  ) {
    super(detail);
    this.name = 'DashboardApiError';
  }
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
}

export async function fetchDashboardMetrics(
  token: string,
  period: DashboardPeriod = '7d',
  signal?: AbortSignal,
): Promise<DashboardMetricsResponse> {
  const url = `${getApiUrl()}/dashboard/metrics?period=${encodeURIComponent(period)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal,
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = `Erro na requisição (HTTP ${res.status})`;
    let data: unknown = undefined;
    try {
      data = await res.json();
      if (
        data &&
        typeof data === 'object' &&
        'detail' in data &&
        typeof (data as { detail: unknown }).detail === 'string'
      ) {
        detail = (data as { detail: string }).detail;
      }
    } catch {
      // fallback
    }
    throw new DashboardApiError(res.status, detail, data);
  }

  return (await res.json()) as DashboardMetricsResponse;
}
