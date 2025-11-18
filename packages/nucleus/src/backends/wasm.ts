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
        storage: this.ledgerConfig.storage
          ? this.convertStorageConfig(this.ledgerConfig.storage)
          : { None: null },
      };

      // Validate storage config for WASM
      if (
        this.ledgerConfig.storage &&
        this.ledgerConfig.storage.type !== "none"
      ) {
        console.warn(
          `[nucleus] Storage type '${this.ledgerConfig.storage.type}' is not supported in WASM. ` +
            `Falling back to in-memory mode. Use native Node.js backend for persistent storage.`
        );
      }

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

  private convertStorageConfig(storage: CoreLedgerConfig["storage"]): any {
    if (!storage) {
      return { None: null };
    }

    switch (storage.type) {
      case "none":
        return { None: null };
      case "sqlite":
        return { Sqlite: { path: storage.path } };
      case "postgres":
        return { Postgres: { connection_string: storage.connectionString } };
      default:
        return { None: null };
    }
  }

  /**
   * Append a record
   */
  async append(
    record: LedgerRecord,
    context: import("../context/types").RequestContext
  ): Promise<string> {
    const ledger = this.ensureLedger();

    // Convert TypeScript context to Rust-compatible format
    const rustContext = {
      requester_oid: context.requesterOid,
      metadata: context.metadata || null,
      timestamp: context.timestamp || Date.now(),
    };

    return ledger.append_record(record, rustContext);
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
  async appendBatch(
    records: LedgerRecord[],
    context: import("../context/types").RequestContext
  ): Promise<string[]> {
    const ledger = this.ensureLedger();

    // Convert TypeScript context to Rust-compatible format
    const rustContext = {
      requester_oid: context.requesterOid,
      metadata: context.metadata || null,
      timestamp: context.timestamp || Date.now(),
    };

    return ledger.append_batch(records, rustContext);
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

  /**
   * Check if storage is enabled
   *
   * **Note**: Always returns false in WASM (browser) environments.
   * Storage is only supported in native Node.js with Rust backend.
   */
  async hasStorage(): Promise<boolean> {
    const ledger = this.ensureLedger();
    return ledger.has_storage();
  }

  /**
   * Verify storage integrity
   *
   * **Note**: Always returns false in WASM (browser) environments.
   * Storage verification is only available in native Node.js with Rust backend.
   */
  async verifyStorage(): Promise<boolean> {
    const ledger = this.ensureLedger();
    return ledger.verify_storage();
  }

  /**
   * List all module IDs
   */
  async listModules(): Promise<string[]> {
    const ledger = this.ensureLedger();
    return ledger.list_modules();
  }

  /**
   * Get module metadata
   */
  async getModuleMetadata(): Promise<any[]> {
    const ledger = this.ensureLedger();
    return ledger.get_module_metadata();
  }

  /**
   * Get module state by ID
   */
  async getModuleState(id: string): Promise<string | null> {
    const ledger = this.ensureLedger();
    return ledger.get_module_state(id);
  }

  /**
   * Grant ACL access
   */
  async grant(grant: import("../types").Grant): Promise<void> {
    const ledger = this.ensureLedger();

    // Convert to Rust snake_case format
    const rustGrant = {
      subject_oid: grant.subjectOid,
      resource_oid: grant.resourceOid,
      action: grant.action,
      granted_by: grant.grantedBy,
      granted_at: grant.grantedAt,
      expires_at: grant.expiresAt || null,
      metadata: grant.metadata ? JSON.stringify(grant.metadata) : null,
    };

    return ledger.grant(rustGrant);
  }

  /**
   * Check ACL access
   */
  async checkAccess(params: import("../types").CheckParams): Promise<boolean> {
    const ledger = this.ensureLedger();

    // Convert to Rust snake_case format
    const rustParams = {
      requester_oid: params.requesterOid,
      resource_oid: params.resourceOid,
      action: params.action,
    };

    return ledger.check_access(rustParams);
  }

  /**
   * Revoke ACL access
   */
  async revoke(params: import("../types").RevokeParams): Promise<void> {
    const ledger = this.ensureLedger();

    // Convert to Rust snake_case format
    const rustParams = {
      subject_oid: params.subjectOid,
      resource_oid: params.resourceOid,
      action: params.action,
    };

    return ledger.revoke(rustParams);
  }

  /**
   * List all grants for a subject
   */
  async listGrants(subjectOid: string): Promise<import("../types").Grant[]> {
    const ledger = this.ensureLedger();
    const rustGrants = await ledger.list_grants(subjectOid);

    // Convert from Rust snake_case to TypeScript camelCase
    return rustGrants.map((g: any) => ({
      subjectOid: g.subject_oid,
      resourceOid: g.resource_oid,
      action: g.action,
      grantedBy: g.granted_by,
      grantedAt: g.granted_at,
      expiresAt: g.expires_at || undefined,
      metadata: g.metadata ? JSON.parse(g.metadata) : undefined,
    }));
  }
}
