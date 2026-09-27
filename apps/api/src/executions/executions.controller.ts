import { Body, Controller, Get, HttpStatus, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Automation } from '@prisma/client';
import { Response } from 'express';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentAutomation } from '../common/decorators/current-automation.decorator';
import { ExecutionsService } from './executions.service';
import { IngestExecutionDto } from './dto/ingest-execution.dto';
import { QueryExecutionsDto } from './dto/query-executions.dto';

@ApiTags('executions')
@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    description: 'Chave de integração da automação (formato fp_live_...)',
    required: true,
  })
  @ApiOperation({
    summary: 'Ingestão de evento de execução externa (autenticação exclusiva por API Key)',
  })
  @ApiResponse({ status: 201, description: 'Execução ingerida com sucesso' })
  @ApiResponse({ status: 200, description: 'Execução idempotente já processada anteriormente' })
  @ApiResponse({ status: 401, description: 'Chave de API ausente, inválida ou revogada' })
  @ApiResponse({
    status: 422,
    description: 'Payload inválido ou tentativa de ingestão produtiva em automação não ativa',
  })
  async ingest(
    @CurrentAutomation() automation: Automation,
    @Body() dto: IngestExecutionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.executionsService.ingestExecution(automation, dto);

    if (result.isExisting) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }

    return {
      id: result.execution.id,
      automation_id: result.execution.automation_id,
      external_execution_id: result.execution.external_execution_id,
      status: result.execution.status,
      started_at: result.execution.started_at,
      finished_at: result.execution.finished_at,
      duration_ms: result.execution.duration_ms,
      error_message: result.execution.error_message,
      is_test: result.execution.is_test,
      incident_id: result.incidentId,
      created_at: result.execution.created_at,
    };
  }

  @Get()
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Consultar histórico de execuções (ADMIN e ANALYST)' })
  @ApiResponse({ status: 200, description: 'Histórico retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async findAll(@Query() query: QueryExecutionsDto) {
    return this.executionsService.findAll(query);
  }
}
