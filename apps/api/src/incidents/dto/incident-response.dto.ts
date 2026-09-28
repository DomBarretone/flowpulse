import { Criticality, ExecutionStatus, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { IncidentActorDto } from './incident-event-response.dto';

export class IncidentAutomationDto {
  id!: string;
  name!: string;
  criticality!: Criticality;
  expected_duration_seconds?: number;
}

export class IncidentExecutionDto {
  id!: string;
  external_execution_id!: string;
  status!: ExecutionStatus;
  started_at!: Date;
  finished_at!: Date | null;
  duration_ms!: number | null;
  error_message!: string | null;
  is_test!: boolean;
}

export class IncidentResponseDto {
  id!: string;
  automation_id!: string;
  execution_id!: string;
  status!: IncidentStatus;
  severity!: IncidentSeverity;
  assigned_to_id!: string | null;
  opened_at!: Date;
  acknowledged_at!: Date | null;
  investigating_at!: Date | null;
  resolved_at!: Date | null;
  resolution_notes!: string | null;
  created_at!: Date;
  updated_at!: Date;
  automation!: IncidentAutomationDto;
  assigned_to!: IncidentActorDto | null;
}

export class IncidentDetailResponseDto extends IncidentResponseDto {
  execution!: IncidentExecutionDto;
}
