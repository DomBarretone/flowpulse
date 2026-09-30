# Design: 07-container-iac-deployment

## Context

FlowPulse has completed all core functional modules (Changes 01 through 06), including Clerk authentication, automation management, event ingestion, incident lifecycle, AI-assisted analysis, and OpenTelemetry observability. The local development environment uses `docker-compose.yml` with dev Dockerfiles (`Dockerfile.dev`) mounting host directories.

However, the repository currently lacks:
1. A root `.dockerignore` file, creating a major vulnerability where local `.env`, `playwright/.auth`, and build artifacts could be copied into container builds during `COPY . .`.
2. Multi-stage production OCI container images running as non-root users with reliable runtime healthchecks.
3. Declarative cloud infrastructure as code (Terraform CLI >= 1.11) targeting a managed container environment with native HTTPS, zero-leak secrets in state, bounded AWS provider constraint, and modern S3 state locking without DynamoDB.
4. An automated CI/CD pipeline executing quality gates on pull requests (with non-silent failure on missing secrets in trusted runs) and continuous deployment on main merges.

See `proposal.md` for overall motivation and objectives.

## Goals / Non-Goals

**Goals:**
- Provide complete build context sanitization via root `.dockerignore`, validated through a build-context sentinel probe and final image inspection.
- Provide optimized, multi-stage production Dockerfiles for `apps/api` (NestJS) and `apps/web` (Next.js 15 standalone) executing as non-root user `node`, utilizing Node.js runtime native `fetch` for healthchecks (avoiding reliance on external binaries like `curl`).
- Explicitly separate public build-time configuration (inlined `NEXT_PUBLIC_*` variables) from runtime secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`, `OPENROUTER_API_KEY`).
- Preserve existing local development workflow in `docker-compose.yml` while providing `docker-compose.prod.yml` for local production container validation.
- Deliver modular Terraform definitions in `infra/terraform/` for AWS ECS Fargate, ECR, Application Load Balancer with real HTTPS (port 443 + HTTP 80 redirect), and write-only SSM parameters.
- Establish remote state management using S3 with native lockfile locking (`use_lockfile = true`) via partial backend configuration, eliminating DynamoDB.
- Prevent secret persistence in Terraform state/plan via Terraform CLI >= 1.11 ephemeral variables and AWS provider (`>= 5.86.0, < 6.0.0`) write-only parameters (`value_wo`), verified through synthetic canary tests.
- Provide configurable HA scaling (`desired_count` default 2, reducible to 1 for academic cost control) without expensive NAT Gateways.
- Automate CI validation via `.github/workflows/ci.yml` (lint, typecheck, test, build, e2e with deterministic mock, terraform validate, docker check).
- Automate CD via `.github/workflows/deploy.yml` with AWS OIDC authentication, immutable image tagging (`${{ github.sha }}`), controlled `prisma migrate deploy` over direct port 5432, service rollout wait, and post-deploy HTTPS smoke tests.

**Non-Goals:**
- Kubernetes, Helm, or service mesh architectures (overkill for an academic project).
- CloudFront CDN solely for HTTPS (the Application Load Balancer directly terminates TLS via ACM).
- Provisioning redundant AWS RDS databases (the system reuses the architecture-defined Supabase PostgreSQL instance).
- DynamoDB lock tables (deprecated in modern Terraform S3 remote backend).
- Staging or multi-region environments (outside the scope of this MVP).
- Automated canary rollbacks (manual rollback via Terraform / task definition revision is sufficient for MVP).

## Decisions

### 1. Docker Build Context Security & Two-Level Verification
- **Decision**: Implement a strict root `.dockerignore` file explicitly excluding `.env`, `.env.*` (negating `!.env.example`), `.git`, `node_modules`, `**/node_modules`, `.next`, `**/.next`, `dist`, `**/dist`, `coverage`, `**/coverage`, `playwright-report`, `test-results`, `playwright/.auth`, `.DS_Store`, and IDE files.
- **Verification Strategy**:
  1. *Build-Context Probe*: In CI and validation scripts, generate temporary local canary sentinel files (e.g. `.env.sentinel` and `playwright/.auth/canary.json` with synthetic values) and execute a probe Docker build using the exact same root build context with `COPY . .`. Assert that none of the sentinel files exist in the probe container filesystem.
  2. *Final-Image Inspection*: Inspect the final production images (`flowpulse-api` and `flowpulse-web`) via `docker run --rm <image>` to verify that `.env`, `playwright/.auth`, `test-results`, and source secrets are completely absent.
  3. *Zero-Leak Logging*: Verification scripts and CI workflows must never print secret values to stdout/stderr.
- **Rationale**: Prior to this change, no `.dockerignore` existed. Without it, `COPY . .` pulls sensitive developer tokens into image layers. A two-level probe proves that the exclusion rules work at the build-context ingestion layer and at the final image artifact layer.

### 2. Next.js: Public Build-Time Config vs Runtime Secrets
- **Decision**: Delineate variables into two distinct categories:
  - **Public Build-Time Config (`NEXT_PUBLIC_*`)**:
    - The actual variables identified in `apps/web` are:
      - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
      - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
      - `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
      - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`
      - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`
      - `NEXT_PUBLIC_API_URL`
    - These variables are public by design, inlined into the client JavaScript bundle by Next.js during `next build`, and provided to the frontend Docker build via `ARG` directives.
  - **Runtime Secrets**:
    - `CLERK_SECRET_KEY`, `DATABASE_URL`, `OPENROUTER_API_KEY`.
    - These private credentials must NEVER be passed as Docker `ARG`, declared in Dockerfile `ENV`, or embedded into any container image layer. They are injected exclusively at runtime via ECS Task Definitions referencing AWS SSM Parameter Store.
- **Rationale**: Next.js App Router bakes `NEXT_PUBLIC_*` values into static HTML and client JS bundles during compilation. Passing secrets to `next build` is an anti-pattern that permanently embeds sensitive keys in the image.

### 3. Base Container Images, Multi-Stage Strategy & Native Healthchecks
- **Decision**:
  - `apps/api`: Multi-stage build based on `node:22-bookworm-slim` (or `node:22-alpine` with `libc6-compat` / `openssl`).
    - *Stage 1 (builder)*: Installs all dependencies via `npm ci`, generates Prisma Client (`npm run db:generate`), and compiles NestJS (`npm run build`).
    - *Stage 2 (runner)*: Installs production-only dependencies (`npm ci --omit=dev`), copies compiled `dist/` and generated `@prisma/client`, sets `NODE_ENV=production`, assigns file ownership to user `node`, and runs `node dist/main.js` as user `node` (UID 1000).
    - *Healthcheck*: Uses Node.js built-in runtime `fetch` to eliminate reliance on external CLI packages (`curl` or `wget`):
      `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3001/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"`
  - `apps/web`: Multi-stage build based on `node:22-bookworm-slim` or `node:22-alpine` using Next.js standalone output.
    - *Configuration*: Add `output: 'standalone'` to `apps/web/next.config.ts`.
    - *Stage 1 (builder)*: Receives `NEXT_PUBLIC_*` build arguments, installs dependencies via `npm ci`, and runs `next build`.
    - *Stage 2 (runner)*: Copies `.next/standalone/`, `.next/static/`, and `public/`, sets `NODE_ENV=production`, and runs `node apps/web/server.js` as user `node`.
    - *Healthcheck*:
      `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3000').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"`
- **Rationale**: Eliminates assumptions about OS-level utilities. Minimal container base images frequently do not ship with `curl`, causing false-negative container health failures if not accounted for.

### 4. Docker Compose Strategy (Dev vs Prod Validation)
- **Decision**: Retain existing `docker-compose.yml` for local development (local PostgreSQL, volume bind-mounts, hot reload) and provide `docker-compose.prod.yml` specifically for local production container validation.
- **Rationale**: Keeps existing quality gate `docker compose config` passing without breaking current developer workflows. `docker-compose.prod.yml` allows testing the exact multi-stage images, healthchecks, and non-root execution locally before pushing to cloud.

### 5. Cloud Architecture: AWS ECS Fargate with Real HTTPS
- **Decision**: Use AWS ECS on AWS Fargate with AWS Application Load Balancer (ALB) and Amazon ECR.
  - *Compute*: Amazon ECS Cluster with Fargate launch type (serverless containers, multi-AZ).
  - *Registry*: Amazon ECR private repositories for `flowpulse-api` and `flowpulse-web` with lifecycle policies.
  - *Networking & Cost Optimization*: Dedicated VPC across 2 Availability Zones. Tasks run in public subnets with `assign_public_ip = true` but are strictly protected by Security Groups (inbound HTTP allowed *only* from the ALB security group, outbound allowed to 0.0.0.0/0 for Supabase, Clerk, and OpenRouter). This avoids the \$30+/month cost of AWS NAT Gateways while maintaining tight security.
  - *HTTPS and Load Balancer*:
    - Internet-facing ALB with two listeners:
      - **Port 80 (HTTP)**: Configured with a default permanent redirect action (`HTTP_301`) redirecting all traffic to HTTPS port 443.
      - **Port 443 (HTTPS)**: Configured with SSL termination using an AWS Certificate Manager (ACM) certificate and modern security policy (`ELBSecurityPolicy-TLS13-1-2-2021-06`).
    - *Path Routing*: Under the HTTPS listener, rules route `/api/*` to the API target group (health check path `/api/v1/health`), and default all other traffic to the Web target group (health check path `/`).
    - *Certificate Configuration*: Configured via variable `acm_certificate_arn` (or optional DNS-validated `aws_acm_certificate` when `domain_name` and Route 53 `hosted_zone_id` are provided). The domain name is never hardcoded.
- **Rationale**: Delivers production-grade HTTPS encryption in transit without adding CloudFront complexity.

### 6. Terraform Remote State: Partial Backend & Native S3 Locking (Zero DynamoDB)
- **Decision**:
  - In Terraform, backend blocks cannot interpolate input variables (`var.*` is syntax error in backend blocks). Therefore, declare an empty partial backend in `infra/terraform/environments/production/backend.tf`:
    ```hcl
    terraform {
      backend "s3" {}
    }
    ```
  - Supply backend configuration dynamically at initialization time via CLI flags or a non-secret backend file:
    ```bash
    terraform init \
      -backend-config="bucket=${TF_STATE_BUCKET}" \
      -backend-config="key=production/terraform.tfstate" \
      -backend-config="region=${AWS_REGION}" \
      -backend-config="encrypt=true" \
      -backend-config="use_lockfile=true"
    ```
  - **Native S3 Locking**: Concurrency locking is handled natively by S3 through `use_lockfile = true` (relying on S3 conditional writes and `.tflock` objects). DynamoDB tables (`flowpulse-terraform-locks`) and DynamoDB IAM permissions are completely omitted.
  - **Bootstrap Workflow**:
    1. The bootstrap configuration (`infra/terraform/bootstrap/`) creates the S3 state bucket initially using temporary local state.
    2. Local state is strictly ignored by Git (`.gitignore` protects `*.tfstate`).
    3. Once the S3 bucket exists, the bootstrap state can optionally be migrated into the remote bucket under a separate key (`bootstrap/terraform.tfstate`).
    4. The output bucket name is passed to CI/CD and subsequent environment commands as `TF_STATE_BUCKET`.
- **Rationale**: Partial backend configuration is the canonical Terraform pattern for injecting dynamic bucket names. S3 native locking obsoletes DynamoDB lock tables in Terraform 1.10+.

### 7. Bounded AWS Provider Constraint & Zero Secret Persistence in State
- **Decision**:
  - Require Terraform CLI `>= 1.11.0` and pin the AWS provider within the v5 major cycle:
    ```hcl
    terraform {
      required_version = ">= 1.11.0"
      required_providers {
        aws = {
          source  = "hashicorp/aws"
          version = ">= 5.86.0, < 6.0.0"
        }
      }
    }
    ```
    - *Rationale for constraint*: The `aws_ssm_parameter` resource introduced write-only arguments (`value_wo` and `value_wo_version`) in AWS provider v5.86.0+ to support Terraform 1.11 ephemeral values. The upper bound `< 6.0.0` prevents unexpected breaking changes from a future major upgrade. Commit `.terraform.lock.hcl` to ensure deterministic provider dependencies.
  - Sensitive production variables (`database_url`, `clerk_secret_key`, `openrouter_api_key`) are declared with:
    ```hcl
    sensitive = true
    ephemeral = true
    ```
  - Parameter resources utilize write-only attributes:
    ```hcl
    resource "aws_ssm_parameter" "database_url" {
      name             = "/flowpulse/production/database-url"
      type             = "SecureString"
      value_wo         = var.database_url
      value_wo_version = var.database_url_version
    }
    ```
  - **Synthetic Secret Canary Verification**:
    - Never search for or output real production secrets in CI logs.
    - Execute a verification probe passing a synthetic canary value:
      `FLOWPULSE_TERRAFORM_SECRET_CANARY_DO_NOT_PERSIST`
    - The probe executes `terraform plan -out=tfplan` and `terraform show -json tfplan`, then inspects the resulting JSON and state pull to verify that the canary string does NOT appear anywhere in the plan or state.
    - The verification script reports strictly `PASS` or `FAIL`.

### 8. High Availability, Scalability & Academic Cost Management
- **Decision**:
  - `desired_count` is parameterized in Terraform with a default value of `2`:
    ```hcl
    variable "desired_count" {
      type        = number
      description = "Number of ECS task replicas for high availability"
      default     = 2
    }
    ```
  - **HA Recommendation**: In production, `desired_count = 2` ensures tasks are balanced across 2 distinct Availability Zones behind the ALB.
  - **Academic Cost Control**: For academic evaluation, the operator can set `desired_count = 1` via `terraform.tfvars` to reduce AWS Fargate hourly compute charges by 50%, explicitly documenting that single-task execution trades off multi-AZ fault tolerance.
  - **Environment Teardown**: Both ALB and Fargate incur running costs while active. The project documentation specifies `terraform destroy` as the standard teardown procedure once academic evidence and smoke tests are validated.

### 9. Database Connection for Safe Migration Rollout
- **Decision**:
  - `prisma migrate deploy` executes as a standalone single-runner step in the CD pipeline prior to ECS service task updates.
  - **Connection Mode Verification**: The database connection string used for migration must connect directly to Supabase PostgreSQL (port 5432 session mode, e.g. `db.<project-ref>.supabase.co:5432`) rather than a transaction pooler (port 6543, Supavisor/PgBouncer). Transaction poolers do not support DDL locks and advisory locks required by Prisma migrations.

### 10. CI/CD Automation with GitHub Actions & E2E Discipline
- **Decision**:
  - **CI Workflow (`.github/workflows/ci.yml`)**:
    - Triggered on PRs targeting `main`.
    - Pinned Node.js 22.x, PostgreSQL 16 service container, Terraform CLI >= 1.11.
    - Jobs: `npm ci`, Prisma generate, lint, typecheck, serialized tests, `npm run build`, `docker compose config`, `terraform fmt -check`, `terraform validate`, build-context sentinel probe, and Playwright E2E.
    - **E2E Discipline in CI**: On trusted branch runs where secrets are expected, the absence of Clerk credentials must **explicitly fail** the workflow rather than silently skipping tests and yielding a false green pipeline. Live calls to OpenRouter are strictly forbidden; tests interact exclusively with the deterministic local mock on port 3002.
  - **CD Workflow (`.github/workflows/deploy.yml`)**:
    - Authenticates to AWS via GitHub OIDC (`aws-actions/configure-aws-credentials`).
    - Builds production containers tagged with immutable commit SHA (`${{ github.sha }}`) and passes `NEXT_PUBLIC_*` build arguments.
    - Pushes images to AWS ECR.
    - Executes `npx prisma migrate deploy` via direct port 5432 connection.
    - Runs `terraform init` with partial backend configuration flags and `terraform apply -auto-approve` with ephemeral secret variables.
    - Waits for ECS service deployment rollout and target group readiness with bounded retries.
    - Executes automated smoke tests against the live HTTPS endpoint (`GET https://${DOMAIN}/` → 200, `GET https://${DOMAIN}/api/v1/health` → 200, `GET https://${DOMAIN}/api/v1/automations` without token → 401).

## Risks / Trade-offs

- **[Risk] Docker build context secret leak**: An improperly configured `.dockerignore` could allow developer `.env` files into public/private images.
  → *Mitigation*: Root `.dockerignore` excludes `.env*`, `.git`, `playwright/.auth`. CI executes a two-level verification: (A) build-context sentinel probe, and (B) final image inspection.
- **[Risk] Terraform state secret exposure**: Secrets passed into Terraform could be committed into remote state files.
  → *Mitigation*: Terraform CLI >= 1.11 ephemeral variables combined with AWS provider `value_wo` prevent secrets from ever being recorded in `terraform.tfstate`. Validated via synthetic canary secret probe (`FLOWPULSE_TERRAFORM_SECRET_CANARY_DO_NOT_PERSIST`) reporting PASS/FAIL.
- **[Risk] AWS Fargate and ALB hourly charges**: Cloud resources incur costs while running.
  → *Mitigation*: Parameterized `desired_count` allows running in cost-optimized single-instance mode (`desired_count = 1`), NAT Gateway is omitted in favor of public subnets with strict security groups, and `terraform destroy` is documented for immediate teardown post-evaluation.
- **[Risk] Migration failure on transaction poolers**: Running `prisma migrate deploy` against a connection pooler port (6543) fails due to lack of advisory locking support.
  → *Mitigation*: Deployment pipeline explicitly enforces direct session connection string (port 5432) for the migration step.
- **[Risk] False-positive green CI on missing E2E secrets**: Silently skipping Playwright tests when secrets are missing masks regressions.
  → *Mitigation*: CI pipeline checks required Clerk secrets in trusted branches and aborts with an explicit failure if missing.

## Migration Plan

1. **Bootstrap Phase**: Run `infra/terraform/bootstrap` using temporary local state to create the S3 state bucket with versioning, AES256 encryption, and public access blocks. State is never committed to Git.
2. **DNS & Certificate Setup**: Provide `acm_certificate_arn` (or configure domain and Route 53 hosted zone for automatic ACM certificate issuance and DNS validation).
3. **Infrastructure Provisioning**: Run `terraform init` with `-backend-config` pointing to the bootstrap bucket, then `terraform apply` in `infra/terraform/environments/production` passing ephemeral secrets and initial `desired_count`.
4. **CI/CD Integration**: Configure GitHub Actions OIDC role ARN and repository secrets.
5. **Continuous Deployment**: On merge to `main`, `deploy.yml` builds containers with commit SHA tag, runs direct database migrations, applies Terraform via partial backend config, and verifies HTTPS endpoints via automated smoke tests.
6. **Teardown**: Execute `terraform destroy` in `infra/terraform/environments/production` to deprovision cloud resources when academic evaluation is complete.

## Open Questions

None. Partial backend S3 configuration, native S3 locking without DynamoDB, bounded AWS provider constraint (`>= 5.86.0, < 6.0.0`), synthetic secret canary testing, and HTTPS load balancing are fully specified.
