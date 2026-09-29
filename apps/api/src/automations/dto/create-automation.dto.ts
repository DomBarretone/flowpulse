import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Criticality } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateAutomationDto {
  @ApiProperty({ description: 'Nome da automação', example: 'Sync ERP Orders' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Descrição da automação',
    example: 'Sincronização periódica de pedidos do ERP',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: Criticality,
    description: 'Criticidade da automação',
    default: Criticality.MEDIUM,
  })
  @IsEnum(Criticality)
  criticality!: Criticality;

  @ApiProperty({
    description: 'Duração esperada em segundos (deve ser > 0)',
    example: 120,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  expected_duration_seconds!: number;
}
