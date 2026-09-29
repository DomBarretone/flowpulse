import { IncidentEventType, IncidentStatus } from '@prisma/client';

export class IncidentActorDto {
  id!: string;
  name!: string;
  email!: string;
}

export class IncidentEventResponseDto {
  id!: string;
  incident_id!: string;
  actor_user_id!: string | null;
  event_type!: IncidentEventType;
  from_status!: IncidentStatus | null;
  to_status!: IncidentStatus | null;
  note!: string | null;
  created_at!: Date;
  actor!: IncidentActorDto | null;
}
