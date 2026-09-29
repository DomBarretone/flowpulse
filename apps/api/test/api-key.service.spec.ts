import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiKeyService } from '../src/api-keys/api-key.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JsonLoggerService } from '../src/common/logging/json-logger.service';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  type MockApiKeyPrisma = {
    automation: { findUnique: jest.Mock };
    apiKey: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let mockPrisma: MockApiKeyPrisma;
  let mockLogger: { log: jest.Mock; error: jest.Mock; warn: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    mockPrisma = {
      automation: {
        findUnique: jest.fn(),
      },
      apiKey: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    service = new ApiKeyService(
      mockPrisma as unknown as PrismaService,
      mockLogger as unknown as JsonLoggerService,
    );
  });

  describe('generateRawKey and hashKey', () => {
    it('should generate a 256-bit entropy key starting with fp_live_', () => {
      const key = service.generateRawKey();
      expect(key.startsWith('fp_live_')).toBe(true);
      // 64 hex characters (32 bytes = 256 bits) + 8 chars for "fp_live_"
      expect(key.length).toBe(8 + 64);
    });

    it('should generate deterministic SHA-256 hash', () => {
      const testKey = 'fp_live_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const expectedHash = crypto.createHash('sha256').update(testKey).digest('hex');
      expect(service.hashKey(testKey)).toBe(expectedHash);
    });
  });

  describe('createApiKey', () => {
    it('should throw NotFoundException if automation does not exist', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue(null);

      await expect(service.createApiKey('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should persist key_hash and prefix, and return the raw secret one-time', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue({ id: 'aut-1', name: 'Auto 1' });
      mockPrisma.apiKey.create.mockImplementation(
        ({ data }: { data: { automation_id: string; key_hash: string; prefix: string } }) => {
          return Promise.resolve({
            id: 'key-uuid-1',
            automation_id: data.automation_id,
            key_hash: data.key_hash,
            prefix: data.prefix,
            created_at: new Date('2026-09-27T19:00:00Z'),
            revoked_at: null,
            last_used_at: null,
          });
        },
      );

      const result = await service.createApiKey('aut-1');

      expect(result.id).toBe('key-uuid-1');
      expect(result.secret.startsWith('fp_live_')).toBe(true);
      expect(result.prefix).toBe(result.secret.substring(0, 16));

      // Check what was sent to Prisma: key_hash must be SHA-256 of result.secret, never raw secret
      const createCall = mockPrisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.key_hash).toBe(service.hashKey(result.secret));
      expect(createCall.data.secret).toBeUndefined();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'api_key_generated',
          automation_id: 'aut-1',
          key_id: 'key-uuid-1',
          prefix: result.prefix,
        }),
      );
      const logCall = mockLogger.log.mock.calls.find(
        (c) => c[0]?.event_name === 'api_key_generated',
      )?.[0];
      expect(logCall?.secret).toBeUndefined();
    });
  });

  describe('revokeApiKey', () => {
    it('should throw NotFoundException if key does not exist for automation', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revokeApiKey('aut-1', 'key-999')).rejects.toThrow(NotFoundException);
    });

    it('should update revoked_at and return safe key without hash', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', automation_id: 'aut-1' });
      mockPrisma.apiKey.update.mockResolvedValue({
        id: 'key-1',
        automation_id: 'aut-1',
        prefix: 'fp_live_abcd1234',
        created_at: new Date(),
        revoked_at: new Date(),
        last_used_at: null,
      });

      const result = await service.revokeApiKey('aut-1', 'key-1');
      expect(result.revoked_at).toBeDefined();
      expect((result as unknown as { key_hash?: unknown }).key_hash).toBeUndefined();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'api_key_revoked',
          automation_id: 'aut-1',
          key_id: 'key-1',
          prefix: 'fp_live_abcd1234',
        }),
      );
    });
  });

  describe('findValidKeyWithAutomation', () => {
    it('should return null if key is not found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await service.findValidKeyWithAutomation('fp_live_invalid');
      expect(result).toBeNull();
    });

    it('should return null if key is revoked', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        revoked_at: new Date(),
        automation: { id: 'aut-1' },
      });

      const result = await service.findValidKeyWithAutomation('fp_live_revoked');
      expect(result).toBeNull();
    });

    it('should return safe key and automation if valid and active', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        key_hash: 'hashed',
        prefix: 'fp_live_1234',
        revoked_at: null,
        created_at: new Date(),
        last_used_at: null,
        automation: { id: 'aut-1', name: 'Auto 1' },
      });

      const result = await service.findValidKeyWithAutomation('fp_live_valid');
      expect(result).not.toBeNull();
      expect(result?.automation.id).toBe('aut-1');
      expect((result?.apiKey as unknown as { key_hash?: unknown }).key_hash).toBeUndefined();
    });
  });
});
