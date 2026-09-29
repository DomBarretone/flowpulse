# frontend-scaffold Specification

## Purpose

Defines the observable structure and constraints of the Next.js frontend application — routing, styling baseline, and architectural boundaries — that ensure it is functional and correctly isolated from the database layer.

## Requirements

### Requirement: Next.js App Router root route
`apps/web` SHALL expose a root route (`/`) that renders a minimal homepage. The page SHALL be accessible without authentication in this change and SHALL confirm visually that the application is running.

#### Scenario: Root route returns 200
- **WHEN** a browser navigates to `http://localhost:3000/`
- **THEN** the server responds with HTTP `200 OK` and renders an HTML page

#### Scenario: Homepage confirms application is running
- **WHEN** the homepage is rendered
- **THEN** the page displays the product name "FlowPulse" and a status message (e.g., "Application is running") visible in the page body

### Requirement: No direct database access from frontend
`apps/web` SHALL NOT import or instantiate `@prisma/client`, connect to PostgreSQL, or call any Supabase Data API. All data operations SHALL be mediated exclusively by `apps/api` via REST under `/api/v1`.

#### Scenario: Prisma client is absent from web bundle
- **WHEN** the frontend build (`next build`) completes
- **THEN** `@prisma/client` does not appear in the frontend bundle or `apps/web/package.json` dependencies

### Requirement: Tailwind CSS configured
`apps/web` SHALL have Tailwind CSS installed and configured. The root layout SHALL include the Tailwind base styles. Tailwind utility classes SHALL be usable in any page or component without additional setup.

#### Scenario: Tailwind styles apply
- **WHEN** a Tailwind utility class (e.g., `bg-gray-900`) is added to the homepage
- **THEN** the class is applied visually without errors or missing stylesheet warnings

### Requirement: TypeScript strict mode in frontend
`apps/web` SHALL operate in TypeScript strict mode as inherited from the root `tsconfig.base.json`. The `next build` command SHALL fail if there are TypeScript type errors.

#### Scenario: Type errors cause build failure
- **WHEN** a TypeScript type error is introduced in any `apps/web` source file
- **THEN** `next build` exits with a non-zero code and reports the type error

### Requirement: Absence of Clerk dependency and configuration
`apps/web` SHALL NOT include `@clerk/nextjs` or any Clerk provider/middleware configuration in this change. All Clerk installation, authentication configuration, and provider setup belong exclusively to change `02-auth-rbac`.

#### Scenario: Clerk is absent from frontend dependencies
- **WHEN** `apps/web/package.json` and application source files are inspected
- **THEN** `@clerk/nextjs` is absent from dependencies and no Clerk providers or middleware are configured
