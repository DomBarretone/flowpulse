import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { ApiKeyService } from '../src/api-keys/api-key.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockApiKeyService: jest.Mocked<
    Pick<ApiKeyService, 'findValidKeyWithAutomation' | 'updateLastUsedAt'>
  >;

  beforeEach(() => {
    mockApiKeyService = {
      findValidKeyWithAutomation: jest.fn(),
      updateLastUsedAt: jest.fn(),
    };
    guard = new ApiKeyGuard(mockApiKeyService as unknown as ApiKeyService);
  });

  type GuardTestRequest = {
    headers: Record<string, string>;
    automation?: { id: string; name: string };
    apiKey?: { id: string; prefix: string };
  };

  const createMockContext = (
    headers: Record<string, string>,
  ): { context: ExecutionContext; request: GuardTestRequest } => {
    const request = {
      headers,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  it('should throw UnauthorizedException if x-api-key header is missing', async () => {
    const { context } = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if x-api-key format does not start with fp_live_', async () => {
    const { context } = createMockContext({ 'x-api-key': 'invalid_prefix_12345678' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if key is too short', async () => {
    const { context } = createMockContext({ 'x-api-key': 'fp_live_short' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if key is not found or revoked', async () => {
    mockApiKeyService.findValidKeyWithAutomation.mockResolvedValue(null);
    const { context } = createMockContext({
      'x-api-key': 'fp_live_12345678901234567890123456789012',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should authorize, update last_used_at, and inject automation into request when key is valid', async () => {
    const mockAutomation = { id: 'aut-1', name: 'Auto 1' };
    const mockApiKey = { id: 'key-1', prefix: 'fp_live_1234' };
    mockApiKeyService.findValidKeyWithAutomation.mockResolvedValue({
      apiKey: mockApiKey,
      automation: mockAutomation,
    });
    mockApiKeyService.updateLastUsedAt.mockResolvedValue(undefined);

    const { context, request } = createMockContext({
      'x-api-key': 'fp_live_12345678901234567890123456789012',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockApiKeyService.updateLastUsedAt).toHaveBeenCalledWith('key-1');
    expect(request.automation).toEqual(mockAutomation);
    expect(request.apiKey).toEqual(mockApiKey);
  });
});
