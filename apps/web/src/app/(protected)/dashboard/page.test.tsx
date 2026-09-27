import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';
import { auth } from '@clerk/nextjs/server';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@clerk/nextjs', () => ({
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sign-out-wrapper">{children}</div>
  ),
  UserButton: () => <div data-testid="user-button">UserButton Mock</div>,
}));

describe('DashboardPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch /users/me with Bearer token and render ADMIN role and user details from backend', async () => {
    const mockGetToken = jest.fn().mockResolvedValue('mock-admin-token');
    (auth as unknown as jest.Mock).mockResolvedValue({
      getToken: mockGetToken,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'admin-uuid-1',
        clerk_user_id: 'clerk_admin_123',
        email: 'admin@flowpulse.io',
        name: 'Admin User',
        role: 'ADMIN',
        created_at: '2026-09-27T21:00:00.000Z',
        updated_at: '2026-09-27T21:00:00.000Z',
      }),
    });

    const Component = await DashboardPage();
    render(Component);

    // Verify token was retrieved and fetch was invoked with Bearer token
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-admin-token',
        }),
      }),
    );

    // Verify authoritative role rendered from PostgreSQL
    const badge = screen.getByTestId('user-role-badge');
    expect(badge).toHaveTextContent('ADMIN');
    expect(screen.getByTestId('user-email')).toHaveTextContent('admin@flowpulse.io');
    expect(screen.getByTestId('clerk-user-id')).toHaveTextContent('clerk_admin_123');
    expect(screen.getByTestId('user-internal-id')).toHaveTextContent('admin-uuid-1');

    // Verify logout button is available
    expect(screen.getByText('Encerrar Sessão')).toBeInTheDocument();
  });

  it('should fetch /users/me and render ANALYST role from backend', async () => {
    const mockGetToken = jest.fn().mockResolvedValue('mock-analyst-token');
    (auth as unknown as jest.Mock).mockResolvedValue({
      getToken: mockGetToken,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'analyst-uuid-2',
        clerk_user_id: 'clerk_analyst_456',
        email: 'analyst@flowpulse.io',
        name: 'Analyst User',
        role: 'ANALYST',
        created_at: '2026-09-27T21:00:00.000Z',
        updated_at: '2026-09-27T21:00:00.000Z',
      }),
    });

    const Component = await DashboardPage();
    render(Component);

    const badge = screen.getByTestId('user-role-badge');
    expect(badge).toHaveTextContent('ANALYST');
    expect(screen.getByTestId('user-email')).toHaveTextContent('analyst@flowpulse.io');
  });

  it('should render a controlled error message and not fake data when the API fails', async () => {
    const mockGetToken = jest.fn().mockResolvedValue('mock-token');
    (auth as unknown as jest.Mock).mockResolvedValue({
      getToken: mockGetToken,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: jest.fn().mockResolvedValue(JSON.stringify({ detail: 'Backend database unreachable' })),
    });

    const Component = await DashboardPage();
    render(Component);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Falha ao carregar perfil persistido no backend/i)).toBeInTheDocument();
    expect(screen.getByText(/Backend database unreachable/i)).toBeInTheDocument();
    expect(screen.queryByTestId('user-role-badge')).not.toBeInTheDocument();
  });
});
