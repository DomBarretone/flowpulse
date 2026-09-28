import { IncidentActorDto } from './incident-event-response.dto';

export class AiAnalysisResponseDto {
  id!: string;
  incident_id!: string;
  requested_by_id!: string;
  model!: string;
  summary!: string;
  likely_causes!: Array<{ cause: string; rationale: string }>;
  evidence!: string[];
  next_steps!: string[];
  confidence!: number;
  provider_request_id!: string | null;
  latency_ms!: number | null;
  created_at!: Date;
  requested_by!: IncidentActorDto | null;
}
