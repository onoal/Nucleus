/**
 * @onoal/ledger-context
 *
 * Context types and utilities for the Onoal Ledger framework.
 * Contains RequestContext (authentication) and LogContext (logging).
 *
 * @packageDocumentation
 */

// Export RequestContext and auth utilities
export {
  createAuthMiddleware,
  getRequesterOid,
  type RequestContext,
  type AuthMiddlewareOptions,
} from "./auth.js";

// Export Logger and logging utilities
export {
  Logger,
  createLogger,
  defaultLogger,
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LoggerConfig,
} from "./logger.js";

