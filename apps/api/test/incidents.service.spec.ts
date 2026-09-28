import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Criticality,
  ExecutionStatus,
  IncidentEventType,
  IncidentSeverity,
  IncidentStatus,
  Role,
  User,
} from '@prisma/client';
import { IncidentsService } from '../src/incidents/incidents.service';
import { SanitizerService } from '../src/common/sanitization/sanitizer.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('IncidentsService (Unit)', () => {
  let service: IncidentsService;
  let sanitizer: SanitizerService;
  let prismaMock: Record<string, unknown>;

  const analystUser: User = {
    id: 'user-analyst-1',
    clerk_user_id: 'clerk_analyst_1',
    email: 'analyst@flowpulse.io',
    name: 'Analyst One',
    role: Role.ANALYST,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const otherAnalystUser: User = {
    id: 'user-analyst-2',
    clerk_user_id: 'clerk_analyst_2',
    email: 'other@flowpulse.io',
    name: 'Analyst Two',
    role: Role.ANALYST,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const adminUser: User = {
    id: 'user-admin-1',
    clerk_user_id: 'clerk_admin_1',
    email: 'admin@flowpulse.io',
    name: 'Admin Boss',
    role: Role.ADMIN,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockOpenIncident = {
    id: 'inc-open-1',
    automation_id: 'aut-1',
    execution_id: 'exec-1',
    status: IncidentStatus.OPEN,
    severity: IncidentSeverity.HIGH,
    assigned_to_id: null,
    opened_at: new Date('2026-09-27T10:00:00Z'),
    acknowledged_at: null,
    investigating_at: null,
    resolved_at: null,
    resolution_notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAcknowledgedIncident = {
    ...mockOpenIncident,
    id: 'inc-ack-1',
    status: IncidentStatus.ACKNOWLEDGED,
    assigned_to_id: analystUser.id,
    acknowledged_at: new Date('2026-09-27T10:05:00Z'),
  };

  const mockInvestigatingIncident = {
    ...mockAcknowledgedIncident,
    id: 'inc-inv-1',
    status: IncidentStatus.INVESTIGATING,
    investigating_at: new Date('2026-09-27T10:10:00Z'),
  };

  beforeEach(() => {
    sanitizer = new SanitizerService();
    prismaMock = {
      incident: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      incidentEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    service = new IncidentsService(prismaMock as unknown as PrismaService, sanitizer);
  });

  describe('acknowledge', () => {
    it('should transition OPEN incident to ACKNOWLEDGED and set assigned_to_id', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockOpenIncident,
      );
      (prismaMock.incident as Record<string, jest.Mock>).updateMany.mockResolvedValue({ count: 1 });
      (prismaMock.incidentEvent as Record<string, jest.Mock>).create.mockResolvedValue({});
      (prismaMock.incident as Record<string, jest.Mock>).findUniqueOrThrow.mockResolvedValue({
        ...mockOpenIncident,
        status: IncidentStatus.ACKNOWLEDGED,
        assigned_to_id: analystUser.id,
        assigned_to: analystUser,
      });

      const result = await service.acknowledge(mockOpenIncident.id, analystUser);

      expect(result.status).toBe(IncidentStatus.ACKNOWLEDGED);
      expect(result.assigned_to_id).toBe(analystUser.id);
      expect((prismaMock.incidentEvent as Record<string, jest.Mock>).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: IncidentEventType.ACKNOWLEDGED,
            from_status: IncidentStatus.OPEN,
            to_status: IncidentStatus.ACKNOWLEDGED,
            actor_user_id: analystUser.id,
          }),
        }),
      );
    });

    it('should reject acknowledge with 409 Conflict if incident is not OPEN', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockAcknowledgedIncident,
      );

      await expect(service.acknowledge(mockAcknowledgedIncident.id, analystUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject acknowledge with 409 Conflict if concurrent update occurs (count === 0)', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockOpenIncident,
      );
      (prismaMock.incident as Record<string, jest.Mock>).updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acknowledge(mockOpenIncident.id, analystUser)).rejects.toThrow(
        ConflictException,
      );
      expect((prismaMock.incidentEvent as Record<string, jest.Mock>).create).not.toHaveBeenCalled();
    });
  });

  describe('investigate', () => {
    it('should transition ACKNOWLEDGED incident to INVESTIGATING by assigned analyst', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockAcknowledgedIncident,
      );
      (prismaMock.incident as Record<string, jest.Mock>).updateMany.mockResolvedValue({ count: 1 });
      (prismaMock.incidentEvent as Record<string, jest.Mock>).create.mockResolvedValue({});
      (prismaMock.incident as Record<string, jest.Mock>).findUniqueOrThrow.mockResolvedValue({
        ...mockAcknowledgedIncident,
        status: IncidentStatus.INVESTIGATING,
      });

      const result = await service.investigate(mockAcknowledgedIncident.id, analystUser);

      expect(result.status).toBe(IncidentStatus.INVESTIGATING);
      expect((prismaMock.incidentEvent as Record<string, jest.Mock>).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: IncidentEventType.INVESTIGATION_STARTED,
            from_status: IncidentStatus.ACKNOWLEDGED,
            to_status: IncidentStatus.INVESTIGATING,
          }),
        }),
      );
    });

    it('should allow ADMIN to investigate incident assigned to another analyst', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockAcknowledgedIncident,
      );
      (prismaMock.incident as Record<string, jest.Mock>).updateMany.mockResolvedValue({ count: 1 });
      (prismaMock.incidentEvent as Record<string, jest.Mock>).create.mockResolvedValue({});
      (prismaMock.incident as Record<string, jest.Mock>).findUniqueOrThrow.mockResolvedValue({
        ...mockAcknowledgedIncident,
        status: IncidentStatus.INVESTIGATING,
      });

      const result = await service.investigate(mockAcknowledgedIncident.id, adminUser);
      expect(result.status).toBe(IncidentStatus.INVESTIGATING);
    });

    it('should reject with 403 Forbidden when another ANALYST attempts to investigate', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockAcknowledgedIncident,
      );

      await expect(
        service.investigate(mockAcknowledgedIncident.id, otherAnalystUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject with 409 Conflict if incident is in OPEN or RESOLVED status', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockOpenIncident,
      );

      await expect(service.investigate(mockOpenIncident.id, analystUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('resolve', () => {
    it('should resolve INVESTIGATING incident when resolution notes are valid', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockInvestigatingIncident,
      );
      (prismaMock.incident as Record<string, jest.Mock>).updateMany.mockResolvedValue({ count: 1 });
      (prismaMock.incidentEvent as Record<string, jest.Mock>).create.mockResolvedValue({});
      (prismaMock.incident as Record<string, jest.Mock>).findUniqueOrThrow.mockResolvedValue({
        ...mockInvestigatingIncident,
        status: IncidentStatus.RESOLVED,
        resolution_notes: 'Reiniciado o serviço com novo pool de conexões.',
      });

      const result = await service.resolve(mockInvestigatingIncident.id, analystUser, {
        resolution_notes: 'Reiniciado o serviço com novo pool de conexões.',
      });

      expect(result.status).toBe(IncidentStatus.RESOLVED);
      expect((prismaMock.incidentEvent as Record<string, jest.Mock>).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: IncidentEventType.RESOLVED,
            from_status: IncidentStatus.INVESTIGATING,
            to_status: IncidentStatus.RESOLVED,
          }),
        }),
      );
    });

    it('should reject with 422 if resolution_notes has less than 10 characters', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockInvestigatingIncident,
      );

      await expect(
        service.resolve(mockInvestigatingIncident.id, analystUser, {
          resolution_notes: 'Curto',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should reject with 403 Forbidden if another ANALYST attempts to resolve', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockInvestigatingIncident,
      );

      await expect(
        service.resolve(mockInvestigatingIncident.id, otherAnalystUser, {
          resolution_notes: 'Tentativa por outro analista válida em tamanho.',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject with 409 Conflict if incident is not INVESTIGATING', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockAcknowledgedIncident,
      );

      await expect(
        service.resolve(mockAcknowledgedIncident.id, analystUser, {
          resolution_notes: 'Notas válidas em tamanho mas status inválido.',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById with sanitization', () => {
    it('should sanitize raw error_message before exposing in incident detail', async () => {
      const rawSecretErrorMessage =
        'Failure connecting with token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig and fp_live_sec1234567890abcdef at user=admin@flowpulse.io';

      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        ...mockOpenIncident,
        execution: {
          id: 'exec-1',
          external_execution_id: 'ext-1',
          status: ExecutionStatus.FAILED,
          started_at: new Date(),
          finished_at: new Date(),
          duration_ms: 1000,
          error_message: rawSecretErrorMessage,
          is_test: false,
        },
        automation: {
          id: 'aut-1',
          name: 'Flow',
          criticality: Criticality.HIGH,
        },
        assigned_to: null,
      });

      const detail = await service.findById(mockOpenIncident.id);

      expect(detail.execution.error_message).toBe(
        'Failure connecting with token Bearer [REDACTED] and [REDACTED] at user=[REDACTED]',
      );
      expect(detail.execution.error_message).not.toContain('eyJhbGci');
      expect(detail.execution.error_message).not.toContain('fp_live_');
      expect(detail.execution.error_message).not.toContain('admin@flowpulse.io');
    });

    it('should throw 404 NotFoundException if incident does not exist', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findEvents', () => {
    it('should return events in chronological ascending order', async () => {
      (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
        mockAcknowledgedIncident,
      );
      (prismaMock.incidentEvent as Record<string, jest.Mock>).findMany.mockResolvedValue([
        {
          id: 'evt-1',
          incident_id: mockAcknowledgedIncident.id,
          event_type: IncidentEventType.ACKNOWLEDGED,
          created_at: new Date('2026-09-27T10:05:00Z'),
          actor: analystUser,
        },
      ]);

      const events = await service.findEvents(mockAcknowledgedIncident.id);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(IncidentEventType.ACKNOWLEDGED);
      expect((prismaMock.incidentEvent as Record<string, jest.Mock>).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'asc' },
        }),
      );
    });
  });
});
