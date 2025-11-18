/**
 * Ambient type declarations for @onoal/nucleus-wasm
 * These types are provided at runtime by the WASM package
 */

declare module "@onoal/nucleus-wasm" {
  import type { LedgerRecord, QueryFilters, QueryResult } from "../record";

  export interface LedgerConfig {
    id: string;
    modules: Array<{
      id: string;
      version: string;
      config: Record<string, unknown>;
    }>;
    options?: {
      strict_validation?: boolean;
      max_entries?: number;
      enable_metrics?: boolean;
    };
  }

  export class WasmLedger {
    constructor(config: LedgerConfig);
    readonly id: string;
    append_record(record: LedgerRecord): string;
    get_record(hash: string): LedgerRecord | null;
    get_record_by_id(id: string): LedgerRecord | null;
    verify(): void;
    query(filters: QueryFilters): QueryResult;
    append_batch(records: LedgerRecord[]): string[];
    len(): number;
    is_empty(): boolean;
    latest_hash(): string | null;
  }

  export default function init(): Promise<void>;
}
