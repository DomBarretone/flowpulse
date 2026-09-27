import { Injectable } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';

export interface ClerkTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  [key: string]: unknown;
}

export interface ClerkUserDetails {
  id: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

@Injectable()
export class ClerkService {
  private clerkClient: ReturnType<typeof createClerkClient> | null = null;

  constructor() {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (secretKey) {
      this.clerkClient = createClerkClient({ secretKey });
    }
  }

  async verify(token: string): Promise<ClerkTokenPayload> {
    const secretKey = process.env.CLERK_SECRET_KEY;
    const jwtKey = process.env.CLERK_JWT_KEY;

    const payload = await verifyToken(token, {
      secretKey: secretKey || undefined,
      jwtKey: jwtKey || undefined,
    });

    return payload as unknown as ClerkTokenPayload;
  }

  async getUserDetails(clerkUserId: string): Promise<ClerkUserDetails | null> {
    if (!this.clerkClient) {
      return null;
    }

    try {
      const user = await this.clerkClient.users.getUser(clerkUserId);
      if (!user) return null;

      const primaryEmailObj =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ||
        user.emailAddresses[0];

      const email = primaryEmailObj?.emailAddress;
      const emailVerified = primaryEmailObj?.verification?.status === 'verified';
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

      return {
        id: user.id,
        email,
        emailVerified,
        name: fullName || email || 'User',
      };
    } catch {
      return null;
    }
  }
}
