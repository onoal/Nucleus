import type {
  WasmBackendConfig,
  LedgerConfig as CoreLedgerConfig,
} from "../types";
import type { LedgerRecord, QueryFilters, QueryResult } from "../types";
import type {
  WasmLedger,
  LedgerConfig as WasmLedgerConfig,
} from "@onoal/nucleus-wasm";

/**
 * WASM Backend implementation
 */
export class WasmBackend {
  private wasmLedger: WasmLedger | null = null;
  private ledgerConfig: CoreLedgerConfig;
  private initPromise: Promise<void> | null = null;

  constructor(_config: WasmBackendConfig, ledgerConfig: CoreLedgerConfig) {
    // _config is reserved for future use (e.g., custom WASM path)
    this.ledgerConfig = ledgerConfig;
  }

  /**
   * Initialize WASM backend
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // Load WASM module
      const wasmModule = await import("@onoal/nucleus-wasm");

      // Initialize WASM if needed
      if (wasmModule.default) {
        await wasmModule.default();
      }

      const { WasmLedger } = wasmModule;

      // Convert config to WASM format
      const wasmConfig: WasmLedgerConfig = {
        id: this.ledgerConfig.id,
        modules: this.ledgerConfig.modules.map((m) => ({
          id: m.id,
          version: m.version,
          config: m.config,
        })),
        options: this.ledgerConfig.options
          ? {
              strict_validation: this.ledgerConfig.options.strictValidation,
              max_entries: this.ledgerConfig.options.maxEntries,
              enable_metrics: this.ledgerConfig.options.enableMetrics,
            }
          : undefined,
      };

      // Create WASM ledger instance
      this.wasmLedger = new WasmLedger(wasmConfig);
    })();

    return this.initPromise;
  }

  private ensureLedger(): WasmLedger {
    if (!this.wasmLedger) {
      throw new Error("WASM backend not initialized. Call init() first.");
    }
    return this.wasmLedger;
  }

  /**
   * Append a record
   */
  async append(record: LedgerRecord): Promise<string> {
    const ledger = this.ensureLedger();
    return ledger.append_record(record);
  }

  /**
   * Get record by hash
   */
  async get(hash: string): Promise<LedgerRecord | null> {
    const ledger = this.ensureLedger();
    try {
      return ledger.get_record(hash);
    } catch {
      return null;
    }
  }

  /**
   * Get record by ID
   */
  async getById(id: string): Promise<LedgerRecord | null> {
    const ledger = this.ensureLedger();
    try {
      return ledger.get_record_by_id(id);
    } catch {
      return null;
    }
  }

  /**
   * Query records
   */
  async query(filters: QueryFilters): Promise<QueryResult> {
    const ledger = this.ensureLedger();
    // Convert filters to WASM format
    const wasmFilters = {
      stream: filters.stream,
      id: filters.id,
      limit: filters.limit,
      offset: filters.offset,
      timestamp_from: filters.timestampFrom,
      timestamp_to: filters.timestampTo,
      module_filters: filters.moduleFilters,
    };
    const result = ledger.query(wasmFilters);
    return {
      records: result.records || [],
      total: result.total || 0,
      hasMore: result.has_more || false,
    };
  }

  /**
   * Append batch
   */
  async appendBatch(records: LedgerRecord[]): Promise<string[]> {
    const ledger = this.ensureLedger();
    return ledger.append_batch(records);
  }

  /**
   * Verify chain
   */
  async verify(): Promise<void> {
    const ledger = this.ensureLedger();
    ledger.verify();
  }

  /**
   * Get length
   */
  async length(): Promise<number> {
    const ledger = this.ensureLedger();
    return ledger.len();
  }

  /**
   * Check if empty
   */
  async isEmpty(): Promise<boolean> {
    const ledger = this.ensureLedger();
    return ledger.is_empty();
  }

  /**
   * Get latest hash
   */
  async latestHash(): Promise<string | null> {
    const ledger = this.ensureLedger();
    return ledger.latest_hash();
  }
}
