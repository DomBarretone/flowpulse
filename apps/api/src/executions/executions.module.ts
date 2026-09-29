import { Module } from '@nestjs/common';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, ApiKeysModule, IncidentsModule, UsersModule],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
