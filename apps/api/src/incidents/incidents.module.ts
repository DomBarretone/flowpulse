import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { AiAnalysisService } from './ai-analysis.service';
import { IncidentsController } from './incidents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AiModule } from '../ai/ai.module';
import { SanitizerService } from '../common/sanitization/sanitizer.service';

@Module({
  imports: [PrismaModule, UsersModule, AiModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, AiAnalysisService, SanitizerService],
  exports: [IncidentsService, AiAnalysisService, SanitizerService],
})
export class IncidentsModule {}
