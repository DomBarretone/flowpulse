import { UnprocessableEntityException } from '@nestjs/common';
import {
  Automation,
  AutomationStatus,
  Criticality,
  ExecutionStatus,
  IncidentSeverity,
  IncidentStatus,
  IntegrationStatus,
  Prisma,
} from '@prisma/client';
import { ExecutionsService } from '../src/executions/executions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { IncidentsService } from '../src/incidents/incidents.service';

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  type MockExecutionsPrisma = {
    execution: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    automation: { update: jest.Mock };
    incident: { create: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let mockPrisma: MockExecutionsPrisma;
  let incidentsService: IncidentsService;

  const mockActiveAutomation: Automation = {
    id: 'aut-active-1',
    name: 'Active Automation',
    description: 'Test',
    owner_id: 'user-1',
    criticality: Criticality.HIGH,
    expected_duration_seconds: 60,
    status: AutomationStatus.ACTIVE,
    integration_status: IntegrationStatus.VALIDATED,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockDraftAutomation: Automation = {
    id: 'aut-draft-1',
    name: 'Draft Automation',
    description: 'Test',
    owner_id: 'user-1',
    criticality: Criticality.MEDIUM,
    expected_duration_seconds: 60,
    status: AutomationStatus.DRAFT,
    integration_status: IntegrationStatus.PENDING,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      execution: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      automation: {
        update: jest.fn(),
      },
      incident: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockPrisma);
        }),
    };

    incidentsService = new IncidentsService(mockPrisma as unknown as PrismaService);
    service = new ExecutionsService(mockPrisma as unknown as PrismaService, incidentsService);
  });

  describe('ingestExecution', () => {
    it('should throw UnprocessableEntityException if productive execution (is_test=false) is sent for non-ACTIVE automation', async () => {
      await expect(
        service.ingestExecution(mockDraftAutomation, {
          external_execution_id: 'ext-001',
          status: ExecutionStatus.SUCCESS,
          started_at: '2026-09-27T19:00:00.000Z',
          is_test: false,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should return existing execution idempotently when already ingested', async () => {
      const existingExecution = {
        id: 'exec-existing-1',
        automation_id: mockActiveAutomation.id,
        external_execution_id: 'ext-001',
        status: ExecutionStatus.SUCCESS,
        started_at: new Date(),
        finished_at: new Date(),
        duration_ms: 1000,
        error_message: null,
        is_test: false,
        created_at: new Date(),
        incident: null,
      };

      mockPrisma.execution.findUnique.mockResolvedValue(existingExecution);

      const result = await service.ingestExecution(mockActiveAutomation, {
        external_execution_id: 'ext-001',
        status: ExecutionStatus.SUCCESS,
        started_at: '2026-09-27T19:00:00.000Z',
        is_test: false,
      });

      expect(result.isExisting).toBe(true);
      expect(result.execution.id).toBe('exec-existing-1');
      expect(result.incidentId).toBeNull();
      expect(mockPrisma.execution.create).not.toHaveBeenCalled();
    });

    it('should validate integration and update integration_status to VALIDATED when is_test=true', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);
      mockPrisma.execution.create.mockResolvedValue({
        id: 'exec-test-1',
        automation_id: mockDraftAutomation.id,
        external_execution_id: 'ext-test-001',
        status: ExecutionStatus.SUCCESS,
        started_at: new Date(),
        is_test: true,
      });

      const result = await service.ingestExecution(mockDraftAutomation, {
        external_execution_id: 'ext-test-001',
        status: ExecutionStatus.SUCCESS,
        started_at: '2026-09-27T19:00:00.000Z',
        is_test: true,
      });

      expect(result.isExisting).toBe(false);
      expect(result.incidentId).toBeNull();
      expect(mockPrisma.automation.update).toHaveBeenCalledWith({
        where: { id: mockDraftAutomation.id },
        data: { integration_status: IntegrationStatus.VALIDATED },
      });
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('should NEVER create incident when is_test=true even if status is FAILED', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);
      mockPrisma.execution.create.mockResolvedValue({
        id: 'exec-test-failed',
        automation_id: mockDraftAutomation.id,
        external_execution_id: 'ext-test-failed',
        status: ExecutionStatus.FAILED,
        started_at: new Date(),
        is_test: true,
      });

      const result = await service.ingestExecution(mockDraftAutomation, {
        external_execution_id: 'ext-test-failed',
        status: ExecutionStatus.FAILED,
        started_at: '2026-09-27T19:00:00.000Z',
        is_test: true,
      });

      expect(result.incidentId).toBeNull();
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('should create Incident in OPEN status with calculated severity when is_test=false, status=FAILED, and automation is ACTIVE', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);
      mockPrisma.execution.create.mockResolvedValue({
        id: 'exec-prod-failed',
        automation_id: mockActiveAutomation.id,
        external_execution_id: 'ext-prod-failed',
        status: ExecutionStatus.FAILED,
        started_at: new Date(),
        is_test: false,
      });
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-001',
        automation_id: mockActiveAutomation.id,
        execution_id: 'exec-prod-failed',
        status: IncidentStatus.OPEN,
        severity: IncidentSeverity.CRITICAL, // HIGH automation criticality maps to CRITICAL incident severity
      });

      const result = await service.ingestExecution(mockActiveAutomation, {
        external_execution_id: 'ext-prod-failed',
        status: ExecutionStatus.FAILED,
        started_at: '2026-09-27T19:00:00.000Z',
        is_test: false,
      });

      expect(result.incidentId).toBe('inc-001');
      expect(mockPrisma.incident.create).toHaveBeenCalledWith({
        data: {
          automation_id: mockActiveAutomation.id,
          execution_id: 'exec-prod-failed',
          status: IncidentStatus.OPEN,
          severity: IncidentSeverity.CRITICAL,
        },
      });
    });

    it('should gracefully handle P2002 unique constraint race condition during concurrent insertion', async () => {
      // First check returns null (both threads think execution does not exist)
      mockPrisma.execution.findUnique
        .mockResolvedValueOnce(null)
        // Subsequent check in catch block returns the winner's execution
        .mockResolvedValueOnce({
          id: 'exec-winner-1',
          automation_id: mockActiveAutomation.id,
          external_execution_id: 'ext-concurrent-1',
          status: ExecutionStatus.SUCCESS,
          started_at: new Date(),
          incident: null,
        });

      // Simulation of P2002 error from Prisma on concurrent create
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.4.1',
      });
      mockPrisma.execution.create.mockRejectedValue(p2002Error);

      const result = await service.ingestExecution(mockActiveAutomation, {
        external_execution_id: 'ext-concurrent-1',
        status: ExecutionStatus.SUCCESS,
        started_at: '2026-09-27T19:00:00.000Z',
        is_test: false,
      });

      expect(result.isExisting).toBe(true);
      expect(result.execution.id).toBe('exec-winner-1');
    });
  });
});
