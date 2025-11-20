/**
 * Nucleus ledger engine
 * 
 * Main SDK class for append-only, chain-linked records
 */

import type {
  NucleusRecord,
  AppendInput,
  RecordStore,
  GetChainOpts,
} from "../types/index.js";
import { NUCLEUS_SCHEMA_VERSION, ValidationError } from "../types/index.js";
import { getModule } from "./module-registry.js";

/**
 * Hash computation function (provided by WASM)
 */
export type ComputeHashFn = (recordWithoutHash: Record<string, unknown>) => string;

/**
 * Nucleus ledger engine
 * 
 * Features:
 * - Append-only records with chain consistency
 * - Deterministic hash computation via WASM
 * - Module-based validation
 * - Storage adapter pattern
 * 
 * @example
 * ```typescript
 * const nucleus = new Nucleus(storage, computeHash);
 * 
 * const record = await nucleus.append({
 *   module: 'oid',
 *   chainId: 'oid:onoal:user123',
 *   body: { oidRecord: {...} }
 * });
 * ```
 */
export class Nucleus {
  constructor(
    private readonly storage: RecordStore,
    private readonly computeHash: ComputeHashFn
  ) {}

  /**
   * Append a new record to a chain
   * 
   * Process:
   * 1. Determine timestamp
   * 2. Fetch previous record (head of chain)
   * 3. Calculate index and prevHash
   * 4. Build record without hash
   * 5. Compute hash via WASM
   * 6. Validate via module runtime
   * 7. Store record
   * 
   * @param input Append input
   * @returns Created record
   * @throws ValidationError if module validation fails
   * @throws StorageConstraintError if hash or (chainId, index) already exists
   */
  async append(input: AppendInput): Promise<NucleusRecord> {
    // 1. Determine timestamp
    const now = input.context?.now ?? new Date().toISOString();

    // 2. Fetch previous record
    const prevRecord = await this.storage.getHead(input.chainId);

    // 3. Calculate index and prevHash
    const index = prevRecord === null ? 0 : prevRecord.index + 1;
    const prevHash = prevRecord === null ? null : prevRecord.hash;

    // Validate chain consistency
    if (prevRecord !== null) {
      this.validateChainLink(prevRecord, input.chainId, index - 1);
    }

    // 4. Build record without hash
    const recordWithoutHash = {
      schema: NUCLEUS_SCHEMA_VERSION,
      module: input.module,
      chainId: input.chainId,
      index,
      prevHash,
      createdAt: now,
      body: input.body,
      ...(input.meta && { meta: input.meta }),
    };

    // 5. Compute hash via WASM
    let hash: string;
    try {
      hash = this.computeHash(recordWithoutHash);
    } catch (error) {
      throw new Error(
        `Hash computation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Build final record
    const record: NucleusRecord = {
      ...recordWithoutHash,
      hash,
    };

    // 6. Validate via module runtime
    const moduleRuntime = getModule(input.module);

    const validationResult = await moduleRuntime.validateRecord({
      record,
      prevRecord,
      context: {
        callerOid: input.context?.callerOid,
        now,
      },
    });

    if (!validationResult.ok) {
      throw new ValidationError(
        validationResult.errorMessage ?? "Validation failed",
        validationResult.errorCode ?? "VALIDATION_ERROR"
      );
    }

    // 7. Store record
    await this.storage.put(record);

    return record;
  }

  /**
   * Get the head (latest) record in a chain
   * 
   * @param chainId Chain identifier
   * @returns Head record or null if chain doesn't exist
   */
  async getHead(chainId: string): Promise<NucleusRecord | null> {
    return this.storage.getHead(chainId);
  }

  /**
   * Get a record by its hash
   * 
   * @param hash Record hash
   * @returns Record or null if not found
   */
  async getByHash(hash: string): Promise<NucleusRecord | null> {
    return this.storage.getByHash(hash);
  }

  /**
   * Get all records in a chain
   * 
   * @param chainId Chain identifier
   * @param opts Query options (limit, offset, reverse)
   * @returns Array of records (ordered by index)
   */
  async getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]> {
    return this.storage.getChain(chainId, opts);
  }

  /**
   * Validate chain link consistency
   * 
   * @param prevRecord Previous record
   * @param expectedChainId Expected chain ID
   * @param expectedIndex Expected index
   * @throws Error if chain link is invalid
   */
  private validateChainLink(
    prevRecord: NucleusRecord,
    expectedChainId: string,
    expectedIndex: number
  ): void {
    if (prevRecord.chainId !== expectedChainId) {
      throw new Error(
        `Chain consistency error: expected chainId ${expectedChainId}, got ${prevRecord.chainId}`
      );
    }

    if (prevRecord.index !== expectedIndex) {
      throw new Error(
        `Chain consistency error: expected index ${expectedIndex}, got ${prevRecord.index}`
      );
    }
  }
}

