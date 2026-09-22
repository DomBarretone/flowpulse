import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
