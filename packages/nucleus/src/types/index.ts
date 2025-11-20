/**
 * Type definitions for Nucleus ledger system
 */

// Core types
export type {
  ModuleName,
  NucleusRecord,
  AppendInput,
  AppendContext,
  GetChainOpts,
  ValidationResult,
  ValidationContext,
} from "./core.js";

export { NUCLEUS_SCHEMA_VERSION, isNucleusRecord } from "./core.js";

// Storage types
export type { RecordStore } from "./storage.js";
export { StorageConstraintError } from "./storage.js";

// Module types
export type { ModuleRuntime } from "./module.js";
export { ModuleNotFoundError, ValidationError } from "./module.js";

