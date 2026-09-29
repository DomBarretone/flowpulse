import {
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AutomationStatus, Criticality, IntegrationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyService, GeneratedApiKeyResponse, SafeApiKey } from '../api-keys/api-key.service';
import { JsonLoggerService } from '../common/logging/json-logger.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyService: ApiKeyService,
    @Optional() private readonly logger: JsonLoggerService = new JsonLoggerService(),
  ) {}

  async create(createDto: CreateAutomationDto, ownerId: string) {
    const created = await this.prisma.automation.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        criticality: createDto.criticality,
        expected_duration_seconds: createDto.expected_duration_seconds,
        owner_id: ownerId,
        status: AutomationStatus.DRAFT,
        integration_status: IntegrationStatus.PENDING,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log({
      event_name: 'automation_created',
      automation_id: created.id,
      owner_id: ownerId,
      criticality: created.criticality,
    });

    return created;
  }

  async findAll(filters?: { status?: AutomationStatus; criticality?: Criticality }) {
    const where: Prisma.AutomationWhereInput = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.criticality) where.criticality = filters.criticality;

    return this.prisma.automation.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const automation = await this.prisma.automation.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        api_keys: {
          select: {
            id: true,
            automation_id: true,
            prefix: true,
            created_at: true,
            revoked_at: true,
            last_used_at: true,
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!automation) {
      throw new NotFoundException(`Automation with ID ${id} not found`);
    }

    return automation;
  }

  async update(id: string, updateDto: UpdateAutomationDto) {
    await this.findOne(id);

    return this.prisma.automation.update({
      where: { id },
      data: updateDto,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async activate(id: string) {
    const automation = await this.findOne(id);

    if (automation.integration_status !== IntegrationStatus.VALIDATED) {
      throw new UnprocessableEntityException(
        'Automation requires a successfully validated integration test before activation',
      );
    }

    const updated = await this.prisma.automation.update({
      where: { id },
      data: { status: AutomationStatus.ACTIVE },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log({
      event_name: 'automation_activated',
      automation_id: id,
      previous_status: automation.status,
    });

    return updated;
  }

  async deactivate(id: string) {
    const automation = await this.findOne(id);

    const updated = await this.prisma.automation.update({
      where: { id },
      data: { status: AutomationStatus.INACTIVE },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log({
      event_name: 'automation_deactivated',
      automation_id: id,
      previous_status: automation.status,
    });

    return updated;
  }

  async createApiKey(automationId: string): Promise<GeneratedApiKeyResponse> {
    await this.findOne(automationId);
    return this.apiKeyService.createApiKey(automationId);
  }

  async revokeApiKey(automationId: string, keyId: string): Promise<SafeApiKey> {
    await this.findOne(automationId);
    return this.apiKeyService.revokeApiKey(automationId, keyId);
  }
}
