export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentEventType =
  | 'ACKNOWLEDGED'
  | 'INVESTIGATION_STARTED'
  | 'AI_ANALYSIS_REQUESTED'
  | 'AI_ANALYSIS_COMPLETED'
  | 'RESOLVED';

export interface IncidentActor {
  id: string;
  name: string;
  email: string;
}

export interface IncidentAutomation {
  id: string;
  name: string;
  criticality: IncidentSeverity;
  expected_duration_seconds?: number;
}

export interface IncidentExecution {
  id: string;
  external_execution_id: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  is_test: boolean;
}

export interface IncidentItem {
  id: string;
  automation_id: string;
  execution_id: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  assigned_to_id: string | null;
  opened_at: string;
  acknowledged_at: string | null;
  investigating_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  automation: IncidentAutomation;
  assigned_to: IncidentActor | null;
}

export interface IncidentDetail extends IncidentItem {
  execution: IncidentExecution;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  actor_user_id: string | null;
  event_type: IncidentEventType;
  from_status: IncidentStatus | null;
  to_status: IncidentStatus | null;
  note: string | null;
  created_at: string;
  actor: IncidentActor | null;
}

export interface AiAnalysisCause {
  cause: string;
  rationale: string;
}

export interface AiAnalysis {
  id: string;
  incident_id: string;
  requested_by_id: string;
  model: string;
  summary: string;
  likely_causes: AiAnalysisCause[];
  evidence: string[];
  next_steps: string[];
  confidence: number;
  provider_request_id: string | null;
  latency_ms: number | null;
  created_at: string;
  requested_by?: IncidentActor | null;
}

export interface QueryIncidentsParams {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  automation_id?: string;
  assigned_to_id?: string;
  page?: number;
  limit?: number;
}

export interface ListIncidentsResponse {
  items: IncidentItem[];
  total: number;
  page: number;
  limit: number;
}

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public data?: unknown,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
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
    throw new ApiError(res.status, detail, data);
  }
  return res.json() as Promise<T>;
}

export async function listIncidents(
  token: string,
  params?: QueryIncidentsParams,
): Promise<ListIncidentsResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  if (params?.automation_id) query.set('automation_id', params.automation_id);
  if (params?.assigned_to_id) query.set('assigned_to_id', params.assigned_to_id);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const url = `${getApiUrl()}/incidents${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<ListIncidentsResponse>(res);
}

export async function getIncident(token: string, id: string): Promise<IncidentDetail> {
  const res = await fetch(`${getApiUrl()}/incidents/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<IncidentDetail>(res);
}

export async function getIncidentEvents(token: string, id: string): Promise<IncidentEvent[]> {
  const res = await fetch(`${getApiUrl()}/incidents/${id}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<IncidentEvent[]>(res);
}

export async function getIncidentAiAnalyses(token: string, id: string): Promise<AiAnalysis[]> {
  const res = await fetch(`${getApiUrl()}/incidents/${id}/ai-analyses`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<AiAnalysis[]>(res);
}

export async function acknowledgeIncident(token: string, id: string): Promise<IncidentItem> {
  const res = await fetch(`${getApiUrl()}/incidents/${id}/acknowledge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return handleResponse<IncidentItem>(res);
}

export async function investigateIncident(token: string, id: string): Promise<IncidentItem> {
  const res = await fetch(`${getApiUrl()}/incidents/${id}/investigate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return handleResponse<IncidentItem>(res);
}

export async function requestAiAnalysis(token: string, id: string): Promise<AiAnalysis> {
  const res = await fetch(`${getApiUrl()}/incidents/${id}/ai-analysis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return handleResponse<AiAnalysis>(res);
}

export async function resolveIncident(
  token: string,
  id: string,
  resolutionNotes: string,
): Promise<IncidentItem> {
  const res = await fetch(`${getApiUrl()}/incidents/${id}/resolve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resolution_notes: resolutionNotes }),
  });
  return handleResponse<IncidentItem>(res);
}
