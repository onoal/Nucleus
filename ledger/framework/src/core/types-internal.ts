/**
 * Internal type definitions for Ledger Framework
 *
 * These types are used internally by the framework and re-exported for convenience.
 *
 * @module core/types-internal
 */

/**
 * Ledger stream types
 */
export type LedgerStream =
  | "proofs"
  | "assets"
  | "consent"
  | "status"
  | "connect_grants"
  | "connect_events";

/**
 * Entry status
 */
export type EntryStatus = "active" | "revoked" | "used" | "suspended";

/**
 * Unified ledger entry (all streams)
 */
export interface LedgerEntry {
  /** Unique identifier */
  id: string;
  /** Stream type */
  stream: LedgerStream;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Entry payload (signed data) */
  payload: Record<string, unknown>;
  /** SHA-256 hash of (stream + id + payload) */
  hash: string;
  /** Previous entry hash (chain) */
  prev_hash: string | null;
  /** Ledger signature */
  signature: string | null;
  /** Entry status */
  status: EntryStatus;
  /** Optional metadata */
  meta?: Record<string, unknown>;
  /** Database created_at timestamp */
  created_at: number;
}

/**
 * Proof record (v2 schema)
 */
export interface ProofRecord {
  id: string;
  timestamp: number;
  subject_oid: string;
  issuer_oid: string;
  target: string;
  type: string;
  payload: unknown;
  hash: string;
  prev_hash: string | null;
  signature: string | null;
  status: EntryStatus;
  meta?: Record<string, unknown>;
  created_at: number;
}

/**
 * Asset record (v2 schema)
 */
export interface AssetRecord {
  id: string;
  type_id?: string | null;
  issuer_oid: string;
  owner_oid: string;
  subject_oid?: string | null;
  type?: string | null;
  state: string;
  status: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  asset_jwt: string;
  hash: string;
  ledger_entry_id: string;
  issued_at: number;
  created_at: number;
  updated_at: number;
}

/**
 * Chain verification result
 *
 * Enhanced with detailed error tracking and statistics for better diagnostics
 */
export interface ChainVerificationResult {
  valid: boolean;
  error?: string;
  entries_checked?: number;

  // Detailed error counters
  hash_mismatches?: number;
  signature_failures?: number;
  timestamp_issues?: number;
  payload_errors?: number;

  // Statistics
  first_entry_timestamp?: number;
  last_entry_timestamp?: number;
  verification_duration_ms?: number;

  // Detailed errors per entry
  errors?: Array<{
    entry_id: string;
    type:
      | "hash_mismatch"
      | "signature_invalid"
      | "timestamp_out_of_order"
      | "payload_invalid";
    message: string;
  }>;
}
