import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class QueryExecutionsDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID da automação' })
  @IsUUID()
  @IsOptional()
  automation_id?: string;

  @ApiPropertyOptional({ enum: ExecutionStatus, description: 'Filtrar por status da execução' })
  @IsEnum(ExecutionStatus)
  @IsOptional()
  status?: ExecutionStatus;

  @ApiPropertyOptional({ description: 'Filtrar execuções de teste' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  is_test?: boolean;
}
