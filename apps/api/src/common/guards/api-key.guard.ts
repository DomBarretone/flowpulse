import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from '../../api-keys/api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    const trimmedKey = apiKeyHeader.trim();
    if (!trimmedKey.startsWith('fp_live_') || trimmedKey.length < 16) {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    const result = await this.apiKeyService.findValidKeyWithAutomation(trimmedKey);
    if (!result || !result.automation) {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    await this.apiKeyService.updateLastUsedAt(result.apiKey.id);

    request.automation = result.automation;
    request.apiKey = result.apiKey;

    return true;
  }
}
