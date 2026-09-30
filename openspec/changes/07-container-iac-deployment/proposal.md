# Proposal: 07-container-iac-deployment

## Why

FlowPulse currently operates through local developer runtime scripts and development Dockerfiles without hardened production containerization, reproducible cloud infrastructure as code, or an automated CI/CD deployment pipeline. To fulfill RNF-06 (Portability and Deployment) and RNF-08 (Code and Configuration Governance), the system requires multi-stage OCI containers, modular Terraform infrastructure targeting AWS ECS Fargate with native HTTPS and zero-leak state management, isolated environment configurations, and an end-to-end GitHub Actions pipeline with automated database migrations and post-deployment smoke tests.

## What Changes

- **Secure Docker Build Context & Verification**: Create a root `.dockerignore` file strictly excluding local secrets (`.env`, `.env.*`), test credentials (`playwright/.auth`), build artifacts, and development directories. Add a two-level verification probe (build-context probe with sentinels and final-image inspection) proving no sensitive files or source secrets leak into container layers.
- **Production OCI Multi-Stage Containerization**: Implement production Dockerfiles for `apps/api` (NestJS) and `apps/web` (Next.js 15 standalone) executing under non-root users (`node`). Implement reliable healthchecks using Node.js runtime native `fetch` rather than assuming external CLI tools (`curl`) exist in minimal images.
- **Explicit Build-Time vs Runtime Configuration**: Clearly delineate public build-time variables (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`, etc. inlined during `next build`) from runtime secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`, `OPENROUTER_API_KEY`), strictly forbidding runtime secrets from Docker `ARG`, Docker build `ENV`, or image contents.
- **Production Compose Validation**: Provide a local production compose configuration (`docker-compose.prod.yml`) validating container interoperability, health dependencies, and environment variable injection while preserving existing `docker-compose.yml` for development.
- **Infrastructure as Code (Terraform CLI >= 1.11 & AWS Provider >= 5.86.0, < 6.0.0)**: Define modular Terraform configurations in `infra/terraform/` with partial backend configuration (`backend "s3" {}`) initialized via external non-secret arguments with native S3 locking (`use_lockfile = true`) without DynamoDB, VPC networking without NAT Gateway, ECR registries, ECS Fargate services, Application Load Balancer with HTTPS listener on port 443 and HTTP 80 redirect.
- **Zero-Persistence Secrets in Terraform State**: Manage production runtime secrets in AWS SSM Parameter Store using write-only arguments (`value_wo` and `value_wo_version`) with `sensitive = true` and `ephemeral = true` variables. Validate absence of secrets in plan and state files using a synthetic canary secret (`FLOWPULSE_TERRAFORM_SECRET_CANARY_DO_NOT_PERSIST`) reporting strictly PASS/FAIL without logging real credentials.
- **Cost-Conscious High Availability**: Configure ECS Fargate across 2 Availability Zones with configurable `desired_count` (defaulting to 2 for HA, reducible to 1 for academic cost management), documenting teardown procedures (`terraform destroy`) post-evaluation.
- **Environment Isolation and Direct Database Migration**: Separate Development from Production. Execute single-runner `prisma migrate deploy` during CD using direct PostgreSQL session connection (port 5432, not transaction poolers) prior to ECS service rollout.
- **Automated CI Pipeline (Pull Requests)**: Implement `.github/workflows/ci.yml` running linting, typechecking, serialized unit/integration tests, Next.js/NestJS builds, Playwright E2E tests (which explicitly fail on missing secrets in trusted branches, using deterministic local OpenRouter mock), Terraform formatting/validation, and Docker build context security checks.
- **Automated CD Pipeline (Main Branch)**: Implement `.github/workflows/deploy.yml` triggered on main pushes to build immutable tagged OCI images (`${{ github.sha }}`), push to ECR, execute controlled `prisma migrate deploy`, initialize Terraform via partial backend config and apply infrastructure via AWS OIDC, await service readiness, and run automated HTTPS smoke tests.
- **Post-Deployment HTTPS Verification**: Automated smoke tests verifying HTTPS 200 on frontend `/`, HTTPS 200 on API `/api/v1/health`, and HTTP 401 unauthorized enforcement on protected endpoints.

## Capabilities

### New Capabilities

- `container-deployment`: Defines OCI multi-stage production container builds, build context exclusion of secrets with sentinel probe verification, Node native healthchecks, non-root user execution, and production container validation.
- `infrastructure-as-code`: Defines modular Terraform infrastructure provisioning for AWS ECS Fargate, S3 partial remote state with native locking (`use_lockfile = true`), HTTPS ALB with ACM, ephemeral zero-leak SSM secrets with synthetic canary testing, networking without NAT Gateways, and configurable HA scaling.
- `deployment-environments`: Defines separation between development and production environments, runtime secret management vs public build-time configuration, and direct database migration connectivity.
- `ci-cd-deployment`: Defines GitHub Actions automation for PR validation gates (with explicit non-silent failure on missing secrets in trusted runs), immutable image publishing, AWS OIDC authentication, and continuous deployment.
- `deployment-verification`: Defines pre-release direct database migration execution, container readiness verification with backoff, and automated post-deployment HTTPS smoke tests.

### Modified Capabilities

None. Existing specifications remain unchanged; new deployment and infrastructure concerns are addressed through the dedicated capabilities above.

## Impact

- **Build Tooling & Dependencies**: Adds Next.js standalone build configuration in `apps/web/next.config.ts`, root `.dockerignore`, and GitHub Actions workflow definitions.
- **Runtime & Operations**: Containers run as non-root (`node`) users with strictly externalized environment variables and native fetch healthchecks.
- **Infrastructure**: New `infra/terraform/` directory containing Terraform modules, bootstrap S3 bucket for remote state with native locking, and production environment declarations.
- **CI/CD**: Pull requests and main branch merges trigger GitHub Actions workflows requiring configured GitHub Secrets and AWS OIDC role.
- **Database**: Production deployments execute `prisma migrate deploy` via direct port 5432 connection before service startup, without altering `schema.prisma` or generating new migrations.
