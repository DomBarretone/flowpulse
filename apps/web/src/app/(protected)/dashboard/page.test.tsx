import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardPage from './page';
import { useAuth } from '@clerk/nextjs';
import { DashboardMetricsResponse } from '../../../lib/api/dashboard';

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams('');

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(),
}));

describe('DashboardPage (/dashboard)', () => {
  const originalFetch = global.fetch;
  const mockGetToken = jest.fn().mockResolvedValue('mock-clerk-token');

  const mockFullMetrics: DashboardMetricsResponse = {
    period: '7d',
    generated_at: '2026-09-27T12:00:00.000Z',
    summary: {
      active_automations: 12,
      executions: 1450,
      success_rate: 98.5,
      failures: 22,
      open_incidents: 3,
      mtta_seconds: 180,
      mttr_seconds: 720,
    },
    execution_series: [
      {
        timestamp: '2026-09-21T00:00:00.000Z',
        total: 100,
        success: 95,
        failed: 3,
        timeout: 2,
      },
      {
        timestamp: '2026-09-22T00:00:00.000Z',
        total: 120,
        success: 118,
        failed: 2,
        timeout: 0,
      },
    ],
    incidents_by_status: {
      OPEN: 2,
      ACKNOWLEDGED: 1,
      INVESTIGATING: 0,
      RESOLVED: 15,
    },
    open_incidents_by_severity: {
      LOW: 1,
      MEDIUM: 1,
      HIGH: 1,
      CRITICAL: 0,
    },
    recent_incidents: [
      {
        id: 'inc-101',
        status: 'OPEN',
        severity: 'HIGH',
        opened_at: '2026-09-27T11:45:00.000Z',
        automation: {
          id: 'aut-1',
          name: 'Payment Ingestion Flow',
        },
        assigned_to: null,
      },
      {
        id: 'inc-102',
        status: 'ACKNOWLEDGED',
        severity: 'MEDIUM',
        opened_at: '2026-09-27T10:00:00.000Z',
        automation: {
          id: 'aut-2',
          name: 'SAP Invoice Sync',
        },
        assigned_to: {
          id: 'usr-1',
          name: 'Carlos Oliveira',
          email: 'carlos@flowpulse.io',
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams('');
    (useAuth as jest.Mock).mockReturnValue({
      getToken: mockGetToken,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should render loading skeleton initially while metrics are being fetched', async () => {
    let resolvePromise!: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    global.fetch = jest.fn().mockReturnValue(pendingPromise);

    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();

    resolvePromise({
      ok: true,
      json: () => Promise.resolve(mockFullMetrics),
    });

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
    });
  });

  it('should render all 7 primary metrics cards with correctly formatted values and units', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFullMetrics),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('metric-active-automations')).toHaveTextContent('12');
    });

    expect(screen.getByTestId('metric-executions')).toHaveTextContent('1450');
    expect(screen.getByTestId('metric-success-rate')).toHaveTextContent('98.5%');
    expect(screen.getByTestId('metric-failures')).toHaveTextContent('22');
    expect(screen.getByTestId('metric-open-incidents')).toHaveTextContent('3');
    expect(screen.getByTestId('metric-mtta')).toHaveTextContent('3m'); // 180s = 3m
    expect(screen.getByTestId('metric-mttr')).toHaveTextContent('12m'); // 720s = 12m
  });

  it('should render dash (—) and explanatory subtexts when rates or MTTA/MTTR are null', async () => {
    const metricsWithNulls: DashboardMetricsResponse = {
      ...mockFullMetrics,
      summary: {
        ...mockFullMetrics.summary,
        success_rate: null,
        mtta_seconds: null,
        mttr_seconds: null,
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(metricsWithNulls),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('metric-success-rate')).toHaveTextContent('—');
    });

    expect(screen.getByTestId('metric-mtta')).toHaveTextContent('—');
    expect(screen.getByTestId('metric-mttr')).toHaveTextContent('—');

    // Never render NaN, Infinity or undefined
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it('should render execution series chart with interactive tooltips and accessible summary', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFullMetrics),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /gráfico de barras/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Volume e Confiabilidade de Execuções/i)).toBeInTheDocument();
    expect(screen.getByText(/Sucesso \(213\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Falha \(5\)/i)).toBeInTheDocument();
  });

  it('should render empty state when execution series has zero executions', async () => {
    const emptySeriesMetrics: DashboardMetricsResponse = {
      ...mockFullMetrics,
      execution_series: [
        {
          timestamp: '2026-09-27T00:00:00.000Z',
          total: 0,
          success: 0,
          failed: 0,
          timeout: 0,
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptySeriesMetrics),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('execution-series-empty')).toBeInTheDocument();
    });

    expect(screen.getByText(/Nenhuma execução registrada na janela/i)).toBeInTheDocument();
  });

  it('should render status and severity distributions with progress bars', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFullMetrics),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Incidentes por Status (Global)')).toBeInTheDocument();
    });

    expect(screen.getByText('Severidade do Backlog Ativo')).toBeInTheDocument();
    expect(screen.getByText('Abertos')).toBeInTheDocument();
    expect(screen.getByText('Resolvidos')).toBeInTheDocument();
  });

  it('should render recent incidents table with badges and working navigation link', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFullMetrics),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Ingestion Flow')).toBeInTheDocument();
    });

    expect(screen.getByText('SAP Invoice Sync')).toBeInTheDocument();
    expect(screen.getByTestId('recent-incident-row-inc-101')).toBeInTheDocument();

    const link = screen.getAllByRole('link', { name: /investigar/i })[0];
    expect(link).toHaveAttribute('href', '/incidents/inc-101');
  });

  it('should render empty state when there are no recent incidents', async () => {
    const noIncidentsMetrics: DashboardMetricsResponse = {
      ...mockFullMetrics,
      recent_incidents: [],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noIncidentsMetrics),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('recent-incidents-empty')).toBeInTheDocument();
    });

    expect(screen.getByText(/Nenhum incidente operacional registrado/i)).toBeInTheDocument();
  });

  it('should handle period switching between 24h, 7d and 30d with URL updates and fetch prevention for active period', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFullMetrics),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('metric-active-automations')).toBeInTheDocument();
    });

    const btn24h = screen.getByTestId('period-btn-24h');
    const btn7d = screen.getByTestId('period-btn-7d');

    // 7d is default and should be disabled
    expect(btn7d).toBeDisabled();

    // Click on 7d should not trigger new push or fetch
    fireEvent.click(btn7d);
    expect(mockPush).not.toHaveBeenCalled();

    // Click on 24h should push to URL and fetch 24h metrics
    fireEvent.click(btn24h);
    expect(mockPush).toHaveBeenCalledWith('/dashboard?period=24h');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=24h'),
        expect.anything(),
      );
    });
  });

  it('should render RFC 7807 error alert on API failure and retry when clicking "Tentar novamente"', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ detail: 'PostgreSQL connection pool exhausted' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFullMetrics),
      });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error-alert')).toBeInTheDocument();
    });

    expect(screen.getByText('PostgreSQL connection pool exhausted')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /tentar novamente/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('metric-active-automations')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('dashboard-error-alert')).not.toBeInTheDocument();
  });
});
