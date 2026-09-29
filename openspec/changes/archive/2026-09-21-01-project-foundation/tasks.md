# Tasks: 01-project-foundation

## 1. Monorepo & Tooling Setup
- [x] 1.1 Create monorepo directory skeleton: `apps/web`, `apps/api`, `infra/terraform`, `tests/e2e` (with `.gitkeep`), `scripts`, `docs`
- [x] 1.2 Initialize root `package.json` with npm workspaces (`apps/*`) and canonical scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`), without introducing fake or placeholder `test:e2e` scripts
- [x] 1.3 Create root `tsconfig.base.json` with strict mode (`"strict": true`), `esModuleInterop: true`, and standard compiler options
- [x] 1.4 Configure ESLint and Prettier at repository root with TypeScript support (`@typescript-eslint`) and prettier integration (`eslint-config-prettier`)
- [x] 1.5 Create root `.gitignore` ignoring `node_modules`, `.next`, `dist`, `.env`, build artifacts, and coverage
- [x] 1.6 Create root `.env.example` documenting all required variables (including `DATABASE_URL` supporting local PostgreSQL via Docker in development and Supabase in remote environments) with placeholder values

## 2. Backend Scaffold (apps/api)
- [x] 2.1 Scaffold NestJS application in `apps/api` extending root `tsconfig.base.json`
- [x] 2.2 Configure `main.ts` with global API prefix `app.setGlobalPrefix('api/v1')`
- [x] 2.3 Implement global `request_id` middleware (generating UUID v4 per request and attaching to request/response headers)
- [x] 2.4 Configure global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` (rejecting unexpected fields with 422)
- [x] 2.5 Implement global RFC 7807 Problem Details exception filter returning `type`, `title`, `status`, `detail`, `instance`, and `request_id`
- [x] 2.6 Implement `HealthController` and unauthenticated `GET /api/v1/health` endpoint returning `{"status": "ok", "timestamp": "<ISO 8601 datetime>"}`
- [x] 2.7 Configure `@nestjs/swagger` OpenAPI documentation endpoint at `/api/docs`
- [x] 2.8 Setup Prisma ORM in `apps/api` with minimal provider-agnostic `schema.prisma` containing only `Role` enum (`ADMIN | ANALYST`) and generic `User` model (without `clerk_user_id`), connected via `DATABASE_URL`
- [x] 2.9 Implement global `PrismaModule` and `PrismaService` with `$connect()` and `$disconnect()` lifecycle hooks
- [x] 2.10 Generate Prisma Client (`npm run db:generate`) and apply initial migration (`npm run db:migrate`) creating the `users` table
- [x] 2.11 Implement real backend unit and integration tests: `HealthController` unit test, `GET /api/v1/health` Supertest integration test, `request_id` middleware test, `ValidationPipe` 422 rejection test, and `PrismaService` connection test

## 3. Frontend Scaffold (apps/web)
- [x] 3.1 Scaffold Next.js App Router application in `apps/web` with TypeScript extending `tsconfig.base.json`
- [x] 3.2 Configure Tailwind CSS and import base styles into root layout
- [x] 3.3 Install `shadcn/ui` base dependencies and configure theme tokens (without adding business components)
- [x] 3.4 Ensure complete absence of Clerk: do NOT install `@clerk/nextjs` or configure Clerk providers/middleware (deferred to change 02-auth-rbac)
- [x] 3.5 Create root page (`app/page.tsx`) displaying product title "FlowPulse" and operational status indicator
- [x] 3.6 Verify strict architectural boundary: ensure `@prisma/client` and database dependencies are absent from `apps/web`
- [x] 3.7 Add real frontend smoke test with Jest verifying the root page renders "FlowPulse"

## 4. Local Development Environment & Scripts
- [x] 4.1 Create `docker-compose.yml` at repository root defining `web`, `api`, and `postgres` services, with persistent storage and healthchecks for `postgres`, hot-reload volumes for `web` and `api`, and strictly no direct database connection from `web`
- [x] 4.2 Create executable script `scripts/check-environment.sh` validating mandatory environment variables and database connectivity (supporting local PostgreSQL container and remote Supabase)
- [x] 4.3 Configure Jest root runner to aggregate real tests across workspaces without placeholder `test:e2e` scripts

## 5. Verification & Closure
- [x] 5.1 Run `npm run lint` and verify zero ESLint and Prettier errors
- [x] 5.2 Run `npm run typecheck` and verify `tsc --noEmit` passes with zero errors
- [x] 5.3 Run `npm run test` and verify that all real unit, integration, and smoke tests pass cleanly with exit code 0
- [x] 5.4 Run `npm run db:generate` and `npm run db:migrate` and verify Prisma commands complete without error
- [x] 5.5 Run `npm run build` and verify Next.js and NestJS production builds succeed
- [x] 5.6 Validate concurrent dev execution (`npm run dev`) for both services
