import { Injectable } from '@nestjs/common';
import {
  Automation,
  AutomationStatus,
  Execution,
  ExecutionStatus,
  Incident,
  IncidentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateIncidentSeverity } from './incident-severity.calculator';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
