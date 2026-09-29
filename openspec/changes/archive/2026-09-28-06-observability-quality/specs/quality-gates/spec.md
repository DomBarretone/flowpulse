# Spec Delta

## Purpose

Enforces strict local quality gates and unified verification pipelines ensuring all static analysis, unit tests, integration tests, E2E tests, builds, and configuration checks pass before deployment readiness.

## ADDED Requirements

### Requirement: Canonical Quality Gates Execution
The repository SHALL validate code quality and system integrity through a canonical series of quality gate commands that must all exit with return code 0 on a clean workspace.

#### Scenario: All quality gates pass
- **WHEN** a developer or automation pipeline executes the quality gate suite:
  ```bash
  npm run db:generate && npm run db:migrate && npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build && docker compose config
  ```
- **THEN** every command completes successfully with exit code 0 and no unhandled errors

### Requirement: Serialized Test Execution for Database Stability
API unit and integration test runs SHALL execute with `--runInBand` in Jest configuration to prevent parallel database port and connection conflicts.

#### Scenario: Running API test suite serially
- **WHEN** `npm run test` executes inside `apps/api`
- **THEN** Jest runs test suites serially (`--runInBand`), avoiding concurrent socket exhaustion and guaranteeing deterministic execution of transactional integration tests

### Requirement: Zero Secret Exposure in Test and Build Outputs
All quality gate runs, test outputs, and build logs SHALL omit sensitive environment variables, secrets, and raw tokens.

#### Scenario: Quality gate logs inspection
- **WHEN** test and build commands execute during quality gate evaluation
- **THEN** console output and generated log artifacts contain no plaintext API keys, Clerk secret keys, or database credentials
