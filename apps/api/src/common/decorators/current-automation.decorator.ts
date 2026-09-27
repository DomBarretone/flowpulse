import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Automation } from '@prisma/client';

export const CurrentAutomation = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Automation => {
    const request = ctx.switchToHttp().getRequest();
    return request.automation;
  },
);
