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
}
