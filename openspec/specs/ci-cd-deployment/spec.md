# ci-cd-deployment Specification

## Purpose
Defines requirements for automated continuous integration on pull requests, continuous deployment on main merges, immutable container image publishing, and OIDC cloud authentication.

## Requirements

### Requirement: Pull Request Continuous Integration Workflow
The repository SHALL define a GitHub Actions workflow (`.github/workflows/ci.yml`) triggered on pull requests targeting `main`. The workflow SHALL execute quality gates: dependency installation, Prisma Client generation, static linting, typechecking, serialized unit/integration tests with a PostgreSQL service container, frontend and backend compilation, Docker Compose syntax verification, Terraform format and validation checks, and Docker build-context sentinel probe verification. Playwright E2E tests SHALL execute in the workflow with strict failure handling.

#### Scenario: Pull request workflow validates all quality gates
- **WHEN** a pull request is opened or updated
- **THEN** `.github/workflows/ci.yml` runs all verification jobs and requires exit code 0 on all steps before granting green status

#### Scenario: Trusted branch E2E fails explicitly if secrets are missing
- **WHEN** Playwright E2E tests execute on a trusted branch or internal PR where credentials are expected and Clerk secrets are missing
- **THEN** the workflow fails explicitly with an actionable error rather than skipping tests with a false-positive success

#### Scenario: Automated E2E testing utilizes deterministic mock
- **WHEN** Playwright E2E tests execute in the CI pipeline
- **THEN** the tests interact with the local deterministic mock server on port 3002 without making live calls to external OpenRouter endpoints

### Requirement: Continuous Deployment Pipeline on Main
The repository SHALL define a continuous deployment workflow (`.github/workflows/deploy.yml`) triggered exclusively on pushes to the `main` branch. The deployment pipeline SHALL first execute all validation quality gates and halt immediately if any check fails.

#### Scenario: Pipeline halts deployment when validation fails
- **WHEN** a test, typecheck, or build failure occurs during the pre-deploy validation stage
- **THEN** the workflow terminates immediately with a failure status and does not push images or apply Terraform changes

#### Scenario: Pipeline executes deployment steps upon successful validation
- **WHEN** all validation gates pass on a merge to `main`
- **THEN** the workflow proceeds to container image publishing, infrastructure synchronization, and service rollout

### Requirement: Immutable Image Tagging and Registry Publishing
Container images built during the CD workflow SHALL be tagged with an immutable tag matching the Git commit SHA (`${{ github.sha }}`) and published to AWS ECR. Frontend image builds SHALL receive public `NEXT_PUBLIC_*` arguments. ECS task definitions SHALL reference this specific immutable tag or image digest.

#### Scenario: CD workflow tags and publishes images with commit SHA
- **WHEN** Docker images are built and pushed to AWS ECR during the deploy workflow
- **THEN** both `api` and `web` images are published with tag `${{ github.sha }}` and logged with their unique digest

#### Scenario: Deployment references the immutable commit SHA tag
- **WHEN** Terraform or AWS CLI updates the ECS task definition during rollout
- **THEN** the container image URI specified in the task definition contains the commit SHA tag

### Requirement: Secure OIDC Cloud Authentication
The GitHub Actions deployment workflow SHALL authenticate to AWS using OpenID Connect (OIDC) federation via `aws-actions/configure-aws-credentials` and a pre-configured IAM role. The workflow SHALL NOT use static, long-lived AWS Access Key ID and Secret Access Key pairs stored in repository secrets.

#### Scenario: Workflow exchanges OIDC token for temporary AWS credentials
- **WHEN** the deployment workflow executes AWS interactions
- **THEN** it requests a short-lived GitHub OIDC token, assumes the target IAM role, and receives temporary STS credentials with session expiration
