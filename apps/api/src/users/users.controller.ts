import { Controller, Get, Post, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { User, Role } from '@prisma/client';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil retornado com sucesso', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Token de autenticação ausente ou inválido' })
  getMe(@CurrentUser() user: User): UserResponseDto {
    return user;
  }

  @Post('sync')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sincronização explícita e confiável de perfil' })
  @ApiResponse({
    status: 200,
    description: 'Usuário sincronizado com sucesso',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token de autenticação ausente ou inválido' })
  sync(@CurrentUser() user: User): UserResponseDto {
    return user;
  }

  @Get('admin-test')
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Endpoint restrito a administradores para teste de RBAC' })
  @ApiResponse({ status: 200, description: 'Acesso concedido para ADMIN' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado: requer papel ADMIN' })
  adminTest(@CurrentUser() user: User) {
    return {
      message: 'Admin access granted',
      user,
    };
  }
}
