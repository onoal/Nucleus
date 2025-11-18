import type { ModuleConfig } from "./module";
import type { BackendConfig } from "./backend";
import type { LedgerRecord, QueryFilters, QueryResult } from "./record";

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
}
