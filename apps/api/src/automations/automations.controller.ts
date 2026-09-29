import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AutomationStatus, Criticality, Role, User } from '@prisma/client';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@ApiTags('automations')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar nova automação (DRAFT / PENDING)' })
  @ApiResponse({ status: 201, description: 'Automação criada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Requer papel ADMIN' })
  @ApiResponse({ status: 422, description: 'Erro de validação nos campos informados' })
  async create(@Body() createDto: CreateAutomationDto, @CurrentUser() user: User) {
    return this.automationsService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar automações cadastradas' })
  @ApiResponse({ status: 200, description: 'Lista de automações retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async findAll(
    @Query('status') status?: AutomationStatus,
    @Query('criticality') criticality?: Criticality,
  ) {
    return this.automationsService.findAll({ status, criticality });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalhes da automação' })
  @ApiResponse({ status: 200, description: 'Detalhes da automação retornados com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  async findOne(@Param('id') id: string) {
    return this.automationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar dados cadastrais da automação' })
  @ApiResponse({ status: 200, description: 'Automação atualizada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Requer papel ADMIN' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  @ApiResponse({ status: 422, description: 'Erro de validação nos campos' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateAutomationDto) {
    return this.automationsService.update(id, updateDto);
  }

  @Post(':id/activate')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ativar monitoramento da automação (requer integration_status = VALIDATED)',
  })
  @ApiResponse({ status: 200, description: 'Automação ativada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Requer papel ADMIN' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  @ApiResponse({ status: 422, description: 'Integração pendente ou não validada' })
  async activate(@Param('id') id: string) {
    return this.automationsService.activate(id);
  }

  @Post(':id/deactivate')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar monitoramento da automação' })
  @ApiResponse({ status: 200, description: 'Automação desativada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Requer papel ADMIN' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  async deactivate(@Param('id') id: string) {
    return this.automationsService.deactivate(id);
  }

  @Post(':id/api-keys')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Gerar nova credencial de integração para a automação (segredo retornado uma única vez)',
  })
  @ApiResponse({
    status: 201,
    description: 'Credencial gerada com sucesso contendo o segredo completo',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Requer papel ADMIN' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  async createApiKey(@Param('id') id: string) {
    return this.automationsService.createApiKey(id);
  }

  @Post(':id/api-keys/:keyId/revoke')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revogar imediatamente uma credencial de integração' })
  @ApiResponse({ status: 200, description: 'Credencial revogada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Requer papel ADMIN' })
  @ApiResponse({ status: 404, description: 'Automação ou chave não encontrada' })
  async revokeApiKey(@Param('id') id: string, @Param('keyId') keyId: string) {
    return this.automationsService.revokeApiKey(id, keyId);
  }
}
