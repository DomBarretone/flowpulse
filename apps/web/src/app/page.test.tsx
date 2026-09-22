import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the FlowPulse title and operational status indicator', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FlowPulse');
    expect(screen.getByText(/Application is running/i)).toBeInTheDocument();
  });
});
