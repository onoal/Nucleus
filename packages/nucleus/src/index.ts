/**
 * @onoal/nucleus - Minimal ledger system for OID-based verifiable records
 *
 * @packageDocumentation
 */

// Core exports
export {
  Nucleus,
  createNucleus,
  registerModule,
  getModule,
  hasModule,
  getRegisteredModules,
} from "./core/index.js";

export type { CreateNucleusConfig, ComputeHashFn } from "./core/index.js";

// Type exports
export type {
  NucleusRecord,
  AppendInput,
  AppendContext,
  GetChainOpts,
  ValidationResult,
  ValidationContext,
  RecordStore,
  ModuleRuntime,
  ModuleName,
} from "./types/index.js";

export {
  NUCLEUS_SCHEMA_VERSION,
  isNucleusRecord,
  StorageConstraintError,
  ModuleNotFoundError,
  ValidationError,
} from "./types/index.js";

// Module exports
export { proofModule, ProofModuleRuntime } from "./modules/proof/index.js";
export type { ProofBody, IssuerProof } from "./modules/proof/index.js";
export { generateProofChainId } from "./modules/proof/index.js";

export { oidModule, OidModuleRuntime } from "./modules/oid/index.js";
export type {
  OidBody,
  OidRecord,
  OidKey,
  OidProof,
  OidKind,
  ParsedOid,
} from "./modules/oid/index.js";
export { generateOidChainId, parseOid } from "./modules/oid/index.js";
