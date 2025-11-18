/**
 * Logger utility for Ledger Framework
 *
 * Enterprise-grade structured logging with context awareness.
 * Supports multiple log levels, structured output, and performance tracking.
 *
 * @module utils/logger
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  ledger?: string;
  module?: string;
  service?: string;
  operation?: string;
  entryId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number; // milliseconds
  [key: string]: unknown;
}

export interface LoggerConfig {
  level?: LogLevel;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  enableContext?: boolean;
  format?: "json" | "pretty";
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private config: Required<LoggerConfig>;
  private context: LogContext = {};

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || "info",
      enableColors: config.enableColors ?? true,
      enableTimestamp: config.enableTimestamp ?? true,
      enableContext: config.enableContext ?? true,
      format: config.format || "pretty",
    };
  }

  /**
   * Set default context for all logs
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger(this.config);
    child.setContext({ ...this.context, ...context });
    return child;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Format log entry
   */
  private formatLog(entry: LogEntry): string {
    if (this.config.format === "json") {
      return JSON.stringify(entry);
    }

    // Pretty format
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    // Level with color
    const levelStr = this.formatLevel(entry.level);
    parts.push(levelStr);

    // Message
    parts.push(entry.message);

    // Context
    if (this.config.enableContext && entry.context) {
      const contextStr = this.formatContext(entry.context);
      if (contextStr) {
        parts.push(contextStr);
      }
    }

    // Error
    if (entry.error) {
      parts.push(`\n  Error: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(
          `\n  Stack: ${entry.error.stack.split("\n").slice(0, 3).join("\n    ")}`
        );
      }
    }

    // Duration
    if (entry.duration !== undefined) {
      parts.push(`(${entry.duration}ms)`);
    }

    return parts.join(" ");
  }

  /**
   * Format log level with colors
   */
  private formatLevel(level: LogLevel): string {
    if (!this.config.enableColors) {
      return `[${level.toUpperCase()}]`;
    }

    const colors: Record<LogLevel, string> = {
      debug: "\x1b[36m", // Cyan
      info: "\x1b[32m", // Green
      warn: "\x1b[33m", // Yellow
      error: "\x1b[31m", // Red
    };

    const reset = "\x1b[0m";
    return `${colors[level]}[${level.toUpperCase()}]${reset}`;
  }

  /**
   * Format context
   */
  private formatContext(context: LogContext): string {
    const parts: string[] = [];

    if (context.ledger) {
      parts.push(`ledger=${context.ledger}`);
    }
    if (context.module) {
      parts.push(`module=${context.module}`);
    }
    if (context.service) {
      parts.push(`service=${context.service}`);
    }
    if (context.operation) {
      parts.push(`op=${context.operation}`);
    }
    if (context.entryId) {
      parts.push(`entry=${context.entryId.substring(0, 8)}...`);
    }
    if (context.userId) {
      parts.push(`user=${context.userId}`);
    }

    // Additional context
    const additional = Object.entries(context)
      .filter(
        ([key]) =>
          ![
            "ledger",
            "module",
            "service",
            "operation",
            "entryId",
            "userId",
          ].includes(key)
      )
      .map(([key, value]) => `${key}=${String(value)}`);

    parts.push(...additional);

    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  }

  /**
   * Log a message
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    duration?: number
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.config.enableContext && {
        context: { ...this.context, ...context },
      }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
      ...(duration !== undefined && { duration }),
    };

    const formatted = this.formatLog(entry);

    // Output to console
    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, context, error);
  }

  /**
   * Time an operation
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`${operation} completed`, { ...context, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(
        `${operation} failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          ...context,
          duration,
        }
      );
      throw error;
    }
  }

  /**
   * Time a synchronous operation
   */
  timeSync<T>(operation: string, fn: () => T, context?: LogContext): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.debug(`${operation} completed`, { ...context, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(
        `${operation} failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          ...context,
          duration,
        }
      );
      throw error;
    }
  }
}

/**
 * Create a logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}

/**
 * Default logger instance
 */
export const defaultLogger = createLogger();
