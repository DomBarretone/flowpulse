import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Automation, AutomationStatus, Execution, IntegrationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from '../incidents/incidents.service';
import { IngestExecutionDto } from './dto/ingest-execution.dto';
import { QueryExecutionsDto } from './dto/query-executions.dto';

export interface IngestExecutionResult {
  execution: Execution;
  incidentId: string | null;
  isExisting: boolean;
}

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsService: IncidentsService,
  ) {}

  async ingestExecution(
    automation: Automation,
    dto: IngestExecutionDto,
  ): Promise<IngestExecutionResult> {
    const isTest = dto.is_test === true;

    // Execuções produtivas exigem automação ACTIVE
    if (!isTest && automation.status !== AutomationStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        `Productive executions can only be ingested for ACTIVE automations (current status: ${automation.status})`,
      );
    }

    // Idempotência pré-check
    const existing = await this.prisma.execution.findUnique({
      where: {
        automation_id_external_execution_id: {
          automation_id: automation.id,
          external_execution_id: dto.external_execution_id,
        },
      },
      include: {
        incident: true,
      },
    });

    if (existing) {
      return {
        execution: existing,
        incidentId: existing.incident?.id || null,
        isExisting: true,
      };
    }

    // Inserção atômica com mitigação de race conditions
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdExecution = await tx.execution.create({
          data: {
            automation_id: automation.id,
            external_execution_id: dto.external_execution_id,
            status: dto.status,
            started_at: new Date(dto.started_at),
            finished_at: dto.finished_at ? new Date(dto.finished_at) : null,
            duration_ms: dto.duration_ms ?? null,
            error_message: dto.error_message ?? null,
            is_test: isTest,
          },
        });

        if (isTest) {
          await tx.automation.update({
            where: { id: automation.id },
            data: { integration_status: IntegrationStatus.VALIDATED },
          });

          return {
            execution: createdExecution,
            incidentId: null,
            isExisting: false,
          };
        }

        let incidentId: string | null = null;
        if (this.incidentsService.shouldCreateIncident(automation, createdExecution)) {
          const incident = await this.incidentsService.createIncidentForExecution(
            automation,
            createdExecution,
            tx,
          );
          incidentId = incident ? incident.id : null;
        }

        return {
          execution: createdExecution,
          incidentId,
          isExisting: false,
        };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Concorrência: outra requisição acabou de inserir com o mesmo external_execution_id
        const concurrent = await this.prisma.execution.findUnique({
          where: {
            automation_id_external_execution_id: {
              automation_id: automation.id,
              external_execution_id: dto.external_execution_id,
            },
          },
          include: {
            incident: true,
          },
        });

        if (concurrent) {
          return {
            execution: concurrent,
            incidentId: concurrent.incident?.id || null,
            isExisting: true,
          };
        }
      }
      throw error;
    }
  }

  async findAll(query?: QueryExecutionsDto) {
    const where: Prisma.ExecutionWhereInput = {};

    if (query?.automation_id) {
      where.automation_id = query.automation_id;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.is_test !== undefined) {
      where.is_test = query.is_test;
    }

    return this.prisma.execution.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        incident: {
          select: {
            id: true,
            status: true,
            severity: true,
          },
        },
      },
    });
  }
}
