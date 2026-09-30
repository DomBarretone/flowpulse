# Tasks: 07-container-iac-deployment

## 1. Docker Build Context Security

- [x] 1.1 Create root `.dockerignore` excluding `.env`, `.env.*` (negating `!.env.example`), `.git`, `node_modules`, `playwright/.auth`, `coverage`, `dist`, and `.next`, and verify rules via pattern check
- [x] 1.2 Implement a two-level build context verification probe (A: build-context sentinel probe asserting local sentinel canary files are not copied into container filesystem; B: final-image inspection asserting `.env`, `playwright/.auth`, and source secrets are absent from production images without logging secret values)

## 2. Production Multi-Stage Containerization

- [x] 2.1 Configure `output: 'standalone'` in `apps/web/next.config.ts` and verify standalone output generation via `npm run build -w apps/web`
- [x] 2.2 Create multi-stage production `apps/api/Dockerfile` with non-root user `node`, Prisma client generation, and Node.js native fetch healthcheck, and verify with `docker build -f apps/api/Dockerfile -t flowpulse-api:test .`
- [x] 2.3 Create multi-stage production `apps/web/Dockerfile` with `NEXT_PUBLIC_*` build arguments, Next.js standalone runner, non-root user `node`, and Node.js native fetch healthcheck, and verify with `docker build -f apps/web/Dockerfile -t flowpulse-web:test .`
- [x] 2.4 Verify user `node` execution (UID non-zero) and absence of runtime secrets in both images via `docker inspect`

## 3. Docker Compose & Local Environment Validation

- [x] 3.1 Create `docker-compose.prod.yml` orchestrating production images, health dependencies, and isolated network, and verify via `docker compose -f docker-compose.prod.yml config`
- [x] 3.2 Verify existing development `docker-compose.yml` configuration remains valid via `docker compose config`

## 4. Terraform Infrastructure as Code

- [x] 4.1 Create `infra/terraform/bootstrap/` defining remote state S3 bucket (versioning, AES256 encryption, public access block) using temporary local state (gitignored, zero DynamoDB), and verify syntax via `terraform fmt -check`
- [x] 4.2 Create `infra/terraform/modules/networking/` defining VPC, public subnets across 2 AZs, Internet Gateway, and security groups without NAT Gateway, and verify syntax
- [x] 4.3 Create `infra/terraform/modules/ecr/` defining repositories for `flowpulse-api` and `flowpulse-web` with lifecycle policies, and verify syntax
- [x] 4.4 Create `infra/terraform/modules/alb/` defining Application Load Balancer with port 443 HTTPS listener (ACM certificate), port 80 HTTP permanent redirect to HTTPS, target groups for API and Web, and path routing, and verify syntax
- [x] 4.5 Create `infra/terraform/modules/secrets/` declaring write-only SSM parameters (`value_wo`, `value_wo_version`) for `database_url`, `clerk_secret_key`, and `openrouter_api_key`, and verify syntax
- [x] 4.6 Create `infra/terraform/modules/ecs/` defining ECS cluster, Fargate task definitions with configurable `desired_count` variable (default 2), IAM execution/task roles with SSM access, and CloudWatch log groups, and verify syntax
- [x] 4.7 Create `infra/terraform/environments/production/` declaring root module with partial S3 backend (`backend "s3" {}`), provider constraint `version = ">= 5.86.0, < 6.0.0"`, typed variables (with `sensitive = true` and `ephemeral = true` for secrets), outputs, and `terraform.tfvars.example`
- [x] 4.8 Format and validate all Terraform code using `terraform fmt -check -recursive infra/terraform` and `terraform -chdir=infra/terraform/environments/production validate`
- [x] 4.9 Implement a synthetic secret canary test probe using `FLOWPULSE_TERRAFORM_SECRET_CANARY_DO_NOT_PERSIST` proving that the canary string does not appear in plan JSON or state pull outputs, logging strictly PASS/FAIL without exposing real credentials

## 5. Continuous Integration (CI) Workflow

- [x] 5.1 Implement `.github/workflows/ci.yml` executing lint, typecheck, unit and integration tests (with PostgreSQL service container), and application builds on pull requests
- [x] 5.2 Add Terraform format/validation checks and Docker Compose config validation to `.github/workflows/ci.yml`
- [x] 5.3 Add Docker build-context sentinel probe and final-image inspection to `.github/workflows/ci.yml`
- [x] 5.4 Add Playwright E2E tests to `.github/workflows/ci.yml` enforcing explicit failure on missing Clerk secrets in trusted branch runs, while strictly utilizing the deterministic local OpenRouter mock on port 3002

## 6. Continuous Deployment (CD) Workflow

- [x] 6.1 Implement `.github/workflows/deploy.yml` with AWS OIDC authentication (`aws-actions/configure-aws-credentials`) and pre-deploy validation gate
- [x] 6.2 Add Docker container build (passing `NEXT_PUBLIC_*` build args) and push to AWS ECR tagged with immutable Git commit SHA (`${{ github.sha }}`) in `.github/workflows/deploy.yml`
- [x] 6.3 Implement a database connection check asserting direct port 5432 session mode connectivity (not transaction pooler port 6543) and execute single-runner `npx prisma migrate deploy` in `.github/workflows/deploy.yml`
- [x] 6.4 Add Terraform initialization with partial backend arguments (`-backend-config`) and apply step updating ECS task definitions with the new commit SHA image using ephemeral secret inputs in `.github/workflows/deploy.yml`
- [x] 6.5 Add ECS service deployment wait and target group health monitoring in `.github/workflows/deploy.yml`

## 7. Post-Deployment Verification & Smoke Tests

- [x] 7.1 Implement an automated HTTPS smoke test script verifying `GET https://${DOMAIN}/` (200), `GET https://${DOMAIN}/api/v1/health` (200), and `GET https://${DOMAIN}/api/v1/automations` without token (401)
- [x] 7.2 Integrate HTTPS smoke test execution with bounded retries into `.github/workflows/deploy.yml` and verify pipeline failure behavior

## 8. Governance, Documentation & Final Quality Gates

- [x] 8.1 Ensure `.gitignore` ignores `*.tfstate`, `*.tfstate.*`, `.terraform/`, and local secret files while preserving `.terraform.lock.hcl` and examples
- [x] 8.2 Update `README.md` and `docs/architecture.md` with containerization, Terraform setup (including partial S3 backend, S3 native locking, `value_wo` secrets, `desired_count` HA vs cost, and `terraform destroy` teardown), and CI/CD operations documentation
- [x] 8.3 Execute full quality gates suite (`npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`, `docker compose config`, `terraform fmt -check`, `terraform validate`, `openspec validate 07-container-iac-deployment --strict`)
