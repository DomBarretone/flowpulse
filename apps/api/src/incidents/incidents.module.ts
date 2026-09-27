import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
