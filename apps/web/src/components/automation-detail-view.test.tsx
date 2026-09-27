import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutomationDetailView } from './automation-detail-view';
import { Automation } from '../lib/api/automations';
import { ExecutionItem } from '../lib/api/executions';
import { useAuth } from '@clerk/nextjs';

jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(),
}));

describe('AutomationDetailView Component', () => {
  const mockGetToken = jest.fn().mockResolvedValue('test-token');
  const originalFetch = global.fetch;

  const mockPendingAutomation: Automation = {
    id: 'aut-test-1',
    name: 'Payroll Automation',
    description: 'Processes monthly payroll',
    owner_id: 'user-1',
    criticality: 'HIGH',
    expected_duration_seconds: 120,
    status: 'DRAFT',
    integration_status: 'PENDING',
    created_at: '2026-09-27T19:00:00Z',
    updated_at: '2026-09-27T19:00:00Z',
    api_keys: [
      {
        id: 'key-1',
        prefix: 'fp_live_e4d9',
        created_at: '2026-09-27T19:10:00Z',
        revoked_at: null,
        last_used_at: null,
      },
    ],
  };

  const mockValidatedAutomation: Automation = {
    ...mockPendingAutomation,
    integration_status: 'VALIDATED',
  };

  const mockExecutions: ExecutionItem[] = [
    {
      id: 'exec-1',
      automation_id: 'aut-test-1',
      external_execution_id: 'run-test-001',
      status: 'SUCCESS',
      started_at: '2026-09-27T19:15:00Z',
      finished_at: '2026-09-27T19:15:02Z',
      duration_ms: 2000,
      error_message: null,
      is_test: true,
      created_at: '2026-09-27T19:15:00Z',
      incident: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as unknown as jest.Mock).mockReturnValue({ getToken: mockGetToken });
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should render automation details, parameters and executions', () => {
    render(
      <AutomationDetailView
        initialAutomation={mockPendingAutomation}
        initialExecutions={mockExecutions}
        isAdmin={true}
      />,
    );

    expect(screen.getByText('Payroll Automation')).toBeInTheDocument();
    expect(screen.getByText('Processes monthly payroll')).toBeInTheDocument();
    expect(screen.getByText('120 segundos')).toBeInTheDocument();
    expect(screen.getAllByTestId('integration-badge-pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('status-badge-draft').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('criticality-badge-high')).toBeInTheDocument();

    // Executions table
    expect(screen.getByText('run-test-001')).toBeInTheDocument();
    expect(screen.getByTestId('execution-test-badge')).toBeInTheDocument();
    expect(screen.getByTestId('execution-badge-success')).toBeInTheDocument();

    // Keys table: prefix only
    expect(screen.getByText('fp_live_e4d9...')).toBeInTheDocument();
    expect(screen.queryByText(/key_hash/i)).not.toBeInTheDocument();
  });

  it('should render activation button DISABLED when integration_status is PENDING', () => {
    render(
      <AutomationDetailView
        initialAutomation={mockPendingAutomation}
        initialExecutions={[]}
        isAdmin={true}
      />,
    );

    const activateBtn = screen.getByTestId('activate-automation-button');
    expect(activateBtn).toBeDisabled();
    expect(screen.getByTestId('activation-blocked-tooltip')).toBeInTheDocument();
  });

  it('should render activation button ENABLED when integration_status is VALIDATED and activate on click', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...mockValidatedAutomation,
          status: 'ACTIVE',
        }),
    });

    render(
      <AutomationDetailView
        initialAutomation={mockValidatedAutomation}
        initialExecutions={[]}
        isAdmin={true}
      />,
    );

    const activateBtn = screen.getByTestId('activate-automation-button');
    expect(activateBtn).not.toBeDisabled();

    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/automations/aut-test-1/activate'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByTestId('detail-success-alert')).toBeInTheDocument();
      expect(screen.getByText('Monitoramento ativado com sucesso!')).toBeInTheDocument();
    });
  });

  it('should generate API key, display secret ONE-TIME in volatile modal, and discard cleanly on close without persisting in storage', async () => {
    const rawSecret = 'fp_live_88889999aaaabbbbccccddddeeeeffff00001111222233334444555566667777';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'key-new-2',
          prefix: 'fp_live_8888',
          secret: rawSecret,
          created_at: new Date().toISOString(),
        }),
    });

    render(
      <AutomationDetailView
        initialAutomation={mockPendingAutomation}
        initialExecutions={[]}
        isAdmin={true}
      />,
    );

    // Click generate button
    fireEvent.click(screen.getByTestId('generate-key-button'));

    // Confirmation modal appears
    expect(screen.getByTestId('generate-confirm-modal')).toBeInTheDocument();

    // Confirm generation
    fireEvent.click(screen.getByTestId('confirm-generate-key-button'));

    // Volatile secret modal appears
    await waitFor(() => {
      expect(screen.getByTestId('volatile-secret-modal')).toBeInTheDocument();
    });

    const secretInput = screen.getByTestId('volatile-secret-input') as HTMLInputElement;
    expect(secretInput.value).toBe(rawSecret);

    // Verify copy button exists
    expect(screen.getByTestId('copy-secret-button')).toBeInTheDocument();

    // Close and discard modal
    fireEvent.click(screen.getByTestId('close-secret-modal-button'));

    // Verify modal and secret are discarded from the DOM
    expect(screen.queryByTestId('volatile-secret-modal')).not.toBeInTheDocument();
    expect(screen.queryByText(rawSecret)).not.toBeInTheDocument();

    // Verify STRICT SECURITY GOVERNANCE: secret was NEVER stored in localStorage, sessionStorage, or cookies!
    expect(localStorage.getItem('secret')).toBeNull();
    expect(localStorage.getItem('api_key')).toBeNull();
    expect(sessionStorage.getItem('secret')).toBeNull();
    expect(sessionStorage.getItem('api_key')).toBeNull();
    expect(document.cookie).not.toContain(rawSecret);
  });

  it('should allow ADMIN to revoke active key', async () => {
    window.confirm = jest.fn().mockReturnValue(true);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'key-1',
          revoked_at: new Date().toISOString(),
        }),
    });

    render(
      <AutomationDetailView
        initialAutomation={mockPendingAutomation}
        initialExecutions={[]}
        isAdmin={true}
      />,
    );

    const revokeBtn = screen.getByTestId('revoke-key-button-key-1');
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/automations/aut-test-1/api-keys/key-1/revoke'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByTestId('key-status-revoked-key-1')).toBeInTheDocument();
    });
  });

  it('should hide administrative controls for ANALYST role', () => {
    render(
      <AutomationDetailView
        initialAutomation={mockPendingAutomation}
        initialExecutions={[]}
        isAdmin={false}
      />,
    );

    expect(screen.queryByTestId('activate-automation-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('generate-key-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('revoke-key-button-key-1')).not.toBeInTheDocument();
  });
});
