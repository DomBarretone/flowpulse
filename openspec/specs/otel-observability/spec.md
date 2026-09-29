# otel-observability Specification

## Purpose
Provides automated distributed tracing and context propagation for FlowPulse backend services using OpenTelemetry, enabling end-to-end request visibility, trace correlation, and resilient telemetry export.

## Requirements

### Requirement: OpenTelemetry SDK Bootstrap
The NestJS backend application SHALL initialize the OpenTelemetry NodeSDK prior to evaluating or instantiating application modules, instrumenting inbound HTTP traffic, outbound HTTP requests, external API calls, and Prisma database queries without requiring mandatory external collector connectivity.

#### Scenario: Application startup without active collector
- **WHEN** the API application starts and `OTEL_EXPORTER_OTLP_ENDPOINT` is not configured or the collector is unreachable
- **THEN** the application initializes successfully, completes bootstrapping, and serves incoming HTTP requests without crashing or blocking

#### Scenario: Application startup with active OTLP configuration
- **WHEN** the API application starts with `OTEL_EXPORTER_OTLP_ENDPOINT` pointing to a configured collector endpoint
- **THEN** the OpenTelemetry SDK initializes the OTLP HTTP trace exporter with service resource attributes derived from `OTEL_SERVICE_NAME` or default `flowpulse-api`

### Requirement: W3C Trace Context and Request Correlation
The backend SHALL extract incoming W3C Trace Context headers (`traceparent`, `tracestate`) on inbound HTTP requests and correlate the active span's trace ID with request handling and response headers.

#### Scenario: Inbound request with valid traceparent header
- **WHEN** a client sends an HTTP request containing a valid W3C `traceparent` header
- **THEN** the backend establishes the incoming trace context as the parent of the root request span and returns an `X-Trace-ID` response header matching the incoming trace ID

#### Scenario: Inbound request without traceparent header
- **WHEN** a client sends an HTTP request without a `traceparent` header
- **THEN** the backend generates a new distributed trace, assigns a valid 32-hexadecimal-character trace ID, and returns it in the `X-Trace-ID` response header

### Requirement: Correlation between Request ID and Trace ID
Every incoming HTTP request SHALL carry both a unique `request_id` and a `trace_id`, returning `X-Request-ID` and `X-Trace-ID` in HTTP response headers and including both identifiers in RFC 7807 Problem Details error responses.

#### Scenario: Headers present on successful responses
- **WHEN** an HTTP request is processed by any API endpoint
- **THEN** the HTTP response contains both `X-Request-ID` and `X-Trace-ID` headers

#### Scenario: Problem Details error response contains trace_id
- **WHEN** an API request results in an HTTP exception or validation error handled by ProblemDetailsExceptionFilter
- **THEN** the returned RFC 7807 JSON response body contains both `request_id` and `trace_id` fields

### Requirement: Outbound Context Propagation
The backend SHALL automatically propagate the current W3C Trace Context (`traceparent`) in all outbound HTTP requests executed via fetch or Node HTTP clients to external services, including OpenRouter and Clerk.

#### Scenario: Outbound call carries traceparent
- **WHEN** the backend initiates an outbound HTTP request during request processing
- **THEN** the outbound request headers include a valid `traceparent` header containing the active trace ID and current span ID

### Requirement: Health Check Independence
The health check endpoint (`GET /api/v1/health`) SHALL report application liveness and readiness independently of OpenTelemetry collector availability and SHALL NOT expose internal telemetry connection strings or credentials.

#### Scenario: Health endpoint returns 200 regardless of collector status
- **WHEN** a client requests `GET /api/v1/health` while the OTLP collector is offline or unavailable
- **THEN** the endpoint returns HTTP 200 OK with `status: "ok"` and valid `X-Request-ID` and `X-Trace-ID` response headers
