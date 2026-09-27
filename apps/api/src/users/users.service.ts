import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '@prisma/client';
import { ClerkService, ClerkTokenPayload } from './clerk.service';

export interface TrustedClerkUser {
  clerkUserId: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkService: ClerkService,
  ) {}

  isEmailAdmin(email?: string): boolean {
    if (!email) return false;
    const adminEmailsEnv = process.env.FLOWPULSE_ADMIN_EMAILS || '';
    const adminEmails = adminEmailsEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return adminEmails.includes(email.trim().toLowerCase());
  }

  async resolveUserFromClerk(tokenPayload: ClerkTokenPayload): Promise<User> {
    const clerkUserId = tokenPayload.sub;
    let email = tokenPayload.email;
    let emailVerified = tokenPayload.email_verified ?? false;
    let name = tokenPayload.name;

    // Se email verificado não constar diretamente nos claims do token, consulta a API segura do Clerk
    if (!email || emailVerified === false) {
      const details = await this.clerkService.getUserDetails(clerkUserId);
      if (details) {
        email = details.email || email;
        emailVerified = details.emailVerified || emailVerified;
        name = details.name || name;
      }
    }

    return this.findOrCreateByClerkId({
      clerkUserId,
      email,
      emailVerified,
      name,
    });
  }

  async findOrCreateByClerkId(clerkData: TrustedClerkUser): Promise<User> {
    const { clerkUserId, email, emailVerified, name } = clerkData;

    // 1. Verificar se usuário já existe pelo clerk_user_id
    const existingByClerkId = await this.prisma.user.findUnique({
      where: { clerk_user_id: clerkUserId },
    });

    if (existingByClerkId) {
      // Se email verificado constar em FLOWPULSE_ADMIN_EMAILS e usuário ainda não for ADMIN, promove
      const shouldBeAdmin = Boolean(email && emailVerified && this.isEmailAdmin(email));
      const targetRole = shouldBeAdmin ? Role.ADMIN : existingByClerkId.role;

      if (
        (name && name !== existingByClerkId.name) ||
        (email && email !== existingByClerkId.email) ||
        targetRole !== existingByClerkId.role
      ) {
        return this.prisma.user.update({
          where: { id: existingByClerkId.id },
          data: {
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            role: targetRole,
          },
        });
      }
      return existingByClerkId;
    }

    // 2. Se não encontrou por clerk_user_id, verificar se existe usuário preexistente pelo mesmo email verificado
    if (email && emailVerified) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        // Vinculação por email existente permitida estritamente para email primário verificado
        const shouldBeAdmin = this.isEmailAdmin(email);
        const targetRole = shouldBeAdmin ? Role.ADMIN : existingByEmail.role;

        return this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            clerk_user_id: clerkUserId,
            ...(name ? { name } : {}),
            role: targetRole,
          },
        });
      }
    }

    // 3. Novo usuário: ADMIN apenas se email verificado constar em FLOWPULSE_ADMIN_EMAILS; padrão ANALYST
    const isNewUserAdmin = Boolean(email && emailVerified && this.isEmailAdmin(email));
    const role: Role = isNewUserAdmin ? Role.ADMIN : Role.ANALYST;
    const finalEmail = email || `${clerkUserId}@placeholder.flowpulse.io`;
    const finalName = name || 'FlowPulse User';

    try {
      return await this.prisma.user.create({
        data: {
          clerk_user_id: clerkUserId,
          email: finalEmail,
          name: finalName,
          role,
        },
      });
    } catch (error: unknown) {
      // Garantir idempotência total contra requisições concorrentes (P2002)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        const fallbackUser = await this.prisma.user.findUnique({
          where: { clerk_user_id: clerkUserId },
        });
        if (fallbackUser) {
          return fallbackUser;
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
