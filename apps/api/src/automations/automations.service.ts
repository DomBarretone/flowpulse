import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AutomationStatus, Criticality, IntegrationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyService, GeneratedApiKeyResponse, SafeApiKey } from '../api-keys/api-key.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async create(createDto: CreateAutomationDto, ownerId: string) {
    return this.prisma.automation.create({
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

    return this.prisma.automation.update({
      where: { id },
      data: { status: AutomationStatus.ACTIVE },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);

    return this.prisma.automation.update({
      where: { id },
      data: { status: AutomationStatus.INACTIVE },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
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
