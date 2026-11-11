export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export class Logger {
  static log(
    level: LogLevel,
    component: string,
    message: string,
    durationMs?: number,
    metadata?: Record<string, any>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      durationMs,
      metadata,
    };

    const durationStr = durationMs !== undefined ? ` (${durationMs.toFixed(1)}ms)` : '';
    const metaStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';

    if (level === 'ERROR') {
      console.error(`[${entry.timestamp}] [${level}] [${component}] ${message}${durationStr}${metaStr}`);
    } else if (level === 'WARN') {
      console.warn(`[${entry.timestamp}] [${level}] [${component}] ${message}${durationStr}${metaStr}`);
    } else {
      console.log(`[${entry.timestamp}] [${level}] [${component}] ${message}${durationStr}${metaStr}`);
    }
  }

  static info(component: string, message: string, durationMs?: number, metadata?: Record<string, any>): void {
    this.log('INFO', component, message, durationMs, metadata);
  }

  static warn(component: string, message: string, metadata?: Record<string, any>): void {
    this.log('WARN', component, message, undefined, metadata);
  }

  static error(component: string, message: string, error?: any): void {
    const meta = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
    this.log('ERROR', component, message, undefined, meta);
  }
}

