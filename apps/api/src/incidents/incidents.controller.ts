import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IncidentsService } from './incidents.service';
import { AiAnalysisService } from './ai-analysis.service';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { IncidentDetailResponseDto, IncidentResponseDto } from './dto/incident-response.dto';
import { IncidentEventResponseDto } from './dto/incident-event-response.dto';
import { AiAnalysisResponseDto } from './dto/ai-analysis-response.dto';

@Controller('incidents')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly aiAnalysisService: AiAnalysisService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.ANALYST)
  async list(
    @Query() query: QueryIncidentsDto,
  ): Promise<{ items: IncidentResponseDto[]; total: number; page: number; limit: number }> {
    return this.incidentsService.findMany(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.ANALYST)
  async getById(@Param('id') id: string): Promise<IncidentDetailResponseDto> {
    return this.incidentsService.findById(id);
  }

  @Get(':id/events')
  @Roles(Role.ADMIN, Role.ANALYST)
  async getEvents(@Param('id') id: string): Promise<IncidentEventResponseDto[]> {
    return this.incidentsService.findEvents(id);
  }

  @Get(':id/ai-analyses')
  @Roles(Role.ADMIN, Role.ANALYST)
  async getAiAnalyses(@Param('id') id: string): Promise<AiAnalysisResponseDto[]> {
    return this.aiAnalysisService.findAiAnalyses(id);
  }

  @Post(':id/acknowledge')
  @Roles(Role.ADMIN, Role.ANALYST)
  @HttpCode(HttpStatus.OK)
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<IncidentResponseDto> {
    return this.incidentsService.acknowledge(id, user);
  }

  @Post(':id/investigate')
  @Roles(Role.ADMIN, Role.ANALYST)
  @HttpCode(HttpStatus.OK)
  async investigate(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<IncidentResponseDto> {
    return this.incidentsService.investigate(id, user);
  }

  @Post(':id/ai-analysis')
  @Roles(Role.ADMIN, Role.ANALYST)
  @HttpCode(HttpStatus.CREATED)
  async requestAiAnalysis(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<AiAnalysisResponseDto> {
    return this.aiAnalysisService.requestAiAnalysis(incidentIdWithTrim(id), user);
  }

  @Post(':id/resolve')
  @Roles(Role.ADMIN, Role.ANALYST)
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ResolveIncidentDto,
  ): Promise<IncidentResponseDto> {
    return this.incidentsService.resolve(id, user, dto);
  }
}

function incidentIdWithTrim(id: string): string {
  return id ? id.trim() : id;
}
