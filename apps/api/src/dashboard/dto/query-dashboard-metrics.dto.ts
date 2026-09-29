import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type DashboardPeriod = '24h' | '7d' | '30d';

export class QueryDashboardMetricsDto {
  @ApiPropertyOptional({
    description: 'Janela temporal de consulta das métricas operacionais',
    enum: ['24h', '7d', '30d'],
    default: '7d',
    example: '7d',
  })
  @IsOptional()
  @IsIn(['24h', '7d', '30d'], {
    message: 'period deve ser um dos seguintes valores: 24h, 7d, 30d',
  })
  period: DashboardPeriod = '7d';
}
