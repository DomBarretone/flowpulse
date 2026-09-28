import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentEventType, IncidentStatus, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from '../ai/openrouter.service';
import { SanitizerService } from '../common/sanitization/sanitizer.service';
import { AiAnalysisResponseDto } from './dto/ai-analysis-response.dto';
import { IncidentAnalysisContext } from '../ai/dto/ai-analysis-output.dto';

@Injectable()
export class AiAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouterService: OpenRouterService,
    private readonly sanitizer: SanitizerService,
  ) {}

  async requestAiAnalysis(incidentId: string, user: User): Promise<AiAnalysisResponseDto> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        automation: true,
        execution: true,
      },
    });

    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }

    if (incident.status !== IncidentStatus.INVESTIGATING) {
      throw new ConflictException(
        `Análise de IA só pode ser solicitada em incidentes com status 'INVESTIGATING'. Status atual: '${incident.status}'`,
      );
    }

    if (user.role !== Role.ADMIN && incident.assigned_to_id !== user.id) {
      throw new ForbiddenException(
        'Apenas o analista responsável ou um administrador pode solicitar análise de IA.',
      );
    }

    // 1. Sanitizar dados sensíveis do contexto antes de enviar à IA
    const sanitizedErrorMessage = incident.execution?.error_message
      ? this.sanitizer.sanitize(incident.execution.error_message)
      : '';

    const context: IncidentAnalysisContext = {
      automation: {
        name: incident.automation.name,
        criticality: incident.automation.criticality,
        expected_duration_seconds: incident.automation.expected_duration_seconds,
      },
      incident: {
        severity: incident.severity,
        status: incident.status,
        opened_at: incident.opened_at,
      },
      execution: {
        status: incident.execution.status,
        started_at: incident.execution.started_at,
        finished_at: incident.execution.finished_at,
        duration_ms: incident.execution.duration_ms,
        error_message: sanitizedErrorMessage,
      },
    };

    // 2. Registrar evento de auditoria AI_ANALYSIS_REQUESTED ANTES da chamada externa
    await this.prisma.incidentEvent.create({
      data: {
        incident_id: incidentId,
        actor_user_id: user.id,
        event_type: IncidentEventType.AI_ANALYSIS_REQUESTED,
        from_status: IncidentStatus.INVESTIGATING,
        to_status: IncidentStatus.INVESTIGATING,
        note: `Análise assistida por IA solicitada por ${user.name}`,
      },
    });

    // 3. Chamada ao OpenRouter estritamente FORA de transação de banco de dados
    const aiResult = await this.openRouterService.analyzeIncident(context);

    // 4. Se a chamada externa foi bem-sucedida, persistir atomicamente a análise e o evento COMPLETED
    const saved = await this.prisma.$transaction(async (tx) => {
      const createdAnalysis = await tx.aiAnalysis.create({
        data: {
          incident_id: incidentId,
          requested_by_id: user.id,
          model: aiResult.model,
          summary: aiResult.output.summary,
          likely_causes: aiResult.output.likely_causes as unknown as Prisma.InputJsonValue,
          evidence: aiResult.output.evidence as unknown as Prisma.InputJsonValue,
          next_steps: aiResult.output.next_steps as unknown as Prisma.InputJsonValue,
          confidence: new Prisma.Decimal(aiResult.output.confidence),
          provider_request_id: aiResult.provider_request_id || null,
          latency_ms: aiResult.latency_ms,
        },
        include: {
          requested_by: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.incidentEvent.create({
        data: {
          incident_id: incidentId,
          actor_user_id: user.id,
          event_type: IncidentEventType.AI_ANALYSIS_COMPLETED,
          from_status: IncidentStatus.INVESTIGATING,
          to_status: IncidentStatus.INVESTIGATING,
          note: `Análise de IA concluída (Modelo: ${aiResult.model}, Confiança: ${(aiResult.output.confidence * 100).toFixed(0)}%)`,
        },
      });

      return createdAnalysis;
    });

    return {
      ...saved,
      likely_causes: saved.likely_causes as unknown as Array<{
        cause: string;
        rationale: string;
      }>,
      evidence: saved.evidence as unknown as string[],
      next_steps: saved.next_steps as unknown as string[],
      confidence: Number(saved.confidence),
    };
  }

  async findAiAnalyses(incidentId: string): Promise<AiAnalysisResponseDto[]> {
    const current = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!current) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const analyses = await this.prisma.aiAnalysis.findMany({
      where: { incident_id: incidentId },
      orderBy: { created_at: 'desc' },
      include: {
        requested_by: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return analyses.map((a) => ({
      ...a,
      likely_causes: a.likely_causes as unknown as Array<{
        cause: string;
        rationale: string;
      }>,
      evidence: a.evidence as unknown as string[],
      next_steps: a.next_steps as unknown as string[],
      confidence: Number(a.confidence),
    }));
  }
}
