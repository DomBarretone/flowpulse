import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import {
  Criticality,
  ExecutionStatus,
  IncidentEventType,
  IncidentSeverity,
  IncidentStatus,
  Prisma,
  Role,
  User,
} from '@prisma/client';
import { AiAnalysisService } from '../src/incidents/ai-analysis.service';
import { OpenRouterService } from '../src/ai/openrouter.service';
import { SanitizerService } from '../src/common/sanitization/sanitizer.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AiAnalysisService (Unit)', () => {
  let service: AiAnalysisService;
  let openRouterMock: Partial<OpenRouterService>;
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

  const mockInvestigatingIncident = {
    id: 'inc-inv-1',
    automation_id: 'aut-1',
    execution_id: 'exec-1',
    status: IncidentStatus.INVESTIGATING,
    severity: IncidentSeverity.CRITICAL,
    assigned_to_id: analystUser.id,
    opened_at: new Date('2026-09-27T10:00:00Z'),
    acknowledged_at: new Date('2026-09-27T10:05:00Z'),
    investigating_at: new Date('2026-09-27T10:10:00Z'),
    resolved_at: null,
    resolution_notes: null,
    automation: {
      name: 'Critical Sync',
      criticality: Criticality.CRITICAL,
      expected_duration_seconds: 30,
    },
    execution: {
      id: 'exec-1',
      status: ExecutionStatus.FAILED,
      started_at: new Date(),
      finished_at: new Date(),
      duration_ms: 35000,
      error_message: 'Auth fail with Bearer eyJhbGci... and secret password=123',
    },
  };

  const sampleAiOutput = {
    output: {
      summary: 'Falha de autenticação externa.',
      likely_causes: [
        {
          cause: 'Token de serviço expirado',
          rationale: 'O header Authorization continha token rejeitado.',
        },
      ],
      evidence: ['Erro de autenticação no log'],
      next_steps: ['Renovar token de serviço'],
      confidence: 0.9,
    },
    model: 'anthropic/claude-haiku-4.5',
    provider_request_id: 'req-abc-123',
    latency_ms: 1200,
  };

  beforeEach(() => {
    sanitizer = new SanitizerService();
    openRouterMock = {
      analyzeIncident: jest.fn(),
    };
    prismaMock = {
      incident: {
        findUnique: jest.fn(),
      },
      incidentEvent: {
        create: jest.fn(),
      },
      aiAnalysis: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    service = new AiAnalysisService(
      prismaMock as unknown as PrismaService,
      openRouterMock as OpenRouterService,
      sanitizer,
    );
  });

  it('should throw 409 Conflict if incident is not in INVESTIGATING status', async () => {
    (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue({
      ...mockInvestigatingIncident,
      status: IncidentStatus.OPEN,
    });

    await expect(
      service.requestAiAnalysis(mockInvestigatingIncident.id, analystUser),
    ).rejects.toThrow(ConflictException);

    expect(openRouterMock.analyzeIncident).not.toHaveBeenCalled();
  });

  it('should throw 403 Forbidden if non-assigned analyst requests AI analysis', async () => {
    (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
      mockInvestigatingIncident,
    );

    await expect(
      service.requestAiAnalysis(mockInvestigatingIncident.id, otherAnalystUser),
    ).rejects.toThrow(ForbiddenException);

    expect(openRouterMock.analyzeIncident).not.toHaveBeenCalled();
  });

  it('should record AI_ANALYSIS_REQUESTED before calling OpenRouter and sanitize error_message', async () => {
    (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
      mockInvestigatingIncident,
    );
    (prismaMock.incidentEvent as Record<string, jest.Mock>).create.mockResolvedValue({});
    (openRouterMock.analyzeIncident as jest.Mock).mockResolvedValue(sampleAiOutput);
    (prismaMock.aiAnalysis as Record<string, jest.Mock>).create.mockResolvedValue({
      id: 'ai-1',
      incident_id: mockInvestigatingIncident.id,
      requested_by_id: analystUser.id,
      model: sampleAiOutput.model,
      summary: sampleAiOutput.output.summary,
      likely_causes: sampleAiOutput.output.likely_causes,
      evidence: sampleAiOutput.output.evidence,
      next_steps: sampleAiOutput.output.next_steps,
      confidence: new Prisma.Decimal(0.9),
      provider_request_id: sampleAiOutput.provider_request_id,
      latency_ms: sampleAiOutput.latency_ms,
      created_at: new Date(),
      requested_by: analystUser,
    });

    const result = await service.requestAiAnalysis(mockInvestigatingIncident.id, analystUser);

    // Verifica que AI_ANALYSIS_REQUESTED foi emitido primeiro
    expect((prismaMock.incidentEvent as Record<string, jest.Mock>).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: IncidentEventType.AI_ANALYSIS_REQUESTED,
          from_status: IncidentStatus.INVESTIGATING,
          to_status: IncidentStatus.INVESTIGATING,
        }),
      }),
    );

    // Verifica que o contexto enviado ao OpenRouter foi sanitizado
    expect(openRouterMock.analyzeIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        execution: expect.objectContaining({
          error_message: 'Auth fail with Bearer [REDACTED] and secret password=[REDACTED]',
        }),
      }),
    );

    // Verifica retorno
    expect(result.summary).toBe(sampleAiOutput.output.summary);
    expect(result.confidence).toBe(0.9);
  });

  it('should keep AI_ANALYSIS_REQUESTED and NOT create AI_ANALYSIS_COMPLETED when OpenRouter fails with 503', async () => {
    (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
      mockInvestigatingIncident,
    );
    (prismaMock.incidentEvent as Record<string, jest.Mock>).create.mockResolvedValue({});
    (openRouterMock.analyzeIncident as jest.Mock).mockRejectedValue(
      new ServiceUnavailableException('AI service unavailable'),
    );

    await expect(
      service.requestAiAnalysis(mockInvestigatingIncident.id, analystUser),
    ).rejects.toThrow(ServiceUnavailableException);

    // AI_ANALYSIS_REQUESTED foi criado
    expect((prismaMock.incidentEvent as Record<string, jest.Mock>).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: IncidentEventType.AI_ANALYSIS_REQUESTED,
        }),
      }),
    );

    // Nenhum registro em aiAnalysis criado
    expect((prismaMock.aiAnalysis as Record<string, jest.Mock>).create).not.toHaveBeenCalled();
  });

  it('should allow ADMIN to request AI analysis on incident assigned to another analyst', async () => {
    (prismaMock.incident as Record<string, jest.Mock>).findUnique.mockResolvedValue(
      mockInvestigatingIncident,
    );
    (prismaMock.incidentEvent as Record<string, jest.Mock>).create.mockResolvedValue({});
    (openRouterMock.analyzeIncident as jest.Mock).mockResolvedValue(sampleAiOutput);
    (prismaMock.aiAnalysis as Record<string, jest.Mock>).create.mockResolvedValue({
      id: 'ai-2',
      incident_id: mockInvestigatingIncident.id,
      requested_by_id: adminUser.id,
      model: sampleAiOutput.model,
      summary: sampleAiOutput.output.summary,
      likely_causes: sampleAiOutput.output.likely_causes,
      evidence: sampleAiOutput.output.evidence,
      next_steps: sampleAiOutput.output.next_steps,
      confidence: new Prisma.Decimal(0.9),
      provider_request_id: sampleAiOutput.provider_request_id,
      latency_ms: sampleAiOutput.latency_ms,
      created_at: new Date(),
      requested_by: adminUser,
    });

    const result = await service.requestAiAnalysis(mockInvestigatingIncident.id, adminUser);
    expect(result.summary).toBe(sampleAiOutput.output.summary);
  });
});
