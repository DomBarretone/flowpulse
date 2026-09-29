import { Injectable, LoggerService } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { SanitizerService } from '../sanitization/sanitizer.service';
import { requestContext } from './request-context';

export interface StructuredLogFields {
  timestamp: string;
  level: string;
  service: string;
  environment: string;
  event_name: string;
  request_id?: string | null;
  trace_id?: string | null;
  [key: string]: unknown;
}

@Injectable()
export class JsonLoggerService implements LoggerService {
  private readonly sanitizer: SanitizerService;
  private readonly serviceName: string;
  private readonly environment: string;

  private readonly SENSITIVE_KEYS = new Set([
    'authorization',
    'x-api-key',
    'x_api_key',
    'api-key',
    'api_key',
    'apikey',
    'cookie',
    'set-cookie',
    'password',
    'secret',
    'token',
    'clerk_secret_key',
    'openrouter_api_key',
  ]);

  constructor(sanitizer?: SanitizerService) {
    this.sanitizer = sanitizer || new SanitizerService();
    this.serviceName = process.env.OTEL_SERVICE_NAME || 'flowpulse-api';
    this.environment = process.env.NODE_ENV || 'development';
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emitLog('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emitLog('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emitLog('warn', message, optionalParams);
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.emitLog('debug', message, optionalParams);
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.emitLog('debug', message, optionalParams);
  }

  fatal?(message: unknown, ...optionalParams: unknown[]): void {
    this.emitLog('error', message, optionalParams);
  }

  formatLog(level: string, message: unknown, optionalParams: unknown[]): StructuredLogFields {
    const store = requestContext.getStore();
    const requestId = store?.requestId ?? null;
    const activeSpan = trace.getActiveSpan();
    const traceId = store?.traceId || activeSpan?.spanContext().traceId || null;

    let eventName = 'application_log';
    let messageText: string | undefined;
    let extraContext: Record<string, unknown> = {};

    if (typeof message === 'object' && message !== null) {
      const { event_name, message: msg, ...rest } = message as Record<string, unknown>;
      if (typeof event_name === 'string') {
        eventName = event_name;
      }
      if (typeof msg === 'string') {
        messageText = msg;
      }
      extraContext = { ...rest };
    } else if (message !== undefined && message !== null) {
      messageText = String(message);
    }

    if (optionalParams && optionalParams.length > 0) {
      if (optionalParams.length === 1 && typeof optionalParams[0] === 'string') {
        extraContext.context = optionalParams[0];
      } else {
        optionalParams.forEach((param, index) => {
          if (typeof param === 'string' && index === optionalParams.length - 1) {
            extraContext.context = param;
          } else if (typeof param === 'object' && param !== null) {
            extraContext = { ...extraContext, ...param };
          } else if (param !== undefined) {
            extraContext[`param_${index}`] = param;
          }
        });
      }
    }

    const payload: StructuredLogFields = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      event_name: eventName,
      request_id: requestId,
      trace_id: traceId,
      ...(messageText !== undefined ? { message: messageText } : {}),
      ...extraContext,
    };

    return this.sanitizeData(payload) as StructuredLogFields;
  }

  private emitLog(level: string, message: unknown, optionalParams: unknown[]): void {
    const entry = this.formatLog(level, message, optionalParams);
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }
    if (typeof data === 'string') {
      return this.sanitizer.sanitize(data);
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }
    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (this.SENSITIVE_KEYS.has(key.toLowerCase())) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.sanitizeData(value);
        }
      }
      return result;
    }
    return String(data);
  }
}
