# Spec Delta: deployment-verification

## Purpose

Defines requirements for controlled pre-release database migration execution, container readiness verification, and automated post-deployment HTTPS smoke tests.

## ADDED Requirements

### Requirement: Controlled Pre-Release Direct Migration Execution
Database migrations SHALL be executed in a dedicated, serialized pre-release step via `prisma migrate deploy` connecting directly to PostgreSQL port 5432 prior to routing traffic to updated container tasks. The migration step SHALL execute as an isolated single-runner job to prevent concurrent migration collisions. If the migration command exits with a non-zero code, the deployment pipeline SHALL abort immediately without updating ECS service tasks.

#### Scenario: Migration runs once before service rollout via direct connection
- **WHEN** the continuous deployment pipeline reaches the database update phase
- **THEN** `prisma migrate deploy` executes within a single job against the direct port 5432 target database and exits with code 0 before ECS task definitions are updated

#### Scenario: Migration failure halts deployment
- **WHEN** `prisma migrate deploy` encounters an error or timeout
- **THEN** the deployment workflow terminates with an error and existing healthy ECS tasks remain untouched

### Requirement: Deployment Readiness Wait and Health Verification
Following task definition registration and ECS service update, the deployment workflow SHALL monitor deployment stability and poll target group health. The pipeline SHALL utilize bounded polling retries with backoff, requiring all registered targets to report healthy before proceeding to smoke testing.

#### Scenario: Service rollout awaits target group healthy status
- **WHEN** ECS initiates rolling replacement of container tasks
- **THEN** the deployment step polls target group health status until new tasks pass health checks and report healthy

#### Scenario: Rollout failure on health check timeout
- **WHEN** newly deployed container tasks fail to reach healthy status within the configured timeout window
- **THEN** the wait step exits with a non-zero failure code and marks the deployment action as failed

### Requirement: Post-Deployment HTTPS Smoke Tests Execution
Immediately following verified service readiness, the deployment workflow SHALL execute automated smoke tests against the live HTTPS endpoints. The smoke tests SHALL verify: (1) `GET https://${DOMAIN}/` returns HTTP status 200 indicating the Next.js frontend is serving pages, (2) `GET https://${DOMAIN}/api/v1/health` returns HTTP status 200 and valid JSON status confirming backend liveness, and (3) a protected API endpoint (such as `GET https://${DOMAIN}/api/v1/automations`) without an `Authorization` header returns HTTP status 401 confirming Clerk JWT authentication enforcement.

#### Scenario: Smoke tests pass on fully operational HTTPS deployment
- **WHEN** automated smoke tests execute against the deployed Application Load Balancer HTTPS URL
- **THEN** all three checks (`GET /` → 200, `GET /api/v1/health` → 200, protected endpoint without token → 401) pass over HTTPS within timeout limits and the workflow concludes successfully

#### Scenario: Smoke tests detect endpoint failure
- **WHEN** any smoke test probe returns an unexpected status code (such as 500, 502, or 503) or times out
- **THEN** the smoke test step exits with code 1 and reports the failing endpoint and received status code
