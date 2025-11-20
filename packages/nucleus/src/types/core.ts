/**
 * Core types for Nucleus ledger system
 */

/**
 * Nucleus record schema version
 */
export const NUCLEUS_SCHEMA_VERSION = "nucleus-core/v0.1.0-beta" as const;

/**
 * Module names (extensible)
 */
export type ModuleName = string;

/**
 * A record in the Nucleus ledger
 *
 * Immutable, append-only, chain-linked record with deterministic hash
 */
export interface NucleusRecord {
  /** Schema version identifier */
  schema: typeof NUCLEUS_SCHEMA_VERSION;

  /** Module that owns this record */
  module: ModuleName;

  /** Chain identifier (opaque string, module-specific pattern) */
  chainId: string;

  /** Index in chain (0-based, sequential) */
  index: number;

  /** Hash of previous record in chain (null for genesis record) */
  prevHash: string | null;

  /** ISO 8601 UTC timestamp when record was created */
  createdAt: string;

  /** Module-specific payload */
  body: unknown;

  /** Optional metadata (tags, hints, annotations) */
  meta?: Record<string, unknown>;

  /** Base64url-encoded SHA-256 hash of canonical representation */
  hash: string;
}

/**
 * Input for appending a new record to a chain
 */
export interface AppendInput {
  /** Module name */
  module: ModuleName;

  /** Chain identifier */
  chainId: string;

  /** Module-specific payload */
  body: unknown;

  /** Optional metadata */
  meta?: Record<string, unknown>;

  /** Execution context */
  context?: AppendContext;
}

/**
 * Context information for record creation
 */
export interface AppendContext {
  /** OID of the entity creating the record */
  callerOid?: string;

  /** Override timestamp (for testing, defaults to system time) */
  now?: string;
}

/**
 * Options for querying a chain
 */
export interface GetChainOpts {
  /** Maximum number of records to return */
  limit?: number;

  /** Number of records to skip (for pagination) */
  offset?: number;

  /** Return records in reverse order (newest first) */
  reverse?: boolean;
}

/**
 * Result of record validation
 */
export interface ValidationResult {
  /** Whether validation succeeded */
  ok: boolean;

  /** Error code (if validation failed) */
  errorCode?: string;

  /** Human-readable error message (if validation failed) */
  errorMessage?: string;
}

/**
 * Context passed to module validators
 */
export interface ValidationContext {
  /** OID of the entity creating the record */
  callerOid?: string;

  /** Timestamp when record was created */
  now: string;
}

/**
 * Type guard: check if value is a valid NucleusRecord
 */
export function isNucleusRecord(value: unknown): value is NucleusRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record["schema"] === NUCLEUS_SCHEMA_VERSION &&
    typeof record["module"] === "string" &&
    typeof record["chainId"] === "string" &&
    typeof record["index"] === "number" &&
    (record["prevHash"] === null || typeof record["prevHash"] === "string") &&
    typeof record["createdAt"] === "string" &&
    typeof record["hash"] === "string"
  );
}
