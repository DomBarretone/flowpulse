import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClerkAuthGuard } from '../src/common/guards/clerk-auth.guard';
import { ClerkService } from '../src/users/clerk.service';
import { UsersService } from '../src/users/users.service';
import { Role, User } from '@prisma/client';

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;
  let clerkService: jest.Mocked<ClerkService>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: User = {
    id: 'user-uuid-1',
    clerk_user_id: 'clerk-user-1',
    email: 'user@flowpulse.io',
    name: 'User FlowPulse',
    role: Role.ANALYST,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    clerkService = {
      verify: jest.fn(),
      getUserDetails: jest.fn(),
    } as unknown as jest.Mocked<ClerkService>;

    usersService = {
      resolveUserFromClerk: jest.fn().mockResolvedValue(mockUser),
    } as unknown as jest.Mocked<UsersService>;

    guard = new ClerkAuthGuard(clerkService, usersService);
  });

  const createMockContext = (
    headers: Record<string, string>,
  ): { context: ExecutionContext; request: Record<string, unknown> } => {
    const request: Record<string, unknown> = { headers };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  it('should allow access and attach user to request when token is valid', async () => {
    const { context, request } = createMockContext({
      authorization: 'Bearer valid.jwt.token',
    });

    clerkService.verify.mockResolvedValue({ sub: 'clerk-user-1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(clerkService.verify).toHaveBeenCalledWith('valid.jwt.token');
    expect(usersService.resolveUserFromClerk).toHaveBeenCalledWith({ sub: 'clerk-user-1' });
    expect(request.user).toEqual(mockUser);
  });

  it('should throw UnauthorizedException when authorization header is missing', async () => {
    const { context } = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Missing or invalid authorization token',
    );
  });

  it('should throw UnauthorizedException when authorization header does not start with Bearer', async () => {
    const { context } = createMockContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is empty', async () => {
    const { context } = createMockContext({
      authorization: 'Bearer   ',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token verification fails (invalid or expired)', async () => {
    const { context } = createMockContext({
      authorization: 'Bearer invalid.expired.token',
    });

    clerkService.verify.mockRejectedValue(new Error('Token is expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token payload has no sub claim', async () => {
    const { context } = createMockContext({
      authorization: 'Bearer token.without.sub',
    });

    clerkService.verify.mockResolvedValue({ sub: '' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
