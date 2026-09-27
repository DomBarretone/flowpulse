import { ExecutionContext } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';

function getParamDecoratorFactory(decorator: (...dataOrPipes: unknown[]) => ParameterDecorator) {
  class TestClass {
    testMethod(@decorator() _user: unknown) {
      return _user;
    }
  }
  const metadata = Reflect.getMetadata('__routeArguments__', TestClass, 'testMethod');
  const key = Object.keys(metadata)[0];
  return metadata[key].factory;
}

describe('@CurrentUser Decorator', () => {
  const factory = getParamDecoratorFactory(CurrentUser);

  const mockUser: User = {
    id: 'user-uuid-1',
    clerk_user_id: 'clerk-user-1',
    email: 'test@flowpulse.io',
    name: 'Test User',
    role: Role.ANALYST,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const createMockContext = (user?: User): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should return the full user object when no property is specified', () => {
    const context = createMockContext(mockUser);
    const result = factory(undefined, context);
    expect(result).toEqual(mockUser);
  });

  it('should return a specific property of the user when specified', () => {
    const context = createMockContext(mockUser);
    const roleResult = factory('role', context);
    expect(roleResult).toBe(Role.ANALYST);

    const emailResult = factory('email', context);
    expect(emailResult).toBe('test@flowpulse.io');
  });

  it('should return undefined if user is not present on request', () => {
    const context = createMockContext(undefined);
    const result = factory(undefined, context);
    expect(result).toBeUndefined();
  });
});
