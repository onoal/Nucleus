import type { ModuleConfig } from "./module";
import type { BackendConfig } from "./backend";
import type { LedgerRecord, QueryFilters, QueryResult } from "./record";

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
   */
  append(record: LedgerRecord): Promise<string>;

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
   */
  appendBatch(records: LedgerRecord[]): Promise<string[]>;

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
