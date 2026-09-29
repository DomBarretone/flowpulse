# Spec Delta

## Purpose

Enforces structured JSON logging across the FlowPulse backend, guaranteeing uniform log formats, trace correlation, and strict automated sanitization of sensitive credentials and tokens.

## ADDED Requirements

### Requirement: JSON Structured Log Format
The backend application SHALL emit all operational, administrative, and diagnostic log records in single-line JSON format during standard execution, containing a mandatory set of standardized fields.

#### Scenario: Mandatory log fields present
- **WHEN** any log message is emitted by the application logger
- **THEN** the output line is valid JSON containing `timestamp` (ISO 8601), `level` (`info`, `warn`, `error`, or `debug`), `service`, `environment`, `event_name`, `request_id`, and `trace_id`

#### Scenario: Fallback identifiers when outside HTTP context
- **WHEN** a log message is emitted outside an active HTTP request or span context
- **THEN** `request_id` and `trace_id` default to deterministic empty or `"none"` representations rather than causing formatting failures

### Requirement: HTTP Request Lifecycle Logging
The backend SHALL emit a structured log record upon completion of every HTTP request, capturing non-sensitive contextual metadata.

#### Scenario: Request completion log event
- **WHEN** an HTTP request completes execution
- **THEN** a structured log is emitted with `event_name: "http_request_completed"` including `method`, `path`, `status_code`, and `duration_ms`

### Requirement: Sensitive Data Redaction in Logs
The logging subsystem SHALL sanitize all logged payloads and messages, redacting Authorization headers, Bearer tokens, Clerk JWTs, OpenRouter API keys, FlowPulse API keys (`fp_live_...`), passwords, and credentials with `[REDACTED]`.

#### Scenario: Log message containing API key or token
- **WHEN** a log message or error context contains a string matching an API key pattern (`fp_live_...`) or Bearer token
- **THEN** the emitted JSON log replaces the sensitive token with `[REDACTED]` and does not contain the plaintext secret

#### Scenario: Header logging excludes sensitive values
- **WHEN** request headers are inspected or logged
- **THEN** headers matching `authorization`, `x-api-key`, `cookie`, or `set-cookie` are excluded or masked

### Requirement: Non-Regression of External Exception Logging
The backend SHALL NOT interpolate unhandled raw exception messages from external providers directly into log strings when communicating with third-party APIs such as OpenRouter.

#### Scenario: External API failure logging
- **WHEN** a third-party service call to OpenRouter fails with an HTTP error or network timeout
- **THEN** the logger records a structured error event with sanitized context without interpolating raw external exception payload messages into the log text
