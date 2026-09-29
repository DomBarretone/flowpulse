import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewAutomationPage from './page';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('NewAutomationPage', () => {
  const mockPush = jest.fn();
  const mockGetToken = jest.fn().mockResolvedValue('test-token');
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as unknown as jest.Mock).mockReturnValue({ getToken: mockGetToken });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should render all form inputs with accessible labels', () => {
    render(<NewAutomationPage />);

    expect(screen.getByTestId('automation-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('automation-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('automation-criticality-select')).toBeInTheDocument();
    expect(screen.getByTestId('automation-duration-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-automation-button')).toBeInTheDocument();
  });

  it('should show client-side validation errors when required fields are empty or invalid', async () => {
    render(<NewAutomationPage />);

    // Clear duration input
    fireEvent.change(screen.getByTestId('automation-duration-input'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('submit-automation-button'));

    expect(await screen.findByText('O nome da automação é obrigatório.')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'A duração esperada deve ser um número inteiro estritamente positivo (> 0).',
      ),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should submit valid payload and redirect to /automations/[id] on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'created-auto-123',
          name: 'New Pipeline',
          criticality: 'HIGH',
          expected_duration_seconds: 150,
        }),
    });

    render(<NewAutomationPage />);

    fireEvent.change(screen.getByTestId('automation-name-input'), {
      target: { value: 'New Pipeline' },
    });
    fireEvent.change(screen.getByTestId('automation-description-input'), {
      target: { value: 'Pipeline description' },
    });
    fireEvent.change(screen.getByTestId('automation-criticality-select'), {
      target: { value: 'HIGH' },
    });
    fireEvent.change(screen.getByTestId('automation-duration-input'), {
      target: { value: '150' },
    });

    fireEvent.click(screen.getByTestId('submit-automation-button'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/automations'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            name: 'New Pipeline',
            description: 'Pipeline description',
            criticality: 'HIGH',
            expected_duration_seconds: 150,
          }),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith('/automations/created-auto-123');
    });
  });

  it('should show API error feedback if creation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({
          detail: 'Automation name already exists',
        }),
    });

    render(<NewAutomationPage />);

    fireEvent.change(screen.getByTestId('automation-name-input'), {
      target: { value: 'Duplicate Pipeline' },
    });
    fireEvent.click(screen.getByTestId('submit-automation-button'));

    expect(await screen.findByTestId('api-error-alert')).toBeInTheDocument();
    expect(screen.getByText('Automation name already exists')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
