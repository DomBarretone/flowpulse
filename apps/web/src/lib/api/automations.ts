export type Criticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AutomationStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type IntegrationStatus = 'PENDING' | 'VALIDATED' | 'FAILED';

export interface ApiKeyItem {
  id: string;
  automation_id?: string;
  prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  criticality: Criticality;
  expected_duration_seconds: number;
  status: AutomationStatus;
  integration_status: IntegrationStatus;
  created_at: string;
  updated_at: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  api_keys?: ApiKeyItem[];
}

export interface CreateAutomationInput {
  name: string;
  description?: string;
  criticality: Criticality;
  expected_duration_seconds: number;
}

export interface GeneratedApiKey {
  id: string;
  prefix: string;
  secret: string;
  created_at: string;
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

export async function getAutomations(
  token: string,
  filters?: { status?: string; criticality?: string },
): Promise<Automation[]> {
  const url = new URL(`${getApiUrl()}/automations`);
  if (filters?.status) url.searchParams.set('status', filters.status);
  if (filters?.criticality) url.searchParams.set('criticality', filters.criticality);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  return handleResponse<Automation[]>(res);
}

export async function getAutomation(token: string, id: string): Promise<Automation> {
  const res = await fetch(`${getApiUrl()}/automations/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  return handleResponse<Automation>(res);
}

export async function createAutomation(
  token: string,
  input: CreateAutomationInput,
): Promise<Automation> {
  const res = await fetch(`${getApiUrl()}/automations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return handleResponse<Automation>(res);
}

export async function activateAutomation(token: string, id: string): Promise<Automation> {
  const res = await fetch(`${getApiUrl()}/automations/${id}/activate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<Automation>(res);
}

export async function deactivateAutomation(token: string, id: string): Promise<Automation> {
  const res = await fetch(`${getApiUrl()}/automations/${id}/deactivate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<Automation>(res);
}

export async function generateApiKey(
  token: string,
  automationId: string,
): Promise<GeneratedApiKey> {
  const res = await fetch(`${getApiUrl()}/automations/${automationId}/api-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<GeneratedApiKey>(res);
}

export async function revokeApiKey(
  token: string,
  automationId: string,
  keyId: string,
): Promise<ApiKeyItem> {
  const res = await fetch(`${getApiUrl()}/automations/${automationId}/api-keys/${keyId}/revoke`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<ApiKeyItem>(res);
}
