import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ClerkService } from './clerk.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, ClerkService, ClerkAuthGuard, RolesGuard],
  exports: [UsersService, ClerkService, ClerkAuthGuard, RolesGuard],
})
export class UsersModule {}
