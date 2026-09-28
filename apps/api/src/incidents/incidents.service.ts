import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Automation,
  AutomationStatus,
  Execution,
  ExecutionStatus,
  Incident,
  IncidentEventType,
  IncidentStatus,
  Prisma,
  Role,
  User,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SanitizerService } from '../common/sanitization/sanitizer.service';
import { calculateIncidentSeverity } from './incident-severity.calculator';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { IncidentDetailResponseDto, IncidentResponseDto } from './dto/incident-response.dto';
import { IncidentEventResponseDto } from './dto/incident-event-response.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sanitizer: SanitizerService,
  ) {}

  shouldCreateIncident(
    automation: Automation,
    execution: { is_test: boolean; status: ExecutionStatus },
  ): boolean {
    return (
      !execution.is_test &&
      execution.status === ExecutionStatus.FAILED &&
      automation.status === AutomationStatus.ACTIVE
    );
  }

  async createIncidentForExecution(
    automation: Automation,
    execution: Execution,
    tx?: Prisma.TransactionClient,
  ): Promise<Incident | null> {
    if (!this.shouldCreateIncident(automation, execution)) {
      return null;
    }

    const client = tx || this.prisma;
    const severity = calculateIncidentSeverity(automation.criticality);

    try {
      return await client.incident.create({
        data: {
          automation_id: automation.id,
          execution_id: execution.id,
          status: IncidentStatus.OPEN,
          severity,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Idempotência concorrente: incident já foi criado por request paralela
        return client.incident.findUnique({
          where: { execution_id: execution.id },
        });
      }
      throw error;
    }
  }

  async findIncidentByExecutionId(
    executionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Incident | null> {
    const client = tx || this.prisma;
    return client.incident.findUnique({
      where: { execution_id: executionId },
    });
  }

  async findMany(
    query: QueryIncidentsDto,
  ): Promise<{ items: IncidentResponseDto[]; total: number; page: number; limit: number }> {
    const { status, severity, automation_id, assigned_to_id, page = 1, limit = 20 } = query;

    const where: Prisma.IncidentWhereInput = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (automation_id) where.automation_id = automation_id;
    if (assigned_to_id) where.assigned_to_id = assigned_to_id;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { opened_at: 'desc' },
        include: {
          automation: {
            select: {
              id: true,
              name: true,
              criticality: true,
              expected_duration_seconds: true,
            },
          },
          assigned_to: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      items: items as IncidentResponseDto[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<IncidentDetailResponseDto> {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        automation: {
          select: {
            id: true,
            name: true,
            criticality: true,
            expected_duration_seconds: true,
          },
        },
        execution: {
          select: {
            id: true,
            external_execution_id: true,
            status: true,
            started_at: true,
            finished_at: true,
            duration_ms: true,
            error_message: true,
            is_test: true,
          },
        },
        assigned_to: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }

    // Sanitizar deterministicamente error_message antes de expor ao cliente
    const sanitizedErrorMessage = incident.execution?.error_message
      ? this.sanitizer.sanitize(incident.execution.error_message)
      : null;

    return {
      ...incident,
      execution: {
        ...incident.execution,
        error_message: sanitizedErrorMessage,
      },
    } as IncidentDetailResponseDto;
  }

  async acknowledge(id: string, user: User): Promise<IncidentResponseDto> {
    const current = await this.prisma.incident.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Incidente não encontrado');
    }

    if (current.status !== IncidentStatus.OPEN) {
      throw new ConflictException(
        `Transição inválida: o incidente está em '${current.status}' e requer '${IncidentStatus.OPEN}'`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // Mutação condicional atômica
      const result = await tx.incident.updateMany({
        where: {
          id,
          status: IncidentStatus.OPEN,
        },
        data: {
          status: IncidentStatus.ACKNOWLEDGED,
          assigned_to_id: user.id,
          acknowledged_at: new Date(),
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          `Conflito concorrente: o incidente já foi assumido ou modificado por outro operador`,
        );
      }

      await tx.incidentEvent.create({
        data: {
          incident_id: id,
          actor_user_id: user.id,
          event_type: IncidentEventType.ACKNOWLEDGED,
          from_status: IncidentStatus.OPEN,
          to_status: IncidentStatus.ACKNOWLEDGED,
          note: `Incidente assumido pelo operador ${user.name}`,
        },
      });

      return tx.incident.findUniqueOrThrow({
        where: { id },
        include: {
          automation: {
            select: { id: true, name: true, criticality: true },
          },
          assigned_to: {
            select: { id: true, name: true, email: true },
          },
        },
      }) as unknown as IncidentResponseDto;
    });
  }

  async investigate(id: string, user: User): Promise<IncidentResponseDto> {
    const current = await this.prisma.incident.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Incidente não encontrado');
    }

    if (current.status !== IncidentStatus.ACKNOWLEDGED) {
      throw new ConflictException(
        `Transição inválida: o incidente está em '${current.status}' e requer '${IncidentStatus.ACKNOWLEDGED}'`,
      );
    }

    // Regra de Ownership
    if (user.role !== Role.ADMIN && current.assigned_to_id !== user.id) {
      throw new ForbiddenException(
        'Apenas o analista responsável ou um administrador pode iniciar a investigação deste incidente.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // Mutação condicional atômica
      const result = await tx.incident.updateMany({
        where: {
          id,
          status: IncidentStatus.ACKNOWLEDGED,
        },
        data: {
          status: IncidentStatus.INVESTIGATING,
          investigating_at: new Date(),
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          `Conflito concorrente: o incidente não se encontra mais em '${IncidentStatus.ACKNOWLEDGED}'`,
        );
      }

      await tx.incidentEvent.create({
        data: {
          incident_id: id,
          actor_user_id: user.id,
          event_type: IncidentEventType.INVESTIGATION_STARTED,
          from_status: IncidentStatus.ACKNOWLEDGED,
          to_status: IncidentStatus.INVESTIGATING,
          note: `Investigação iniciada por ${user.name}`,
        },
      });

      return tx.incident.findUniqueOrThrow({
        where: { id },
        include: {
          automation: {
            select: { id: true, name: true, criticality: true },
          },
          assigned_to: {
            select: { id: true, name: true, email: true },
          },
        },
      }) as unknown as IncidentResponseDto;
    });
  }

  async resolve(id: string, user: User, dto: ResolveIncidentDto): Promise<IncidentResponseDto> {
    const current = await this.prisma.incident.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Incidente não encontrado');
    }

    if (current.status !== IncidentStatus.INVESTIGATING) {
      throw new ConflictException(
        `Transição inválida: o incidente está em '${current.status}' e requer '${IncidentStatus.INVESTIGATING}'`,
      );
    }

    // Regra de Ownership
    if (user.role !== Role.ADMIN && current.assigned_to_id !== user.id) {
      throw new ForbiddenException(
        'Apenas o analista responsável ou um administrador pode registrar a resolução deste incidente.',
      );
    }

    const notes = dto.resolution_notes ? dto.resolution_notes.trim() : '';
    if (!notes || notes.length < 10) {
      throw new UnprocessableEntityException(
        'Notas de resolução são obrigatórias e devem conter no mínimo 10 caracteres.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // Mutação condicional atômica
      const result = await tx.incident.updateMany({
        where: {
          id,
          status: IncidentStatus.INVESTIGATING,
        },
        data: {
          status: IncidentStatus.RESOLVED,
          resolved_at: new Date(),
          resolution_notes: notes,
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          `Conflito concorrente: o incidente não se encontra mais em '${IncidentStatus.INVESTIGATING}'`,
        );
      }

      await tx.incidentEvent.create({
        data: {
          incident_id: id,
          actor_user_id: user.id,
          event_type: IncidentEventType.RESOLVED,
          from_status: IncidentStatus.INVESTIGATING,
          to_status: IncidentStatus.RESOLVED,
          note: notes,
        },
      });

      return tx.incident.findUniqueOrThrow({
        where: { id },
        include: {
          automation: {
            select: { id: true, name: true, criticality: true },
          },
          assigned_to: {
            select: { id: true, name: true, email: true },
          },
        },
      }) as unknown as IncidentResponseDto;
    });
  }

  async findEvents(id: string): Promise<IncidentEventResponseDto[]> {
    const current = await this.prisma.incident.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const events = await this.prisma.incidentEvent.findMany({
      where: { incident_id: id },
      orderBy: { created_at: 'asc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return events as IncidentEventResponseDto[];
  }
}
