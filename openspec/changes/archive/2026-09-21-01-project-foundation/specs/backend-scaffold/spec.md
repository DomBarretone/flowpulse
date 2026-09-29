# Spec Delta

## Purpose

Defines the observable interface of the NestJS backend application — global prefix, health endpoint, validation behavior, and request correlation — that every future API module extends.

## ADDED Requirements

### Requirement: Global API prefix /api/v1
All HTTP endpoints exposed by `apps/api` SHALL be accessible under the prefix `/api/v1`. No endpoint SHALL respond without this prefix (except framework-level internals).

#### Scenario: Health endpoint is reachable under prefix
- **WHEN** a client sends `GET /api/v1/health`
- **THEN** the server responds with HTTP `200 OK` and a JSON body confirming the service is alive

### Requirement: Health endpoint response contract
The `GET /api/v1/health` endpoint SHALL return a JSON response conforming to:

```json
{
  "status": "ok",
  "timestamp": "<ISO 8601 datetime>"
}
```

No authentication SHALL be required to call this endpoint.

#### Scenario: Health response is valid JSON
- **WHEN** `GET /api/v1/health` is called without any authentication header
- **THEN** the response body is valid JSON containing `status: "ok"` and a `timestamp` field in ISO 8601 format

#### Scenario: Health endpoint returns 200 even when unauthenticated
- **WHEN** `GET /api/v1/health` is called with no `Authorization` header
- **THEN** the server responds with HTTP status `200` (not `401`)

### Requirement: Global ValidationPipe
The backend SHALL apply a global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Any request body containing fields not declared in the DTO SHALL be rejected with `422 Unprocessable Entity`.

#### Scenario: Extra fields are rejected
- **WHEN** a request is sent to any endpoint with an unexpected field in the body
- **THEN** the API responds with `422 Unprocessable Entity` and a descriptive error message

### Requirement: Request ID propagation
Every request processed by the backend SHALL have a unique `request_id` (UUID v4) injected globally. The `request_id` SHALL be included in all error responses.

#### Scenario: Request ID present in error responses
- **WHEN** a request triggers a validation error (422)
- **THEN** the response body contains a `request_id` field with a non-empty UUID string

### Requirement: RFC 7807 error format
All error responses from `apps/api` SHALL conform to the RFC 7807 Problem Details format, containing at minimum `type`, `title`, `status`, `detail`, `instance`, and `request_id`.

#### Scenario: Validation error follows RFC 7807
- **WHEN** `ValidationPipe` rejects an invalid payload
- **THEN** the response body contains `type`, `title`, `status`, `detail`, `instance`, and `request_id` fields

### Requirement: Swagger/OpenAPI documentation endpoint
The backend SHALL serve an OpenAPI/Swagger UI at `/api/docs` (or equivalent), generated from decorator metadata. No authentication SHALL be required to access the documentation in development mode.

#### Scenario: Swagger UI is accessible
- **WHEN** a developer navigates to the Swagger endpoint in a running development server
- **THEN** the Swagger UI loads and lists all registered endpoints

### Requirement: Prisma ORM connection
`apps/api` SHALL connect to a PostgreSQL database via Prisma ORM. The database connection string SHALL be read exclusively from the `DATABASE_URL` environment variable, supporting local PostgreSQL (via Docker Compose in development) and Supabase PostgreSQL in remote environments. The application SHALL fail to start with a descriptive error if `DATABASE_URL` is absent or invalid.

#### Scenario: PrismaService is injectable as NestJS module
- **WHEN** `apps/api` starts with a valid `DATABASE_URL`
- **THEN** `PrismaService` is available for injection across all NestJS modules without additional configuration

### Requirement: Minimum Prisma schema — User model only
The Prisma schema for this change SHALL contain exactly one model: `User` (table `users`), generic and agnostic to authentication providers, with the following fields:
- `id` UUID primary key (default `uuid()`)
- `email` String unique
- `name` String
- `role` Enum `ADMIN | ANALYST`
- `created_at` DateTime (default `now()`)
- `updated_at` DateTime (`updatedAt`)

No provider-specific fields (such as `clerk_user_id`) or other models SHALL be added in this change. External authentication integration fields belong exclusively to change `02-auth-rbac`.

#### Scenario: Prisma Client generates without errors
- **WHEN** `npm run db:generate` is executed with a valid `DATABASE_URL`
- **THEN** Prisma Client generates successfully with the `User` model available

#### Scenario: First migration applies cleanly
- **WHEN** `npm run db:migrate` is executed against the local PostgreSQL container or remote Supabase instance
- **THEN** the migration completes without errors and the `users` table is created with all specified columns
