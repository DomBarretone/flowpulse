# operational-audit Specification

## Purpose
Establishes full operational traceability and auditability for critical actions and state transitions across the platform without introducing unnecessary schema migrations.

## Requirements

### Requirement: Immutable Incident Lifecycle Audit Trail
The platform SHALL record every critical transition in the lifecycle of an incident in the relational `IncidentEvent` table, capturing the actor user ID, previous status, next status, event type, timestamp, and optional explanatory notes.

#### Scenario: Incident acknowledgment audited
- **WHEN** an operator acknowledges an open incident
- **THEN** an `IncidentEvent` record of type `ACKNOWLEDGED` is atomically created linking `incident_id`, `actor_user_id`, `from_status: OPEN`, and `to_status: ACKNOWLEDGED`

#### Scenario: AI analysis request and completion audited
- **WHEN** an operator requests AI analysis for an incident in `INVESTIGATING` status
- **THEN** an `IncidentEvent` of type `AI_ANALYSIS_REQUESTED` is created prior to external invocation, and upon successful receipt an `IncidentEvent` of type `AI_ANALYSIS_COMPLETED` is persisted

#### Scenario: Incident resolution audited with mandatory notes
- **WHEN** an incident is resolved with resolution notes
- **THEN** an `IncidentEvent` of type `RESOLVED` is atomically persisted containing the operator's resolution note and `to_status: RESOLVED`

### Requirement: Administrative Action Audit Logging
The platform SHALL emit structured audit log events for all administrative actions occurring outside the incident lifecycle, including automation creation, API key generation, API key revocation, automation activation, and execution ingestion.

#### Scenario: Automation creation audited
- **WHEN** an administrator creates a new automation
- **THEN** a structured log is emitted with `event_name: "automation_created"` containing the created automation ID, owner ID, criticality, and request correlation IDs

#### Scenario: API key generation audited
- **WHEN** an administrator generates a new integration API key for an automation
- **THEN** a structured log is emitted with `event_name: "api_key_generated"` containing `automation_id`, key `prefix`, and key ID, without logging the plaintext secret

#### Scenario: API key revocation audited
- **WHEN** an administrator revokes an integration API key
- **THEN** a structured log is emitted with `event_name: "api_key_revoked"` containing `automation_id` and the revoked key ID

#### Scenario: Automation activation audited
- **WHEN** an administrator activates an automation whose integration was validated
- **THEN** a structured log is emitted with `event_name: "automation_activated"` containing `automation_id` and previous status

### Requirement: Zero Database Migrations for Audit
The operational audit requirements SHALL be completely fulfilled by combining the existing `IncidentEvent` entity with structured audit logging, requiring no schema migrations or new database tables.

#### Scenario: Schema stability verification
- **WHEN** the database schema is verified against the audit requirements
- **THEN** Prisma schema definitions remain unchanged and `prisma migrate dev` reports no pending migrations
