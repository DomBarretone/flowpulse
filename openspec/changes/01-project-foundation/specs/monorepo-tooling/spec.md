# Spec Delta

## Purpose

Establishes the Node.js/TypeScript monorepo skeleton — workspace layout, shared compiler settings, linting, formatting, and canonical root scripts — that every subsequent change builds upon.

## ADDED Requirements

### Requirement: Monorepo workspace structure
The repository SHALL be organized as a Node.js workspaces monorepo containing at minimum `apps/web`, `apps/api`, `tests/e2e`, `docs`, `scripts`, and `infra/terraform` directories.

#### Scenario: Workspace resolution
- **WHEN** `npm install` is executed at the repository root
- **THEN** all workspace packages are linked without error and `node_modules` is hoisted correctly

### Requirement: Canonical root scripts
The root `package.json` SHALL expose the following scripts, each delegating to the appropriate workspace or tool:

| Script | Purpose |
|---|---|
| `dev` | Start `apps/web` and `apps/api` concurrently in development mode |
| `build` | Build all packages (`next build` + `nest build`) |
| `lint` | Run ESLint and Prettier checks across all workspaces |
| `typecheck` | Run `tsc --noEmit` across all workspaces |
| `test` | Run real Jest unit and integration tests across workspaces |
| `db:generate` | Run `prisma generate` inside `apps/api` |
| `db:migrate` | Run `prisma migrate dev` inside `apps/api` |

The `test:e2e` script and Playwright configuration SHALL NOT be introduced as fake placeholders or dummy scripts returning exit code 0; their effective configuration is deferred to the dedicated E2E testing change.

#### Scenario: All canonical scripts exit zero on a clean project
- **WHEN** `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` are executed on the freshly installed project
- **THEN** each command exits with code `0`

### Requirement: Shared TypeScript strict mode
A root `tsconfig.base.json` SHALL enable `strict: true` and be extended by both `apps/web` and `apps/api` without duplicating compiler options.

#### Scenario: Strict mode inheritance
- **WHEN** `tsc --noEmit` is run in either `apps/web` or `apps/api`
- **THEN** TypeScript enforces `strict: true` settings (no implicit any, strict null checks, etc.) and reports zero type errors on a clean scaffold

### Requirement: ESLint and Prettier configured
ESLint SHALL be configured at the repository root (or per workspace) with TypeScript-aware rules. Prettier SHALL be configured for consistent formatting. Both tools SHALL share a single source of truth that is not duplicated across workspaces.

#### Scenario: Lint passes on scaffold
- **WHEN** `npm run lint` is executed on the initial scaffold code
- **THEN** the command exits with code `0`

### Requirement: Environment variable template
A `.env.example` file at the repository root SHALL declare every environment variable required by `apps/api` and `apps/web` with placeholder values and inline documentation. No real secrets SHALL appear in this file or any tracked file.

#### Scenario: .env.example is complete
- **WHEN** a developer copies `.env.example` to `.env` and fills in real values
- **THEN** both `apps/api` and `apps/web` start without missing-environment-variable errors

### Requirement: .gitignore covers sensitive paths
The repository `.gitignore` SHALL exclude `node_modules/`, `.env`, `dist/`, `.next/`, build artifacts, and OS-specific files. No secrets or compiled output SHALL be committed.

#### Scenario: .env is not tracked
- **WHEN** a developer creates a `.env` file at the root
- **THEN** `git status` does not list `.env` as a tracked or staged file
