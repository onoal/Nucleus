/**
 * Type exports
 */

export type {
  LedgerRecord,
  RecordPayload,
  RecordMetadata,
  QueryFilters,
  QueryResult,
} from "./record";

// Re-export as Record for convenience (but use LedgerRecord internally)
export type { LedgerRecord as Record } from "./record";

export type {
  ModuleConfig,
  ModuleFactory,
  AssetModuleConfig,
  ProofModuleConfig,
} from "./module";

export type {
  BackendMode,
  BackendConfig,
  WasmBackendConfig,
  HttpBackendConfig,
} from "./backend";

export type {
  LedgerConfig,
  LedgerOptions,
  Ledger,
  StorageConfig,
} from "./ledger";
