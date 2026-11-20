/**
 * Structured JSON logger with automatic redaction of secrets, tickets, cookies, and clinical PII.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const SENSITIVE_KEY_PATTERN =
  /ticket|secret|token|password|cookie|authorization|signature|diagnosis|clinical|complaint|notes|payload|email|phone|medical/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : item
    );
  }
  if (typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = sanitizeValue(k, v);
  }
  return clean;
}

export class StructuredLogger {
  private readonly minLevel: number;

  constructor(level: LogLevel = 'info') {
    this.minLevel = LEVEL_PRIORITY[level] ?? LEVEL_PRIORITY.info;
  }

  private emit(level: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < this.minLevel) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      service: 'toothcare-realtime',
      level,
      message,
      ...(meta ? sanitizeObject(meta) : {}),
    };

    const serialized = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(`${serialized}\n`);
    } else {
      process.stdout.write(`${serialized}\n`);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.emit('error', message, meta);
  }
}
