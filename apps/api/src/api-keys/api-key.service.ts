import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKey, Automation } from '@prisma/client';
import { JsonLoggerService } from '../common/logging/json-logger.service';

export interface GeneratedApiKeyResponse {
  id: string;
  prefix: string;
  secret: string;
  created_at: Date;
}

export type SafeApiKey = Omit<ApiKey, 'key_hash'>;

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly logger: JsonLoggerService = new JsonLoggerService(),
  ) {}

  generateRawKey(): string {
    const randomHex = crypto.randomBytes(32).toString('hex');
    return `fp_live_${randomHex}`;
  }

  hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  async createApiKey(automationId: string): Promise<GeneratedApiKeyResponse> {
    const automation = await this.prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const prefix = rawKey.substring(0, 16);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        automation_id: automationId,
        key_hash: keyHash,
        prefix,
      },
    });

    this.logger.log({
      event_name: 'api_key_generated',
      automation_id: automationId,
      key_id: apiKey.id,
      prefix: apiKey.prefix,
    });

    return {
      id: apiKey.id,
      prefix: apiKey.prefix,
      secret: rawKey,
      created_at: apiKey.created_at,
    };
  }

  async revokeApiKey(automationId: string, keyId: string): Promise<SafeApiKey> {
    const key = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        automation_id: automationId,
      },
    });

    if (!key) {
      throw new NotFoundException('API Key not found for this automation');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revoked_at: new Date() },
      select: {
        id: true,
        automation_id: true,
        prefix: true,
        created_at: true,
        revoked_at: true,
        last_used_at: true,
      },
    });

    this.logger.log({
      event_name: 'api_key_revoked',
      automation_id: automationId,
      key_id: keyId,
      prefix: updated.prefix,
    });

    return updated as SafeApiKey;
  }

  async findValidKeyWithAutomation(
    rawKey: string,
  ): Promise<{ apiKey: SafeApiKey; automation: Automation } | null> {
    const keyHash = this.hashKey(rawKey);
    const record = await this.prisma.apiKey.findUnique({
      where: { key_hash: keyHash },
      include: { automation: true },
    });

    if (!record || record.revoked_at !== null) {
      return null;
    }

    const { key_hash: _hash, ...safeApiKey } = record;
    return {
      apiKey: safeApiKey,
      automation: record.automation,
    };
  }

  async updateLastUsedAt(keyId: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { last_used_at: new Date() },
    });
  }

  async listKeys(automationId: string): Promise<SafeApiKey[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { automation_id: automationId },
      select: {
        id: true,
        automation_id: true,
        prefix: true,
        created_at: true,
        revoked_at: true,
        last_used_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return keys as SafeApiKey[];
  }
}
