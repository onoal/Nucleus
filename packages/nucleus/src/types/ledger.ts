import type { ModuleConfig } from "./module";
import type { BackendConfig } from "./backend";
import type { LedgerRecord, QueryFilters, QueryResult } from "./record";
import type { Grant, CheckParams, RevokeParams, AclConfig } from "./acl";

/**
 * Storage configuration
 *
 * **Important**: Storage is only supported on native targets (Node.js with Rust backend).
 * WASM targets (browser) only support in-memory mode.
 */
export type StorageConfig =
  | { type: "none" } // In-memory only
  | { type: "sqlite"; path: string } // SQLite (native only)
  | { type: "postgres"; connectionString: string }; // PostgreSQL (future, native only)

/**
 * Ledger configuration
 */
export interface LedgerConfig {
  /**
   * Unique ledger identifier
   */
  id: string;

  /**
   * Backend configuration (WASM or HTTP)
   */
  backend: BackendConfig;

  /**
   * Modules to load
   */
  modules: ModuleConfig[];

  /**
   * Optional configuration options
   */
  options?: LedgerOptions;

  /**
   * Storage configuration
   *
   * Default: { type: "none" } (in-memory only)
   *
   * **Important**:
   * - SQLite/PostgreSQL storage only works on native targets (Node.js)
   * - WASM (browser) only supports in-memory mode
   * - For browser persistence, consider IndexedDB wrapper (future)
   */
  storage?: StorageConfig;

  /**
   * ACL (Access Control List) configuration
   *
   * Default: "none" (all operations allowed)
   *
   * **Options**:
   * - "none": No ACL (all operations allowed)
   * - "inMemory": In-memory ACL (engine-enforced access control)
   */
  acl?: AclConfig;
}

/**
 * Ledger configuration options
 */
export interface LedgerOptions {
  /**
   * Enable strict validation
   */
  strictValidation?: boolean;

  /**
   * Maximum number of entries in memory
   */
  maxEntries?: number;

  /**
   * Enable metrics collection
   */
  enableMetrics?: boolean;
}

/**
 * Ledger instance interface
 */
export interface Ledger {
  /**
   * Ledger ID
   */
  readonly id: string;

  /**
   * Append a record to the ledger
   * @param record The record to append
   * @param context Request context (required for security)
   * @returns Hash of the appended record
   */
  append(record: LedgerRecord, context: RequestContext): Promise<string>;

  /**
   * Get a record by hash
   */
  get(hash: string): Promise<LedgerRecord | null>;

  /**
   * Get a record by ID
   */
  getById(id: string): Promise<LedgerRecord | null>;

  /**
   * Query records with filters
   */
  query(filters: QueryFilters): Promise<QueryResult>;

  /**
   * Append multiple records atomically
   * @param records Array of records to append
   * @param context Request context (required for security)
   * @returns Array of hashes
   */
  appendBatch(
    records: LedgerRecord[],
    context: RequestContext
  ): Promise<string[]>;

  /**
   * Verify chain integrity
   */
  verify(): Promise<void>;

  /**
   * Get entry count
   */
  length(): Promise<number>;

  /**
   * Check if ledger is empty
   */
  isEmpty(): Promise<boolean>;

  /**
   * Get latest entry hash
   */
  latestHash(): Promise<string | null>;

  /**
   * Check if persistent storage is enabled
   *
   * Returns true if the ledger has persistent storage configured
   * (SQLite, PostgreSQL, etc.), false if in-memory only.
   *
   * **Note**: Always returns false in WASM (browser) environments.
   */
  hasStorage(): Promise<boolean>;

  /**
   * Verify storage integrity (if storage is enabled)
   *
   * This performs full chain verification on persistent storage:
   * - Loads all entries from storage
   * - Recomputes hashes
   * - Verifies chain links
   *
   * Returns:
   * - `false` if storage is not enabled
   * - `true` if storage is enabled and integrity is valid
   *
   * Throws if integrity check fails.
   *
   * **Note**: Always returns false in WASM (browser) environments.
   */
  verifyStorage(): Promise<boolean>;

  /**
   * Modules namespace for module operations (readonly)
   *
   * Access module information and state.
   * All operations are readonly - modules are managed by the Rust engine.
   */
  readonly modules: {
    /**
     * List all registered module IDs
     *
     * @returns Array of module IDs (e.g., ["proof", "asset"])
     *
     * @example
     * ```ts
     * const moduleIds = await ledger.modules.list();
     * console.log(moduleIds); // ["proof", "asset"]
     * ```
     */
    list(): Promise<string[]>;

    /**
     * Get module metadata (ID, version, state)
     *
     * @returns Array of module metadata objects
     *
     * @example
     * ```ts
     * const metadata = await ledger.modules.metadata();
     * console.log(metadata);
     * // [
     * //   { id: "proof", version: "1.0.0", state: "Started" },
     * //   { id: "asset", version: "1.0.0", state: "Started" }
     * // ]
     * ```
     */
    metadata(): Promise<ModuleMetadata[]>;

    /**
     * Get module state by ID
     *
     * @param id - Module ID
     * @returns Module state or null if not found
     *
     * @example
     * ```ts
     * const state = await ledger.modules.getState("proof");
     * console.log(state); // "Started"
     * ```
     */
    getState(id: string): Promise<ModuleState | null>;
  };

  /**
   * ACL (Access Control List) namespace
   *
   * Engine-side access control management (delegated to Rust engine).
   * All operations are managed by the Rust engine.
   *
   * **Note**: Only available if ACL is enabled in ledger config.
   * If ACL is disabled (default), all operations will succeed/return empty.
   */
  readonly acl: {
    /**
     * Grant access to a resource
     *
     * @param grant - Grant parameters
     *
     * @example
     * ```ts
     * await ledger.acl.grant({
     *   subjectOid: "oid:onoal:human:alice",
     *   resourceOid: "oid:onoal:ledger:my-ledger",
     *   action: "write",
     *   grantedBy: "oid:onoal:system:admin",
     *   grantedAt: Date.now() / 1000, // Unix timestamp in seconds
     * });
     * ```
     */
    grant(grant: Grant): Promise<void>;

    /**
     * Check if access is allowed
     *
     * @param params - Check parameters
     * @returns True if access is granted, false otherwise
     *
     * @example
     * ```ts
     * const allowed = await ledger.acl.check({
     *   requesterOid: "oid:onoal:human:alice",
     *   resourceOid: "oid:onoal:ledger:my-ledger",
     *   action: "write",
     * });
     * ```
     */
    check(params: CheckParams): Promise<boolean>;

    /**
     * Revoke access to a resource
     *
     * @param params - Revoke parameters
     *
     * @example
     * ```ts
     * await ledger.acl.revoke({
     *   subjectOid: "oid:onoal:human:alice",
     *   resourceOid: "oid:onoal:ledger:my-ledger",
     *   action: "write",
     * });
     * ```
     */
    revoke(params: RevokeParams): Promise<void>;

    /**
     * List all grants for a subject
     *
     * @param subjectOid - Subject OID
     * @returns Array of active grants
     *
     * @example
     * ```ts
     * const grants = await ledger.acl.listGrants("oid:onoal:human:alice");
     * console.log(grants);
     * // [
     * //   {
     * //     subjectOid: "oid:onoal:human:alice",
     * //     resourceOid: "oid:onoal:ledger:my-ledger",
     * //     action: "write",
     * //     grantedBy: "oid:onoal:system:admin",
     * //     grantedAt: 1234567890
     * //   }
     * // ]
     * ```
     */
    listGrants(subjectOid: string): Promise<Grant[]>;
  };
}

/**
 * Module metadata
 */
export interface ModuleMetadata {
  /** Module ID */
  id: string;
  /** Module version */
  version: string;
  /** Current lifecycle state */
  state: ModuleState;
}

/**
 * Module lifecycle state
 */
export type ModuleState = "Registered" | "Initialized" | "Started" | "Stopped";
