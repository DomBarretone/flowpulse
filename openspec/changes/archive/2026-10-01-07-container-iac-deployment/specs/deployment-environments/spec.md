# Spec Delta: deployment-environments

## Purpose

Defines requirements for strictly isolated development and production environments, runtime secret injection, public build-time configuration, and direct database migration connectivity.

## ADDED Requirements

### Requirement: Environment Isolation and Configuration Separation
The system SHALL maintain strict operational separation between Development and Production environments. Development SHALL execute locally using Docker Compose, local PostgreSQL, and `.env` configuration. Production SHALL execute on AWS ECS Fargate, connecting to remote managed Supabase PostgreSQL, using externalized runtime configuration without shared state.

#### Scenario: Development environment loads local configuration
- **WHEN** the local development stack starts via Docker Compose
- **THEN** it resolves environment variables from local `.env` and connects the API service to the local `postgres` container

#### Scenario: Production environment targets managed cloud services
- **WHEN** the production stack is evaluated under Terraform
- **THEN** it targets AWS managed Fargate compute, connects to the remote Supabase PostgreSQL instance via connection string parameter, and isolates traffic within a dedicated production VPC

### Requirement: Runtime Secret Injection vs Public Build-Time Config
All sensitive credentials—including `DATABASE_URL`, `CLERK_SECRET_KEY`, and `OPENROUTER_API_KEY`—SHALL be provided exclusively at runtime through AWS Systems Manager (SSM) Parameter Store SecureStrings. Sensitive runtime credentials SHALL NOT be passed via Docker `ARG` or stored in container images. Public frontend configuration (`NEXT_PUBLIC_*`) SHALL be supplied as build arguments and inlined during frontend compilation.

#### Scenario: Production task definitions reference external runtime secrets
- **WHEN** the ECS task definition is rendered by Terraform
- **THEN** sensitive environment variables specify `valueFrom` referencing SSM parameter ARNs rather than plaintext values

#### Scenario: Frontend image inlines public configuration without runtime secrets
- **WHEN** the frontend container is built for production
- **THEN** `NEXT_PUBLIC_*` variables are embedded into the client bundle and zero private secrets exist in the image

### Requirement: Direct PostgreSQL Connection for Database Migrations
The production deployment configuration SHALL utilize a direct PostgreSQL session connection (port 5432) for `prisma migrate deploy` rather than a transaction-mode connection pooler (port 6543). The connection SHALL enforce TLS encryption.

#### Scenario: Production migration URL targets direct port 5432
- **WHEN** `prisma migrate deploy` executes in the deployment pipeline
- **THEN** the connection string targets port 5432 supporting DDL locks and schema transactions
