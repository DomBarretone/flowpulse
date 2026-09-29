import { ApiPropertyOptional } from '@nestjs/swagger';
import { Criticality } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAutomationDto {
  @ApiPropertyOptional({ description: 'Nome da automação', example: 'Sync ERP Orders Updated' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Descrição da automação' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: Criticality, description: 'Criticidade da automação' })
  @IsEnum(Criticality)
  @IsOptional()
  criticality?: Criticality;

  @ApiPropertyOptional({
    description: 'Duração esperada em segundos (deve ser > 0)',
    example: 180,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  expected_duration_seconds?: number;
}
