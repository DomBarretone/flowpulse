import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from '../src/common/guards/roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: { role: Role }, rolesMetadata?: Role[]): ExecutionContext => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(rolesMetadata);

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access to any authenticated user when no @Roles is defined', () => {
    const context = createMockContext({ role: Role.ANALYST }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when @Roles is an empty array', () => {
    const context = createMockContext({ role: Role.ANALYST }, []);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException (401) if user is not present (precedence over 403)', () => {
    const context = createMockContext(undefined, [Role.ADMIN]);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should allow access to ADMIN when route requires ADMIN', () => {
    const context = createMockContext({ role: Role.ADMIN }, [Role.ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access (403 Forbidden) to ANALYST when route requires ADMIN', () => {
    const context = createMockContext({ role: Role.ANALYST }, [Role.ADMIN]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow access when route allows both ADMIN and ANALYST', () => {
    const contextAnalyst = createMockContext({ role: Role.ANALYST }, [Role.ADMIN, Role.ANALYST]);
    expect(guard.canActivate(contextAnalyst)).toBe(true);

    const contextAdmin = createMockContext({ role: Role.ADMIN }, [Role.ADMIN, Role.ANALYST]);
    expect(guard.canActivate(contextAdmin)).toBe(true);
  });
});
