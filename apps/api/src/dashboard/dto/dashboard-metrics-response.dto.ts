import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { DashboardPeriod } from './query-dashboard-metrics.dto';

export class DashboardSummaryDto {
  @ApiProperty({
    description: 'Total de automações ativas cadastradas (estado global)',
    example: 12,
  })
  active_automations!: number;

  @ApiProperty({ description: 'Total de execuções dentro do período', example: 1450 })
  executions!: number;

  @ApiPropertyOptional({
    description:
      'Taxa de sucesso percentual das execuções concluídas (SUCCESS / (SUCCESS + FAILED + TIMEOUT) * 100), ou null se denominador for zero',
    example: 98.5,
    type: Number,
    nullable: true,
  })
  success_rate!: number | null;

  @ApiProperty({ description: 'Total de falhas (FAILED + TIMEOUT) no período', example: 22 })
  failures!: number;

  @ApiProperty({
    description:
      'Total de incidentes abertos atualmente no backlog (OPEN, ACKNOWLEDGED, INVESTIGATING)',
    example: 3,
  })
  open_incidents!: number;

  @ApiPropertyOptional({
    description:
      'Tempo médio de reconhecimento em segundos (MTTA) para incidentes abertos no período, ou null se não houver amostras',
    example: 180,
    type: Number,
    nullable: true,
  })
  mtta_seconds!: number | null;

  @ApiPropertyOptional({
    description:
      'Tempo médio de resolução em segundos (MTTR) para incidentes abertos no período, ou null se não houver amostras',
    example: 720,
    type: Number,
    nullable: true,
  })
  mttr_seconds!: number | null;
}

export class ExecutionSeriesBucketDto {
  @ApiProperty({
    description: 'Timestamp UTC ISO 8601 correspondente ao início do bucket',
    example: '2026-09-27T00:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Total de execuções iniciadas no intervalo', example: 45 })
  total!: number;

  @ApiProperty({ description: 'Total de execuções com status SUCCESS', example: 42 })
  success!: number;

  @ApiProperty({ description: 'Total de execuções com status FAILED', example: 2 })
  failed!: number;

  @ApiProperty({ description: 'Total de execuções com status TIMEOUT', example: 1 })
  timeout!: number;
}

export class IncidentsByStatusDto {
  @ApiProperty({ description: 'Incidentes aguardando reconhecimento', example: 2 })
  OPEN!: number;

  @ApiProperty({ description: 'Incidentes reconhecidos e assumidos', example: 1 })
  ACKNOWLEDGED!: number;

  @ApiProperty({ description: 'Incidentes em investigação ativa', example: 1 })
  INVESTIGATING!: number;

  @ApiProperty({ description: 'Incidentes resolvidos', example: 15 })
  RESOLVED!: number;
}

export class OpenIncidentsBySeverityDto {
  @ApiProperty({ description: 'Incidentes abertos com severidade baixa', example: 1 })
  LOW!: number;

  @ApiProperty({ description: 'Incidentes abertos com severidade média', example: 2 })
  MEDIUM!: number;

  @ApiProperty({ description: 'Incidentes abertos com severidade alta', example: 1 })
  HIGH!: number;

  @ApiProperty({ description: 'Incidentes abertos com severidade crítica', example: 0 })
  CRITICAL!: number;
}

export class RecentIncidentAutomationDto {
  @ApiProperty({ description: 'Identificador único da automação' })
  id!: string;

  @ApiProperty({ description: 'Nome da automação' })
  name!: string;
}

export class RecentIncidentAssignedUserDto {
  @ApiProperty({ description: 'Identificador UUID do analista responsável' })
  id!: string;

  @ApiProperty({ description: 'Nome do analista' })
  name!: string;

  @ApiProperty({ description: 'Email corporativo do analista' })
  email!: string;
}

export class RecentIncidentItemDto {
  @ApiProperty({ description: 'Identificador UUID do incidente' })
  id!: string;

  @ApiProperty({ enum: IncidentStatus, description: 'Status atual do incidente' })
  status!: IncidentStatus;

  @ApiProperty({ enum: IncidentSeverity, description: 'Severidade do incidente' })
  severity!: IncidentSeverity;

  @ApiProperty({ description: 'Timestamp de abertura do incidente' })
  opened_at!: Date;

  @ApiProperty({ description: 'Automação monitorada associada ao incidente' })
  automation!: RecentIncidentAutomationDto;

  @ApiPropertyOptional({
    description: 'Analista atualmente atribuído ao incidente, ou null',
    type: RecentIncidentAssignedUserDto,
    nullable: true,
  })
  assigned_to!: RecentIncidentAssignedUserDto | null;
}

export class DashboardMetricsResponseDto {
  @ApiProperty({ enum: ['24h', '7d', '30d'], description: 'Período consultado' })
  period!: DashboardPeriod;

  @ApiProperty({ description: 'Timestamp UTC ISO 8601 em que as métricas foram consolidadas' })
  generated_at!: string;

  @ApiProperty({ type: DashboardSummaryDto, description: 'Resumo dos indicadores-chave' })
  summary!: DashboardSummaryDto;

  @ApiProperty({ type: [ExecutionSeriesBucketDto], description: 'Série temporal de execuções' })
  execution_series!: ExecutionSeriesBucketDto[];

  @ApiProperty({
    type: IncidentsByStatusDto,
    description: 'Distribuição global de incidentes por status',
  })
  incidents_by_status!: IncidentsByStatusDto;

  @ApiProperty({
    type: OpenIncidentsBySeverityDto,
    description: 'Distribuição de incidentes ativos por severidade',
  })
  open_incidents_by_severity!: OpenIncidentsBySeverityDto;

  @ApiProperty({
    type: [RecentIncidentItemDto],
    description: 'Até 5 incidentes operacionais prioritários',
  })
  recent_incidents!: RecentIncidentItemDto[];
}
