# Spec Delta

## Purpose

Defines comprehensive Playwright end-to-end testing for FlowPulse's core business workflows, verifying full frontend-backend integration, deterministic AI boundary simulation, and secure authenticated user journeys.

## ADDED Requirements

### Requirement: Playwright E2E Test Execution Infrastructure
The project SHALL provide an automated Playwright testing framework under `tests/e2e/` executable via canonical root script `npm run test:e2e`, orchestrating web and API servers automatically without manual terminal intervention.

#### Scenario: Running test:e2e executes test suite
- **WHEN** a developer or CI pipeline executes `npm run test:e2e`
- **THEN** Playwright ensures backend API and frontend web servers are available via webServer configuration and executes all E2E specifications to completion

#### Scenario: Diagnostic artifacts captured on failure
- **WHEN** an E2E test assertion fails
- **THEN** Playwright captures screenshots, retains video recordings, and generates trace archives for the failed test without checking them into version control

### Requirement: Deterministic OpenRouter Test Double
In E2E testing environments, the backend SHALL communicate with a deterministic HTTP mock double for OpenRouter chat completions, verifying the complete stack without incurring external API credits or token usage.

#### Scenario: AI analysis request in E2E environment
- **WHEN** an operator requests AI analysis during an E2E test run
- **THEN** the backend issues an HTTP request to the mock endpoint specified by `OPENROUTER_BASE_URL`, receives a schema-compliant mock response, persists the analysis, and delivers structured diagnostic cards to the UI

#### Scenario: Production and development environments remain unmocked
- **WHEN** the application runs in development or production mode
- **THEN** `OPENROUTER_BASE_URL` points to the real OpenRouter API endpoint and no test doubles or fake mocks are activated

### Requirement: Secure Clerk E2E Authentication
The E2E test suite SHALL authenticate test users through official Clerk testing patterns or environment-driven test credentials without hardcoding secrets, passwords, or personal credentials in test files or repository code.

#### Scenario: Authenticated test session initialization
- **WHEN** the E2E test suite initializes test browser contexts
- **THEN** authentication is established using credentials configured via environment variables (`E2E_CLERK_USER_EMAIL`, `E2E_CLERK_USER_PASSWORD`) and cached via storage state, preventing credential leakage in logs or code

### Requirement: E2E Business Flow 1 — Automation Onboarding and Activation
The E2E test suite SHALL execute Business Flow 1 through the browser and API, validating the complete sequence from creation through key generation and test execution to active monitoring status.

#### Scenario: Flow 1 end-to-end execution
- **WHEN** an authenticated administrator completes Flow 1
- **THEN** the test navigates to `/automations/new`, creates an automation with `criticality: HIGH`, generates an API credential validating that the secret is displayed once, invokes `POST /api/v1/executions` with `is_test: true` and the generated key in memory, confirms the UI updates to show `VALIDATED` integration status, activates the automation, and verifies the UI displays `ACTIVE` status

### Requirement: E2E Business Flow 2 — Incident Lifecycle and Consultative AI Analysis
The E2E test suite SHALL execute Business Flow 2 through the browser and API, validating incident creation, assignment, investigation, consultative AI analysis, and resolution.

#### Scenario: Flow 2 end-to-end execution
- **WHEN** a productive failed execution is sent to an active automation
- **THEN** an incident in `OPEN` status is automatically generated, the operator locates the incident in `/incidents`, assumes ownership transitioning to `ACKNOWLEDGED`, starts investigation transitioning to `INVESTIGATING`, requests AI analysis receiving a structured diagnostic card with a prominent consultative disclaimer, resolves the incident providing required resolution notes, and verifies the `RESOLVED` status along with complete audit timeline events
