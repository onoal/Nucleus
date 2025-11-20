/**
 * Storage adapter interface for Nucleus
 */

import type { NucleusRecord, GetChainOpts } from "./core.js";

/**
 * Storage adapter for persisting Nucleus records
 * 
 * Implementations must enforce:
 * - Unique hash constraint
 * - Unique (chainId, index) constraint
 * - Atomic writes
 */
export interface RecordStore {
  /**
   * Store a new record
   * 
   * @throws Error if hash or (chainId, index) already exists
   */
  put(record: NucleusRecord): Promise<void>;
  
  /**
   * Retrieve record by hash
   * 
   * @returns Record or null if not found
   */
  getByHash(hash: string): Promise<NucleusRecord | null>;
  
  /**
   * Get all records in a chain
   * 
   * @returns Records ordered by index (ascending by default)
   */
  getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]>;
  
  /**
   * Get the latest (highest index) record in a chain
   * 
   * @returns Head record or null if chain doesn't exist
   */
  getHead(chainId: string): Promise<NucleusRecord | null>;
}

/**
 * Error thrown when storage constraint is violated
 */
export class StorageConstraintError extends Error {
  constructor(
    message: string,
    public readonly constraint: "hash" | "chain_index"
  ) {
    super(message);
    this.name = "StorageConstraintError";
  }
}

