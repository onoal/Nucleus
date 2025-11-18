/**
 * Request context for authentication and authorization
 *
 * Every ledger operation that mutates state or reads sensitive data
 * MUST include a request context with a requester OID.
 *
 * @module context
 */

/**
 * Request context for ledger operations
 *
 * Contains information about who is making the request and when.
 * This is used for:
 * - Access control (UAL - Unified Access Layer)
 * - Audit logging
 * - Record attribution
 *
 * # Important
 *
 * The `requesterOid` is **REQUIRED** for all operations that:
 * - Mutate ledger state (append, batch append)
 * - Read sensitive data
 * - Perform administrative operations
 *
 * Operations without context will be **REJECTED**.
 *
 * @example
 * ```typescript
 * import { createContext } from "@onoal/nucleus";
 *
 * const ctx = createContext("oid:onoal:human:alice");
 *
 * await ledger.append(record, ctx);
 * ```
 */
export interface RequestContext {
  /**
   * OID of the entity making the request (REQUIRED)
   *
   * Format: `oid:onoal:{type}:{id}`
   *
   * Examples:
   * - `oid:onoal:human:alice`
   * - `oid:onoal:org:acme-corp`
   * - `oid:onoal:service:api-gateway`
   */
  requesterOid: string;

  /**
   * Request timestamp (unix milliseconds)
   * Auto-generated if not provided
   */
  timestamp?: number;

  /**
   * Optional additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Context error types
 */
export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextError";
  }
}

/**
 * Context validation error
 */
export class ContextValidationError extends ContextError {
  constructor(message: string) {
    super(`Context validation failed: ${message}`);
    this.name = "ContextValidationError";
  }
}

/**
 * Missing context error
 */
export class MissingContextError extends ContextError {
  constructor() {
    super("Request context is required. Provide context with requesterOid.");
    this.name = "MissingContextError";
  }
}
