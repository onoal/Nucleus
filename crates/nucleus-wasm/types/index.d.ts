/**
 * Nucleus WASM - TypeScript type definitions
 */

export interface LedgerConfig {
  id: string;
  modules: ModuleConfig[];
  options?: ConfigOptions;
}

export interface ConfigOptions {
  strict_validation?: boolean;
  max_entries?: number;
  enable_metrics?: boolean;
}

export interface ModuleConfig {
  id: string;
  version: string;
  config: Record<string, unknown>;
}

export interface Record {
  id: string;
  stream: string;
  timestamp: number;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface QueryFilters {
  stream?: string;
  id?: string;
  limit?: number;
  offset?: number;
  timestamp_from?: number;
  timestamp_to?: number;
  module_filters?: Record<string, unknown>;
}

export interface QueryResult {
  records: Record[];
  total: number;
  has_more: boolean;
}

export class WasmLedger {
  constructor(config: LedgerConfig);

  readonly id: string;

  append_record(record: Record): string;
  get_record(hash: string): Record | null;
  get_record_by_id(id: string): Record | null;
  verify(): void;
  query(filters: QueryFilters): QueryResult;
  append_batch(records: Record[]): string[];
  len(): number;
  is_empty(): boolean;
  latest_hash(): string | null;
}

export class WasmRecord {
  constructor(
    id: string,
    stream: string,
    timestamp: number,
    payload: Record<string, unknown>
  );

  static with_meta(
    id: string,
    stream: string,
    timestamp: number,
    payload: Record<string, unknown>,
    meta: Record<string, unknown>
  ): WasmRecord;

  validate(): void;
  to_json(): Record<string, unknown>;
}
