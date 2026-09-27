export type ExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface ExecutionItem {
  id: string;
  automation_id: string;
  external_execution_id: string;
  status: ExecutionStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  is_test: boolean;
  created_at: string;
  incident?: {
    id: string;
    status: string;
    severity: string;
  } | null;
}

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export async function getExecutions(
  token: string,
  query?: { automation_id?: string; status?: string; is_test?: boolean },
): Promise<ExecutionItem[]> {
  const url = new URL(`${getApiUrl()}/executions`);
  if (query?.automation_id) url.searchParams.set('automation_id', query.automation_id);
  if (query?.status) url.searchParams.set('status', query.status);
  if (query?.is_test !== undefined) url.searchParams.set('is_test', String(query.is_test));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch executions: HTTP ${res.status}`);
  }

  return res.json();
}
