import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { QueryDashboardMetricsDto } from './dto/query-dashboard-metrics.dto';
import { DashboardMetricsResponseDto } from './dto/dashboard-metrics-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @Roles(Role.ADMIN, Role.ANALYST)
  @ApiOperation({ summary: 'Obter métricas e consolidações temporais para o painel operacional' })
  @ApiResponse({
    status: 200,
    description: 'Métricas operacionais retornadas com sucesso',
    type: DashboardMetricsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token de autenticação inválido ou ausente' })
  @ApiResponse({ status: 403, description: 'Acesso restrito aos papéis ADMIN e ANALYST' })
  @ApiResponse({ status: 422, description: 'Parâmetro period inválido (RFC 7807)' })
  async getMetrics(@Query() query: QueryDashboardMetricsDto): Promise<DashboardMetricsResponseDto> {
    return this.dashboardService.getMetrics(query);
  }
}
