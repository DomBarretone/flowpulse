import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import IncidentsPage from './page';
import { useAuth } from '@clerk/nextjs';

jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(),
}));

describe('IncidentsPage Component', () => {
  const mockGetToken = jest.fn().mockResolvedValue('test-analyst-token');
  const originalFetch = global.fetch;

  const mockIncidentsResponse = {
    items: [
      {
        id: 'inc-1',
        automation_id: 'aut-1',
        execution_id: 'exec-1',
        status: 'OPEN',
        severity: 'HIGH',
        assigned_to_id: null,
        opened_at: '2026-09-27T10:00:00Z',
        acknowledged_at: null,
        investigating_at: null,
        resolved_at: null,
        resolution_notes: null,
        created_at: '2026-09-27T10:00:00Z',
        updated_at: '2026-09-27T10:00:00Z',
        automation: {
          id: 'aut-1',
          name: 'Order Processing',
          criticality: 'HIGH',
        },
        assigned_to: null,
      },
      {
        id: 'inc-2',
        automation_id: 'aut-2',
        execution_id: 'exec-2',
        status: 'RESOLVED',
        severity: 'CRITICAL',
        assigned_to_id: 'usr-1',
        opened_at: '2026-09-27T09:00:00Z',
        acknowledged_at: '2026-09-27T09:05:00Z',
        investigating_at: '2026-09-27T09:10:00Z',
        resolved_at: '2026-09-27T09:30:00Z',
        resolution_notes: 'Resolved successfully with service restart.',
        created_at: '2026-09-27T09:00:00Z',
        updated_at: '2026-09-27T09:30:00Z',
        automation: {
          id: 'aut-2',
          name: 'Billing Notification',
          criticality: 'CRITICAL',
        },
        assigned_to: {
          id: 'usr-1',
          name: 'Operador John',
          email: 'john@flowpulse.io',
        },
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      getToken: mockGetToken,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should render loading state initially and then render table with items and badges', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIncidentsResponse),
    });

    render(<IncidentsPage />);

    expect(screen.getByTestId('incidents-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Order Processing')).toBeInTheDocument();
      expect(screen.getByText('Billing Notification')).toBeInTheDocument();
    });

    expect(screen.getByTestId('incident-row-inc-1')).toBeInTheDocument();
    expect(screen.getByTestId('incident-row-inc-2')).toBeInTheDocument();

    // Badges
    expect(screen.getByTestId('incident-status-badge-open')).toBeInTheDocument();
    expect(screen.getByTestId('incident-status-badge-resolved')).toBeInTheDocument();
    expect(screen.getByTestId('incident-severity-badge-high')).toBeInTheDocument();
    expect(screen.getByTestId('incident-severity-badge-critical')).toBeInTheDocument();

    // Responsável
    expect(screen.getByText('Não atribuído')).toBeInTheDocument();
    expect(screen.getByText('Operador John')).toBeInTheDocument();
  });

  it('should render empty state when no incidents are returned', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
    });

    render(<IncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('incidents-empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/Nenhum incidente encontrado/i)).toBeInTheDocument();
  });

  it('should filter incidents by status when selector changes', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIncidentsResponse),
    });
    global.fetch = fetchMock;

    render(<IncidentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Order Processing')).toBeInTheDocument();
    });

    // Mudar filtro de status para OPEN
    fireEvent.change(screen.getByTestId('filter-status'), {
      target: { value: 'OPEN' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('status=OPEN'),
        expect.anything(),
      );
    });
  });

  it('should display error banner when API call fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Erro interno no servidor' }),
    });

    render(<IncidentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('incidents-error-banner')).toBeInTheDocument();
      expect(screen.getByText('Erro interno no servidor')).toBeInTheDocument();
    });
  });
});
