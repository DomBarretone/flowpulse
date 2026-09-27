import { render, screen } from '@testing-library/react';
import AutomationsPage from './page';
import { auth } from '@clerk/nextjs/server';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('AutomationsPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should render empty state when no automations exist', async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({
      getToken: jest.fn().mockResolvedValue('admin-token'),
    });

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ role: 'ADMIN' }),
        });
      }
      if (url.includes('/automations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const Component = await AutomationsPage();
    render(Component);

    expect(screen.getByTestId('empty-automations-state')).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma automação cadastrada/i)).toBeInTheDocument();
    expect(screen.getByTestId('create-automation-button')).toBeInTheDocument();
  });

  it('should render automations list with status, criticality and integration badges for ADMIN', async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({
      getToken: jest.fn().mockResolvedValue('admin-token'),
    });

    const mockAutomations = [
      {
        id: 'auto-1',
        name: 'Sync ERP SAP',
        description: 'Sincronização de pedidos',
        criticality: 'HIGH',
        expected_duration_seconds: 120,
        status: 'DRAFT',
        integration_status: 'PENDING',
        created_at: '2026-09-27T19:00:00Z',
        updated_at: '2026-09-27T19:00:00Z',
      },
      {
        id: 'auto-2',
        name: 'Billing Notification',
        description: 'Disparo de faturas',
        criticality: 'CRITICAL',
        expected_duration_seconds: 30,
        status: 'ACTIVE',
        integration_status: 'VALIDATED',
        created_at: '2026-09-27T19:00:00Z',
        updated_at: '2026-09-27T19:00:00Z',
      },
    ];

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ role: 'ADMIN' }),
        });
      }
      if (url.includes('/automations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAutomations),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const Component = await AutomationsPage();
    render(Component);

    expect(screen.getByText('Sync ERP SAP')).toBeInTheDocument();
    expect(screen.getByText('Billing Notification')).toBeInTheDocument();

    expect(screen.getByTestId('automation-row-auto-1')).toBeInTheDocument();
    expect(screen.getByTestId('automation-row-auto-2')).toBeInTheDocument();

    expect(screen.getByTestId('criticality-badge-high')).toBeInTheDocument();
    expect(screen.getByTestId('criticality-badge-critical')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-draft')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-active')).toBeInTheDocument();
    expect(screen.getByTestId('integration-badge-pending')).toBeInTheDocument();
    expect(screen.getByTestId('integration-badge-validated')).toBeInTheDocument();

    expect(screen.getByTestId('create-automation-button')).toBeInTheDocument();
  });

  it('should hide create button and display read-only badge for ANALYST', async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({
      getToken: jest.fn().mockResolvedValue('analyst-token'),
    });

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ role: 'ANALYST' }),
        });
      }
      if (url.includes('/automations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const Component = await AutomationsPage();
    render(Component);

    expect(screen.queryByTestId('create-automation-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('analyst-read-only-badge')).toBeInTheDocument();
  });
});
