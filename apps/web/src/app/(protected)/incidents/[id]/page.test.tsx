import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { IncidentDetailView } from '../../../../components/incidents/incident-detail-view';
import { useAuth } from '@clerk/nextjs';

jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(),
}));

describe('IncidentDetailView Component', () => {
  const mockGetToken = jest.fn().mockResolvedValue('test-analyst-token');
  const originalFetch = global.fetch;

  const mockUser = {
    id: 'usr-analyst-1',
    role: 'ANALYST',
    name: 'Analyst One',
    email: 'analyst1@flowpulse.io',
  };

  const mockOpenIncident = {
    id: 'inc-test-101',
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
      name: 'Order Pipeline',
      criticality: 'HIGH',
    },
    execution: {
      id: 'exec-1',
      external_execution_id: 'ext-999',
      status: 'FAILED',
      started_at: '2026-09-27T10:00:00Z',
      finished_at: '2026-09-27T10:01:00Z',
      duration_ms: 60000,
      error_message: 'Error with token Bearer [REDACTED] and [REDACTED]',
      is_test: false,
    },
    assigned_to: null,
  };

  const mockInvestigatingIncident = {
    ...mockOpenIncident,
    status: 'INVESTIGATING',
    assigned_to_id: mockUser.id,
    acknowledged_at: '2026-09-27T10:05:00Z',
    investigating_at: '2026-09-27T10:10:00Z',
    assigned_to: mockUser,
  };

  const mockAiAnalysis = {
    id: 'ai-analysis-1',
    incident_id: 'inc-test-101',
    requested_by_id: mockUser.id,
    model: 'anthropic/claude-haiku-4.5',
    summary: 'Falha transitória na comunicação externa.',
    likely_causes: [
      {
        cause: 'Timeout do gateway',
        rationale: 'O serviço demorou mais de 60s para responder.',
      },
    ],
    evidence: ['Log de timeout no endpoint'],
    next_steps: ['Reiniciar o worker'],
    confidence: 0.85,
    provider_request_id: 'req-123',
    latency_ms: 450,
    created_at: '2026-09-27T10:12:00Z',
    requested_by: mockUser,
  };

  const mockEvents = [
    {
      id: 'evt-1',
      incident_id: 'inc-test-101',
      actor_user_id: mockUser.id,
      event_type: 'ACKNOWLEDGED',
      from_status: 'OPEN',
      to_status: 'ACKNOWLEDGED',
      note: 'Assumido por Analyst One',
      created_at: '2026-09-27T10:05:00Z',
      actor: mockUser,
    },
    {
      id: 'evt-2',
      incident_id: 'inc-test-101',
      actor_user_id: mockUser.id,
      event_type: 'INVESTIGATION_STARTED',
      from_status: 'ACKNOWLEDGED',
      to_status: 'INVESTIGATING',
      note: 'Investigação iniciada',
      created_at: '2026-09-27T10:10:00Z',
      actor: mockUser,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      getToken: mockGetToken,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should render OPEN incident with "Assumir Incidente" button and sanitized error log', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUser) });
      }
      if (url.includes('/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/ai-analyses')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/incidents/inc-test-101')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOpenIncident) });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<IncidentDetailView incidentId="inc-test-101" />);

    await waitFor(() => {
      expect(screen.getByTestId('incident-detail-view')).toBeInTheDocument();
    });

    expect(screen.getByText('Order Pipeline')).toBeInTheDocument();
    expect(screen.getByTestId('btn-acknowledge')).toBeInTheDocument();
    expect(screen.getByTestId('sanitized-error-log')).toHaveTextContent(
      'Error with token Bearer [REDACTED] and [REDACTED]',
    );
  });

  it('should render INVESTIGATING incident with "Analisar com IA", "Resolver Incidente", and AI card with advisory disclaimer', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUser) });
      }
      if (url.includes('/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEvents) });
      }
      if (url.includes('/ai-analyses')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([mockAiAnalysis]) });
      }
      if (url.includes('/incidents/inc-test-101')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInvestigatingIncident),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<IncidentDetailView incidentId="inc-test-101" />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-request-ai')).toBeInTheDocument();
      expect(screen.getByTestId('btn-resolve')).toBeInTheDocument();
    });

    // AI Analysis card com aviso consultivo
    expect(screen.getByText(/Análise assistida por IA/i)).toBeInTheDocument();
    expect(screen.getByText(/Aviso Consultivo/i)).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(screen.getByText('Timeout do gateway')).toBeInTheDocument();
    expect(screen.getByText('Reiniciar o worker')).toBeInTheDocument();

    // Timeline
    expect(screen.getByTestId('timeline-event-ACKNOWLEDGED')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-event-INVESTIGATION_STARTED')).toBeInTheDocument();
  });

  it('should display non-obstructive alert when AI request fails with 503', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST' && url.includes('/ai-analysis')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ detail: 'OpenRouter service unavailable' }),
        });
      }
      if (url.includes('/users/me')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUser) });
      }
      if (url.includes('/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/ai-analyses')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/incidents/inc-test-101')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInvestigatingIncident),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<IncidentDetailView incidentId="inc-test-101" />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-request-ai')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-request-ai'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-error-banner')).toBeInTheDocument();
      expect(
        screen.getByText(/O serviço de inteligência artificial está temporariamente indisponível/i),
      ).toBeInTheDocument();
    });

    // Botão de resolver continua acessível
    expect(screen.getByTestId('btn-resolve')).toBeInTheDocument();
  });

  it('should open resolution modal, validate >= 10 characters and submit successfully', async () => {
    let resolvedStatus = false;
    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST' && url.includes('/resolve')) {
        resolvedStatus = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockInvestigatingIncident,
              status: 'RESOLVED',
              resolution_notes: 'Reiniciado o serviço e reprocessada a mensagem com sucesso.',
            }),
        });
      }
      if (url.includes('/users/me')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUser) });
      }
      if (url.includes('/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/ai-analyses')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/incidents/inc-test-101')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              resolvedStatus
                ? {
                    ...mockInvestigatingIncident,
                    status: 'RESOLVED',
                    resolution_notes: 'Reiniciado o serviço e reprocessada a mensagem com sucesso.',
                  }
                : mockInvestigatingIncident,
            ),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<IncidentDetailView incidentId="inc-test-101" />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-resolve')).toBeInTheDocument();
    });

    // Abrir modal
    fireEvent.click(screen.getByTestId('btn-resolve'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const textarea = screen.getByLabelText(/Notas de Resolução/i);
    const submitBtn = screen.getByRole('button', { name: /Confirmar Resolução/i });

    // Inicialmente desabilitado (0 caracteres)
    expect(submitBtn).toBeDisabled();

    // Digitar menos de 10 caracteres
    fireEvent.change(textarea, { target: { value: 'Curto' } });
    expect(submitBtn).toBeDisabled();

    // Digitar mais de 10 caracteres válidos
    fireEvent.change(textarea, {
      target: { value: 'Reiniciado o serviço e reprocessada a mensagem com sucesso.' },
    });
    expect(submitBtn).not.toBeDisabled();

    // Submeter
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(/Incidente Concluído/i)).toBeInTheDocument();
    });
  });
});
