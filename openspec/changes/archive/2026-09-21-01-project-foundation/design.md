# Design

## Context

The FlowPulse repository does not yet exist as executable code. This change starts from zero: no `apps/`, no `package.json`, no configuration files. Every subsequent change (`02-auth-rbac` through `07-container-iac-deployment`) depends on the conventions established here. See [`proposal.md`](proposal.md) for motivation and scope.

Key constraints from `@docs/architecture.md` and `AGENTS.md`:
- Strict TypeScript throughout (`strict: true`).
- Backend exclusively via NestJS; API prefix `/api/v1` enforced globally.
- Frontend (`apps/web`) is forbidden from importing `@prisma/client` or touching the database directly.
- Migrations via `prisma migrate dev` only — never `prisma db push`.
- No secrets versionable in Git.
- No Clerk, OpenTelemetry, OpenRouter, or business-logic modules in this change.

---

## Goals / Non-Goals

**Goals:**
- Produce a monorepo that passes `npm install`, `lint`, `typecheck`, `test`, and `build` with exit code `0`.
- Establish shared TypeScript, ESLint/Prettier, and Jest configurations that all future changes inherit without duplication.
- Ship a functional NestJS app with `GET /api/v1/health`, `ValidationPipe`, `PrismaService`, and the `User` model migration.
- Ship a functional Next.js app with a minimal homepage, Tailwind CSS, and no database access.
- Provide a valid `docker-compose.yml` (with `web`, `api`, and local `postgres`) and `scripts/check-environment.sh`.
- Document all environment variables in `.env.example`, supporting local PostgreSQL and remote Supabase via `DATABASE_URL`.

**Non-Goals:**
- Clerk authentication and SDK installation: `@clerk/nextjs` and any Clerk configuration belong exclusively to change 02.
- Any business entity beyond `User` in the Prisma schema.
- API Key guards, OpenTelemetry, OpenRouter, audit logs, or dashboard (changes 03–06).
- Production-grade Dockerfiles (multi-stage OCI builds — change 07).
- Terraform or GitHub Actions (change 07).
- Playwright E2E tests or placeholder `test:e2e` scripts: the directory `tests/e2e` is established as part of the monorepo skeleton from foundation containing strictly `.gitkeep`; all Playwright configuration, E2E dependencies, and test cases are deferred to the dedicated testing change, with no dummy scripts faking exit code 0.

---

## Decisions

### D-01: npm workspaces as the monorepo manager

**Decision:** Use native npm workspaces (npm ≥ 7) declared in the root `package.json` with `"workspaces": ["apps/*"]`. The `tests/e2e` directory is established as part of the initial repository skeleton containing strictly `.gitkeep`.

**Rationale:** No additional tooling (Turborepo, Nx, Lerna) is required for a two-app monorepo at this stage. Adding an orchestrator now would be speculative complexity. npm workspaces handle dependency hoisting and cross-package scripts natively. While `tests/e2e` is created structurally from foundation, full Playwright dependencies, E2E configuration, test cases, and workspace scripts are deferred to the dedicated testing stage, avoiding fictitious placeholder scripts or dummy exit 0 tests.

**Alternative considered:** Turborepo — rejected because task caching is not needed until CI is configured (change 07), and its setup cost outweighs the benefit at this stage.

---

### D-02: Shared `tsconfig.base.json` at root

**Decision:** Place a root `tsconfig.base.json` with `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`, and `forceConsistentCasingInFileNames: true`. Each app's `tsconfig.json` extends it with app-specific settings (`target`, `module`, `outDir`, etc.).

**Rationale:** A single base prevents compiler option drift between apps. Each app can still diverge where needed (Next.js needs `jsx: preserve`; NestJS needs `emitDecoratorMetadata: true`).

**Alternative considered:** Duplicating `tsconfig.json` per app without a base — rejected because it creates silent drift risk.

---

### D-03: ESLint flat config at root, per-workspace overrides

**Decision:** Use a root `.eslintrc.js` (or `eslint.config.js` for flat config) that applies shared rules for both TypeScript apps. Each workspace may add overrides via its own `.eslintrc.js` extending the root.

**Rationale:** Single-source-of-truth for linting rules. All workspaces use `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`. Prettier is integrated via `eslint-config-prettier` to avoid rule conflicts.

**Alternative considered:** Per-workspace independent ESLint configs — rejected because it duplicates the plugin setup and allows silent rule divergence.

---

### D-04: NestJS scaffold with global `/api/v1` prefix

**Decision:** Set the global API prefix in `main.ts` via `app.setGlobalPrefix('api/v1')`. The health endpoint is implemented as `HealthController` under the default path (`/health`), which resolves to `GET /api/v1/health` after the prefix.

**Rationale:** Enforcing the prefix globally from `main.ts` ensures no controller can accidentally expose routes outside `/api/v1`. Placing logic in `AppModule` keeps the entry point clean.

---

### D-05: PrismaService as a global NestJS module

**Decision:** Create `PrismaModule` (with `@Global()`) that provides and exports `PrismaService`. `PrismaService` extends `PrismaClient` and implements `OnModuleInit` to call `$connect()` and `OnModuleDestroy` to call `$disconnect()`.

**Rationale:** Registering Prisma globally avoids importing `PrismaModule` in every feature module. This pattern is the canonical NestJS/Prisma integration approach and scales correctly as feature modules are added in later changes.

---

### D-06: Minimum Prisma schema — User only

**Decision:** The `schema.prisma` for this change contains exactly:
- `generator client` block
- `datasource db` pointing to `DATABASE_URL`
- `enum Role { ADMIN ANALYST }`
- `model User` with fields matching the spec (`id`, `email`, `name`, `role`, `created_at`, `updated_at`). The model is provider-agnostic; no `clerk_user_id` or external auth provider attributes are included in this foundation change.

**Rationale:** Per `AGENTS.md` and the roadmap: "Never anticipate tables from future changes." The `User` entity is the only one needed for foundational tooling and is generic. Provider-specific identifiers (such as `clerk_user_id`) belong strictly to change 02 (auth/RBAC).

---

### D-07: Jest configuration per workspace with a root aggregate script

**Decision:** Each app (`apps/api`, `apps/web`) has its own `jest.config.ts` (or `jest.config.js`). The root `npm run test` aggregates tests across workspaces.

**Rationale:** Isolates test runtimes (NestJS tests need `ts-jest` with `emitDecoratorMetadata`; Next.js tests need `jest-environment-jsdom`). The root script aggregates them.

**Test scope for this change:**
- `apps/api`: unit test for `HealthController`, integration test for `GET /api/v1/health` via Supertest (returning 200 unauthenticated), unit test for `request_id` middleware, unit test for `ValidationPipe` rejection behavior (422), and `PrismaService` connection test.
- `apps/web`: smoke test confirming the root route renders "FlowPulse" text.
- No E2E Playwright tests and no placeholder scripts: `tests/e2e` contains strictly `.gitkeep`; do not create fake `test:e2e` scripts that always return exit code 0. Playwright setup, E2E dependencies, and test cases are deferred to the dedicated testing milestone.

---

### D-08: Docker Compose with local PostgreSQL

**Decision:** `docker-compose.yml` at the root defines `web`, `api`, and `postgres` services. The `postgres` service runs a PostgreSQL container with persistent volume storage and healthchecks for local development. Both `web` and `api` mount source code for hot-reload. The backend uses `DATABASE_URL` to connect to local PostgreSQL in development or to Supabase in remote environments. The frontend has strictly no direct database access.

**Rationale:** Including a local `postgres` container in Docker Compose allows fully functional offline development and isolated testing, while ensuring the application switches seamlessly to Supabase in remote environments via `DATABASE_URL`.

---

### D-09: Tailwind CSS in `apps/web` with shadcn/ui base (No Clerk)

**Decision:** Tailwind CSS is installed and configured in `apps/web`. `shadcn/ui` is installed with base theme tokens, but without business components. The Clerk SDK (`@clerk/nextjs`) and any Clerk configuration are completely omitted from this change.

**Rationale:** Ensures a clean foundational frontend setup. All Clerk dependencies and configuration belong strictly to change `02-auth-rbac`.

---

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Inconsistent database state across local vs remote environments | Use versioned migrations (`prisma migrate dev`) applied against local Docker PostgreSQL in dev and Supabase in remote environments |
| npm hoisting conflicts between workspaces | Pin major versions in root `package.json`; use `package-lock.json` |
| Next.js App Router and Jest `jest-environment-jsdom` incompatibility | Use `@jest/globals` and mock the Next.js navigation APIs as needed; this is a known pattern |
| Accidental direct database access from frontend | Maintain strict boundary: `@prisma/client` is only in `apps/api/package.json` and never imported in `apps/web` |
| `prisma migrate dev` requires a live database connection at migration time | Local Docker PostgreSQL provides an immediately available local database; `db:generate` works offline |

---

## Migration Plan

This is a greenfield change with no existing code to migrate. Deployment sequence:

1. Create repository structure and install dependencies (`npm install`).
2. Start local PostgreSQL container (`docker compose up -d postgres`) or target Supabase development instance.
3. Run `npm run db:migrate` to apply the initial `User` migration.
4. Run `npm run db:generate` to generate the Prisma Client.
5. Run `npm run build` to confirm both apps build cleanly.
6. Run `npm run test` to confirm all unit and integration tests pass.
7. Run `npm run lint` and `npm run typecheck` to confirm zero errors.

Rollback: drop the `users` table on the database and delete the migration file (this is the first and only migration in the change).

---

## Open Questions

None. All decisions required to unblock the task breakdown are resolved above.
