import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AutomationStatus, Criticality, IntegrationStatus } from '@prisma/client';
import { AutomationsService } from '../src/automations/automations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApiKeyService } from '../src/api-keys/api-key.service';

describe('AutomationsService', () => {
  let service: AutomationsService;
  type MockAutomationsPrisma = {
    automation: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let mockPrisma: MockAutomationsPrisma;
  let mockApiKeyService: jest.Mocked<Pick<ApiKeyService, 'createApiKey' | 'revokeApiKey'>>;

  beforeEach(() => {
    mockPrisma = {
      automation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockApiKeyService = {
      createApiKey: jest.fn(),
      revokeApiKey: jest.fn(),
    };

    service = new AutomationsService(
      mockPrisma as unknown as PrismaService,
      mockApiKeyService as unknown as ApiKeyService,
    );
  });

  describe('create', () => {
    it('should create automation in DRAFT status and PENDING integration_status with authenticated owner', async () => {
      const createDto = {
        name: 'Payroll Automation',
        description: 'Monthly payroll processor',
        criticality: Criticality.HIGH,
        expected_duration_seconds: 300,
      };

      mockPrisma.automation.create.mockResolvedValue({
        id: 'aut-1',
        ...createDto,
        owner_id: 'user-admin-1',
        status: AutomationStatus.DRAFT,
        integration_status: IntegrationStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.create(createDto, 'user-admin-1');

      expect(mockPrisma.automation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Payroll Automation',
            owner_id: 'user-admin-1',
            status: AutomationStatus.DRAFT,
            integration_status: IntegrationStatus.PENDING,
          }),
        }),
      );
      expect(result.status).toBe(AutomationStatus.DRAFT);
      expect(result.integration_status).toBe(IntegrationStatus.PENDING);
    });
  });

  describe('activate', () => {
    it('should throw UnprocessableEntityException if integration_status is PENDING', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue({
        id: 'aut-1',
        status: AutomationStatus.DRAFT,
        integration_status: IntegrationStatus.PENDING,
      });

      await expect(service.activate('aut-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException if integration_status is FAILED', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue({
        id: 'aut-1',
        status: AutomationStatus.DRAFT,
        integration_status: IntegrationStatus.FAILED,
      });

      await expect(service.activate('aut-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should activate automation if integration_status is VALIDATED', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue({
        id: 'aut-1',
        status: AutomationStatus.DRAFT,
        integration_status: IntegrationStatus.VALIDATED,
      });

      mockPrisma.automation.update.mockResolvedValue({
        id: 'aut-1',
        status: AutomationStatus.ACTIVE,
        integration_status: IntegrationStatus.VALIDATED,
      });

      const result = await service.activate('aut-1');

      expect(mockPrisma.automation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'aut-1' },
          data: { status: AutomationStatus.ACTIVE },
        }),
      );
      expect(result.status).toBe(AutomationStatus.ACTIVE);
    });
  });

  describe('deactivate', () => {
    it('should transition automation status to INACTIVE', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue({
        id: 'aut-1',
        status: AutomationStatus.ACTIVE,
      });

      mockPrisma.automation.update.mockResolvedValue({
        id: 'aut-1',
        status: AutomationStatus.INACTIVE,
      });

      const result = await service.deactivate('aut-1');

      expect(mockPrisma.automation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'aut-1' },
          data: { status: AutomationStatus.INACTIVE },
        }),
      );
      expect(result.status).toBe(AutomationStatus.INACTIVE);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if automation does not exist', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('aut-999')).rejects.toThrow(NotFoundException);
    });
  });
});
