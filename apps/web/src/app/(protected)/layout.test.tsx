import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtectedLayout from './layout';
import { auth } from '@clerk/nextjs/server';

jest.mock('@clerk/nextjs/server', () => ({
  auth: Object.assign(jest.fn(), {
    protect: jest.fn(),
  }),
}));

jest.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button">UserButton Mock</div>,
}));

describe('ProtectedLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call auth.protect() to enforce server-side route protection and render children', async () => {
    (auth.protect as jest.Mock).mockResolvedValue(undefined);

    const Component = await ProtectedLayout({
      children: <div data-testid="protected-child">Protected Dashboard Content</div>,
    });

    render(Component);

    expect(auth.protect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('protected-child')).toHaveTextContent('Protected Dashboard Content');
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('should block unauthenticated access by propagating redirection from auth.protect()', async () => {
    (auth.protect as jest.Mock).mockRejectedValue(new Error('Redirect to /sign-in'));

    await expect(
      ProtectedLayout({
        children: <div>Secret</div>,
      }),
    ).rejects.toThrow('Redirect to /sign-in');

    expect(auth.protect).toHaveBeenCalledTimes(1);
  });
});
