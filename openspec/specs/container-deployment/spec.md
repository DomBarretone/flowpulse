# container-deployment Specification

## Purpose
Defines requirements for secure, minimal, multi-stage OCI container images for frontend and backend services, build context isolation with probe verification, Node native healthchecks, non-root user execution, and local production container verification.

## Requirements

### Requirement: Root Build Context Isolation and Probe Verification
The repository SHALL maintain a root `.dockerignore` file that strictly prevents local secrets, authentication credentials, build artifacts, and development directories from entering the Docker build context. Local environment files (`.env`, `.env.*` with the exception of `.env.example`), auth tokens (`playwright/.auth`), version control metadata (`.git`), test reports, and workspace `node_modules` SHALL be excluded. The isolation effectiveness SHALL be validated through a build-context sentinel probe and final-image inspection.

#### Scenario: Build context probe validates exclusion of sentinel files
- **WHEN** temporary sentinel files representing local environment and auth artifacts are present in the workspace and a Docker build probe executes `COPY . .`
- **THEN** none of the sentinel files are present in the resulting probe filesystem

#### Scenario: Final production image inspection confirms zero sensitive artifacts
- **WHEN** the production container images are inspected after compilation
- **THEN** `.env`, `playwright/.auth`, test results, and development artifacts do not exist anywhere in the image filesystem

#### Scenario: Build context preserves required workspace manifest files
- **WHEN** a Docker build executes for `apps/api` or `apps/web`
- **THEN** root `package.json`, `package-lock.json`, and application source files are available to the builder stage to resolve npm workspace dependencies

### Requirement: Production Backend OCI Container
The backend service (`apps/api`) SHALL be packaged as a multi-stage OCI-compliant container image. The image SHALL compile NestJS TypeScript code and generate the Prisma Client in a builder stage, copy only necessary runtime artifacts into the final production image, run under a non-root user (`node`), configure `NODE_ENV=production`, and implement an active healthcheck targeting `/api/v1/health` using Node.js runtime native `fetch` without requiring external CLI utilities.

#### Scenario: Backend image runs under non-root user
- **WHEN** the production backend container image is inspected via `docker inspect`
- **THEN** the execution user is configured as `node` (UID/GID non-zero) and the container process does not run as `root`

#### Scenario: Backend healthcheck responds successfully via runtime fetch
- **WHEN** the backend container is running and its healthcheck command executes using Node.js native `fetch`
- **THEN** the probe accesses `http://localhost:3001/api/v1/health` and receives HTTP status 200 with JSON payload `{"status":"ok", ...}`

### Requirement: Production Frontend OCI Container
The frontend service (`apps/web`) SHALL be packaged as a multi-stage OCI-compliant container image utilizing Next.js standalone output. Public build-time configuration variables (`NEXT_PUBLIC_*`) SHALL be provided via build arguments and inlined during `next build`. Runtime secrets SHALL NOT be passed as build arguments or stored in the image. The image SHALL execute under a non-root user (`node`), configure `NODE_ENV=production`, and expose HTTP service on port 3000 with a healthcheck utilizing Node.js runtime native `fetch`.

#### Scenario: Frontend image builds standalone with public config and runs non-root
- **WHEN** the production frontend container image is built and inspected
- **THEN** public `NEXT_PUBLIC_*` variables are inlined in the standalone bundle, runtime secrets are absent, and the process runs under user `node`

#### Scenario: Frontend healthcheck verifies server readiness via runtime fetch
- **WHEN** the frontend container is running and its healthcheck command executes using Node.js native `fetch`
- **THEN** the probe confirms the Next.js HTTP server is accepting connections on port 3000

### Requirement: Local Production Container Compose
The repository SHALL provide a production Docker Compose definition (`docker-compose.prod.yml`) that validates local orchestration of the production container images. The composition SHALL define `api` and `web` services without volume bind-mounts of host source code, define healthchecks, and enforce explicit environment variable injection.

#### Scenario: Production compose configuration passes syntax validation
- **WHEN** `docker compose -f docker-compose.prod.yml config` is executed at the repository root
- **THEN** the command exits with code 0 and outputs valid service definitions for `api` and `web`

#### Scenario: Production compose enforces health-dependent startup
- **WHEN** the production compose stack is started
- **THEN** `web` waits for `api` to report healthy status before completing initialization
