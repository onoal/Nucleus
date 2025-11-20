/**
 * Module runtime interface for Nucleus
 */

import type { NucleusRecord, ValidationResult, ValidationContext } from "./core.js";

/**
 * Module runtime: validates records according to module-specific rules
 * 
 * Each module implements this interface to provide validation logic
 * that runs during append operations.
 */
export interface ModuleRuntime {
  /**
   * Validate a record before it's stored
   * 
   * @param input Validation input
   * @returns Validation result (ok: true if valid, ok: false with error details if invalid)
   */
  validateRecord(input: {
    /** Record to validate (already has hash computed) */
    record: NucleusRecord;
    
    /** Previous record in chain (null for genesis) */
    prevRecord: NucleusRecord | null;
    
    /** Execution context */
    context: ValidationContext;
  }): Promise<ValidationResult>;
}

/**
 * Error thrown when module is not registered
 */
export class ModuleNotFoundError extends Error {
  constructor(moduleName: string) {
    super(`Module not registered: ${moduleName}`);
    this.name = "ModuleNotFoundError";
  }
}

/**
 * Error thrown when module validation fails
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

