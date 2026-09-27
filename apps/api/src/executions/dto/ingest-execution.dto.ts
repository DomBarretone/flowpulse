import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class IngestExecutionDto {
  @ApiProperty({
    description: 'Identificador único da execução no sistema externo de origem',
    example: 'exec-batch-20260927-001',
  })
  @IsString()
  @IsNotEmpty()
  external_execution_id!: string;

  @ApiProperty({
    enum: ExecutionStatus,
    description: 'Status do término ou andamento da execução',
    example: ExecutionStatus.SUCCESS,
  })
  @IsEnum(ExecutionStatus)
  status!: ExecutionStatus;

  @ApiProperty({
    description: 'Data e hora de início no formato ISO 8601',
    example: '2026-09-27T19:00:00.000Z',
  })
  @IsISO8601()
  started_at!: string;

  @ApiPropertyOptional({
    description: 'Data e hora de término no formato ISO 8601',
    example: '2026-09-27T19:02:00.000Z',
  })
  @IsISO8601()
  @IsOptional()
  finished_at?: string;

  @ApiPropertyOptional({
    description: 'Duração da execução em milissegundos',
    example: 120000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  duration_ms?: number;

  @ApiPropertyOptional({
    description: 'Mensagem descritiva de erro quando o status for FAILED',
    example: 'Connection timed out after 3 retries',
  })
  @IsString()
  @IsOptional()
  error_message?: string;

  @ApiPropertyOptional({
    description: 'Indica se a execução é um evento de teste real para validação da integração',
    default: false,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_test?: boolean;
}
