import { IsArray, IsNumber, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LikelyCauseDto {
  @IsString()
  cause!: string;

  @IsString()
  rationale!: string;
}

export class AiAnalysisOutputDto {
  @IsString()
  summary!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LikelyCauseDto)
  likely_causes!: LikelyCauseDto[];

  @IsArray()
  @IsString({ each: true })
  evidence!: string[];

  @IsArray()
  @IsString({ each: true })
  next_steps!: string[];

  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  confidence!: number;
}

export interface IncidentAnalysisContext {
  automation: {
    name: string;
    criticality: string;
    expected_duration_seconds: number;
  };
  incident: {
    severity: string;
    status: string;
    opened_at: Date | string;
  };
  execution: {
    status: string;
    started_at: Date | string;
    finished_at: Date | string | null;
    duration_ms: number | null;
    error_message: string;
  };
}

export interface OpenRouterResponseResult {
  output: AiAnalysisOutputDto;
  model: string;
  provider_request_id?: string;
  latency_ms: number;
}
