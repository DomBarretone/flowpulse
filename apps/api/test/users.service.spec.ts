import { Role, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClerkService } from '../src/users/clerk.service';
import { UsersService } from '../src/users/users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let clerkService: {
    verify: jest.Mock;
    getUserDetails: jest.Mock;
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FLOWPULSE_ADMIN_EMAILS: 'admin@flowpulse.io, lead@flowpulse.io',
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    clerkService = {
      verify: jest.fn(),
      getUserDetails: jest.fn(),
    };

    service = new UsersService(
      prisma as unknown as PrismaService,
      clerkService as unknown as ClerkService,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('findOrCreateByClerkId', () => {
    it('should assign ANALYST role by default to a new standard user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const createdUser: User = {
        id: 'new-uuid',
        clerk_user_id: 'user_analyst_123',
        email: 'analyst@flowpulse.io',
        name: 'Analyst User',
        role: Role.ANALYST,
        created_at: new Date(),
        updated_at: new Date(),
      };
      prisma.user.create.mockResolvedValue(createdUser);

      const result = await service.findOrCreateByClerkId({
        clerkUserId: 'user_analyst_123',
        email: 'analyst@flowpulse.io',
        emailVerified: true,
        name: 'Analyst User',
      });

      expect(result.role).toBe(Role.ANALYST);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clerk_user_id: 'user_analyst_123',
          email: 'analyst@flowpulse.io',
          role: Role.ANALYST,
        }),
      });
    });

    it('should assign ADMIN role when verified primary email is in FLOWPULSE_ADMIN_EMAILS', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const createdAdmin: User = {
        id: 'admin-uuid',
        clerk_user_id: 'user_admin_123',
        email: 'admin@flowpulse.io',
        name: 'Admin User',
        role: Role.ADMIN,
        created_at: new Date(),
        updated_at: new Date(),
      };
      prisma.user.create.mockResolvedValue(createdAdmin);

      const result = await service.findOrCreateByClerkId({
        clerkUserId: 'user_admin_123',
        email: 'admin@flowpulse.io',
        emailVerified: true,
        name: 'Admin User',
      });

      expect(result.role).toBe(Role.ADMIN);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clerk_user_id: 'user_admin_123',
          email: 'admin@flowpulse.io',
          role: Role.ADMIN,
        }),
      });
    });

    it('should assign ANALYST if email is in FLOWPULSE_ADMIN_EMAILS but emailVerified is false', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const createdUser: User = {
        id: 'unverified-uuid',
        clerk_user_id: 'user_unverified_admin',
        email: 'admin@flowpulse.io',
        name: 'Unverified Admin',
        role: Role.ANALYST,
        created_at: new Date(),
        updated_at: new Date(),
      };
      prisma.user.create.mockResolvedValue(createdUser);

      const result = await service.findOrCreateByClerkId({
        clerkUserId: 'user_unverified_admin',
        email: 'admin@flowpulse.io',
        emailVerified: false,
        name: 'Unverified Admin',
      });

      expect(result.role).toBe(Role.ANALYST);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: Role.ANALYST,
        }),
      });
    });

    it('should be strictly idempotent and return existing user without duplicating', async () => {
      const existingUser: User = {
        id: 'existing-uuid',
        clerk_user_id: 'user_existing_123',
        email: 'analyst@flowpulse.io',
        name: 'Existing Analyst',
        role: Role.ANALYST,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.findOrCreateByClerkId({
        clerkUserId: 'user_existing_123',
        email: 'analyst@flowpulse.io',
        emailVerified: true,
        name: 'Existing Analyst',
      });

      expect(result).toEqual(existingUser);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should link existing user by email when verified, preserving original UUID', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // No user with clerk_user_id
        .mockResolvedValueOnce({
          // User exists with same email
          id: 'legacy-uuid-456',
          clerk_user_id: '',
          email: 'preexisting@flowpulse.io',
          name: 'Preexisting User',
          role: Role.ANALYST,
          created_at: new Date(),
          updated_at: new Date(),
        });

      const updatedUser: User = {
        id: 'legacy-uuid-456',
        clerk_user_id: 'user_new_clerk_id',
        email: 'preexisting@flowpulse.io',
        name: 'Preexisting User',
        role: Role.ANALYST,
        created_at: new Date(),
        updated_at: new Date(),
      };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.findOrCreateByClerkId({
        clerkUserId: 'user_new_clerk_id',
        email: 'preexisting@flowpulse.io',
        emailVerified: true,
        name: 'Preexisting User',
      });

      expect(result.id).toBe('legacy-uuid-456');
      expect(result.clerk_user_id).toBe('user_new_clerk_id');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'legacy-uuid-456' },
        data: expect.objectContaining({
          clerk_user_id: 'user_new_clerk_id',
        }),
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle concurrency safely using P2002 fallback', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // 1st check before create
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({
          // fallback findUnique
          id: 'concurrent-uuid',
          clerk_user_id: 'concurrent_user_id',
          email: 'concurrent@flowpulse.io',
          name: 'Concurrent User',
          role: Role.ANALYST,
          created_at: new Date(),
          updated_at: new Date(),
        });

      prisma.user.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.findOrCreateByClerkId({
        clerkUserId: 'concurrent_user_id',
        email: 'concurrent@flowpulse.io',
        emailVerified: true,
      });

      expect(result.id).toBe('concurrent-uuid');
    });
  });

  describe('resolveUserFromClerk', () => {
    it('should query Clerk API when email is missing from token claims', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'fetched-uuid',
        clerk_user_id: 'user_no_email_claim',
        email: 'from_clerk_api@flowpulse.io',
        name: 'Clerk API Name',
        role: Role.ANALYST,
        created_at: new Date(),
        updated_at: new Date(),
      });

      clerkService.getUserDetails.mockResolvedValue({
        id: 'user_no_email_claim',
        email: 'from_clerk_api@flowpulse.io',
        emailVerified: true,
        name: 'Clerk API Name',
      });

      const result = await service.resolveUserFromClerk({
        sub: 'user_no_email_claim',
      });

      expect(clerkService.getUserDetails).toHaveBeenCalledWith('user_no_email_claim');
      expect(result.email).toBe('from_clerk_api@flowpulse.io');
    });
  });
});
