/**
 * Context helper functions
 */

import type { RequestContext } from "./types";
import { ContextValidationError, MissingContextError } from "./types";

/**
 * Create a request context
 *
 * @param requesterOid - OID of the requester (format: `oid:onoal:{type}:{id}`)
 * @param options - Optional context options
 * @returns Request context
 *
 * @example
 * ```typescript
 * import { createContext } from "@onoal/nucleus";
 *
 * const ctx = createContext("oid:onoal:human:alice");
 *
 * // With metadata
 * const ctxWithMeta = createContext("oid:onoal:human:alice", {
 *   metadata: { ip: "192.168.1.1" }
 * });
 * ```
 */
export function createContext(
  requesterOid: string,
  options?: {
    timestamp?: number;
    metadata?: Record<string, any>;
  }
): RequestContext {
  return {
    requesterOid,
    timestamp: options?.timestamp ?? Date.now(),
    metadata: options?.metadata,
  };
}

/**
 * Require context (throws if missing or invalid)
 *
 * Use this to enforce context at API boundaries.
 *
 * @param ctx - Context to validate (may be undefined)
 * @returns Validated context
 * @throws {MissingContextError} If context is missing
 * @throws {ContextValidationError} If context is invalid
 *
 * @example
 * ```typescript
 * import { requireContext } from "@onoal/nucleus";
 *
 * async function appendRecord(record: Record, ctx?: RequestContext) {
 *   const validCtx = requireContext(ctx); // Throws if missing
 *   // ... proceed with valid context
 * }
 * ```
 */
export function requireContext(
  ctx: RequestContext | undefined
): RequestContext {
  if (!ctx) {
    throw new MissingContextError();
  }

  validateContext(ctx); // Throws if invalid
  return ctx;
}

/**
 * Validate context
 *
 * Checks:
 * - Requester OID is not empty
 * - Requester OID has valid format (oid:onoal:{type}:{id})
 * - Timestamp is reasonable (not in the future)
 *
 * @param ctx - Context to validate
 * @throws {ContextValidationError} If validation fails
 *
 * @example
 * ```typescript
 * import { validateContext } from "@onoal/nucleus";
 *
 * try {
 *   validateContext(ctx);
 *   console.log("Context is valid");
 * } catch (error) {
 *   console.error("Invalid context:", error);
 * }
 * ```
 */
export function validateContext(ctx: RequestContext): void {
  // Check requester OID is not empty
  if (!ctx.requesterOid || ctx.requesterOid.trim() === "") {
    throw new ContextValidationError("Requester OID is required");
  }

  // Basic OID format validation
  if (!ctx.requesterOid.startsWith("oid:onoal:")) {
    throw new ContextValidationError(
      `OID must start with 'oid:onoal:', got: ${ctx.requesterOid}`
    );
  }

  // Check OID has at least 4 parts (oid:onoal:type:id)
  const parts = ctx.requesterOid.split(":");
  if (parts.length < 4) {
    throw new ContextValidationError(
      `OID must have format 'oid:onoal:{type}:{id}', got: ${ctx.requesterOid}`
    );
  }

  // Timestamp validation (not too far in the future)
  if (ctx.timestamp) {
    const now = Date.now();
    const futureThreshold = now + 300_000; // 5 minutes
    if (ctx.timestamp > futureThreshold) {
      throw new ContextValidationError(
        `Timestamp is too far in the future: ${ctx.timestamp}`
      );
    }
  }
}

/**
 * Check if context is valid (boolean check, doesn't throw)
 *
 * @param ctx - Context to check
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * import { isValidContext } from "@onoal/nucleus";
 *
 * if (isValidContext(ctx)) {
 *   // Proceed with valid context
 * } else {
 *   // Handle invalid context
 * }
 * ```
 */
export function isValidContext(ctx: RequestContext | undefined): boolean {
  if (!ctx) {
    return false;
  }

  try {
    validateContext(ctx);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert context to Rust-compatible format
 *
 * Internal helper for WASM bindings.
 *
 * @param ctx - TypeScript context
 * @returns Rust-compatible context object
 * @internal
 */
export function contextToRust(ctx: RequestContext): any {
  return {
    requester_oid: ctx.requesterOid,
    timestamp: ctx.timestamp ?? Date.now(),
    metadata: ctx.metadata,
  };
}
