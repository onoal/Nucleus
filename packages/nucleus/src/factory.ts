import type {
  LedgerConfig,
  Ledger,
  LedgerRecord,
  QueryFilters,
  QueryResult,
} from "./types";
import { WasmBackend } from "./backends/wasm";

/**
 * Create a ledger instance
 */
export async function createLedger(config: LedgerConfig): Promise<Ledger> {
  // Create backend based on config
  let backend: WasmBackend;

  if (config.backend.mode === "wasm") {
    backend = new WasmBackend(config.backend, config);
    await backend.init();
  } else {
    throw new Error("HTTP backend not yet implemented");
  }

  // Create ledger wrapper
  return new LedgerImpl(config.id, backend);
}

/**
 * Ledger implementation
 */
class LedgerImpl implements Ledger {
  public readonly modules: Ledger["modules"];
  public readonly acl: Ledger["acl"];

  constructor(public readonly id: string, private backend: WasmBackend) {
    // Create modules namespace
    this.modules = {
      list: () => this.backend.listModules(),
      metadata: () => this.backend.getModuleMetadata(),
      getState: (id: string) => this.backend.getModuleState(id),
    };

    // Create ACL namespace
    this.acl = {
      grant: (grant) => this.backend.grant(grant),
      check: (params) => this.backend.checkAccess(params),
      revoke: (params) => this.backend.revoke(params),
      listGrants: (subjectOid) => this.backend.listGrants(subjectOid),
    };
  }

  async append(
    record: LedgerRecord,
    context: import("./context/types").RequestContext
  ): Promise<string> {
    return this.backend.append(record, context);
  }

  async get(hash: string): Promise<LedgerRecord | null> {
    return this.backend.get(hash);
  }

  async getById(id: string): Promise<LedgerRecord | null> {
    return this.backend.getById(id);
  }

  async query(filters: QueryFilters): Promise<QueryResult> {
    return this.backend.query(filters);
  }

  async appendBatch(
    records: LedgerRecord[],
    context: import("./context/types").RequestContext
  ): Promise<string[]> {
    return this.backend.appendBatch(records, context);
  }

  async verify(): Promise<void> {
    return this.backend.verify();
  }

  async length(): Promise<number> {
    return this.backend.length();
  }

  async isEmpty(): Promise<boolean> {
    return this.backend.isEmpty();
  }

  async latestHash(): Promise<string | null> {
    return this.backend.latestHash();
  }

  async hasStorage(): Promise<boolean> {
    return this.backend.hasStorage();
  }

  async verifyStorage(): Promise<boolean> {
    return this.backend.verifyStorage();
  }
}
