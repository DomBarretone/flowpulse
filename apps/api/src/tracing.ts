import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();

export const otelSdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'flowpulse-api',
  ...(otlpEndpoint ? { traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }) } : {}),
  instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()],
});

otelSdk.start();

process.on('SIGTERM', () => {
  otelSdk.shutdown().catch((err) => console.error('Error shutting down OpenTelemetry SDK', err));
});
