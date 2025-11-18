/**
 * Internal exports for Ledger Framework
 *
 * Re-exports of core components for backward compatibility.
 * All code is now local to the framework (no dependency on onoal/ledger).
 *
 * @module internal
 */

// Core ledger operations (now local)
export { LedgerCore } from "../core/ledger-core.js";
export { HashChain } from "../core/hash-chain.js";
export { LedgerSigner } from "../core/signer.js";

// Database schema (now local)
export { schema } from "../core/schema.js";
export {
  ledgerEntriesSqlite,
  ledgerTipSqlite,
  ledgerCheckpointsSqlite,
  ledgerEntriesPg,
  ledgerTipPg,
  ledgerCheckpointsPg,
} from "../core/schema.js";
export type { LedgerDb } from "../core/db.js";

// Types (now local)
export type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
  ProofRecord,
  AssetRecord,
  ChainVerificationResult,
} from "../core/types-internal.js";
