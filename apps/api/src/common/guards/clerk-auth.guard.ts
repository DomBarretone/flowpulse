import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClerkService } from '../../users/clerk.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly clerkService: ClerkService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    try {
      const payload = await this.clerkService.verify(token);

      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Missing or invalid authorization token');
      }

      // Sincroniza e busca o usuário persistido no banco de forma confiável
      const user = await this.usersService.resolveUserFromClerk(payload);
      request.user = user;

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // NUNCA registrar o token ou credenciais nos logs!
      throw new UnauthorizedException('Missing or invalid authorization token');
    }
  }
}
