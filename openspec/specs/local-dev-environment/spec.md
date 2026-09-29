# local-dev-environment Specification

## Purpose

Defines the observable contract for the local development environment tooling — Docker Compose configuration and environment validation script — so that any developer can start the full stack locally with a single command.

## Requirements

### Requirement: Docker Compose for local development
A `docker-compose.yml` at the repository root SHALL define services for `web`, `api`, and `postgres`, loading configuration from `.env`. Both `web` and `api` SHALL support hot-reload during development via volume mounts. The `postgres` service SHALL run a PostgreSQL container with persistent volume storage and healthchecks for local development. The backend application (`apps/api`) SHALL use `DATABASE_URL` to switch between local PostgreSQL in development and Supabase PostgreSQL in remote environments. `apps/web` SHALL NOT have direct access or connection to `postgres`.

#### Scenario: Docker Compose configuration is valid
- **WHEN** `docker compose config` is executed at the repository root
- **THEN** the command exits with code `0` and reports valid configurations for `web`, `api`, and `postgres` services

#### Scenario: Services declare environment variable injection
- **WHEN** the Docker Compose file is inspected
- **THEN** `web` and `api` services reference environment variables from `.env` for all secrets and connection strings, with `DATABASE_URL` supplied to `api`

#### Scenario: Frontend does not connect directly to database
- **WHEN** the `web` container service definition is inspected
- **THEN** `web` contains no database connection variables and no direct network dependency on `postgres`

### Requirement: Environment validation script
A script at `scripts/check-environment.sh` SHALL validate the presence of all required environment variables and, where applicable, verify connectivity to the database. The script SHALL print a clear error message for each missing variable and exit with a non-zero code if validation fails.

#### Scenario: Script passes with valid environment
- **WHEN** all required environment variables are set and `check-environment.sh` is executed
- **THEN** the script exits with code `0` and prints a success message

#### Scenario: Script fails with a missing variable
- **WHEN** a required environment variable is unset and `check-environment.sh` is executed
- **THEN** the script exits with a non-zero code and names the missing variable in its output

### Requirement: No secrets in tracked files
No API keys, database passwords, JWT secrets, or other credentials SHALL appear in any file tracked by Git. All secrets SHALL be stored exclusively in `.env` (which is gitignored).

#### Scenario: .env.example contains no real secrets
- **WHEN** `.env.example` is reviewed
- **THEN** every sensitive field contains a placeholder value (e.g., `your-database-url-here`) with no real credentials
