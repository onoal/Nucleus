/**
 * Validation utilities for mesh network
 *
 * Provides validation functions for mesh messages and requests.
 *
 * @module utils/validation
 */

import type { CrossLedgerQuery, EntrySync } from "../types.js";

/**
 * Validate UUID format
 *
 * @param uuid - UUID string to validate
 * @returns True if valid UUID, false otherwise
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validate cross-ledger query
 *
 * Validates a cross-ledger query request.
 *
 * @param query - Query to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const validation = validateQuery(query);
 * if (!validation.valid) {
 *   throw new Error(validation.error);
 * }
 * ```
 */
export function validateQuery(query: CrossLedgerQuery): ValidationResult {
  // Validate query ID
  if (!query.queryId || !isValidUUID(query.queryId)) {
    return { valid: false, error: "Invalid queryId" };
  }

  // Validate ledger IDs
  if (!query.fromLedgerId || !query.toLedgerId) {
    return { valid: false, error: "Missing ledger IDs" };
  }

  // Validate filters
  if (query.filters.limit && query.filters.limit > 100) {
    return { valid: false, error: "Limit cannot exceed 100" };
  }

  // Validate signature
  if (!query.signature) {
    return { valid: false, error: "Missing signature" };
  }

  return { valid: true };
}

/**
 * Validate entry sync
 *
 * Validates an entry synchronization request.
 *
 * @param sync - Sync request to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const validation = validateSync(sync);
 * if (!validation.valid) {
 *   throw new Error(validation.error);
 * }
 * ```
 */
export function validateSync(sync: EntrySync): ValidationResult {
  // Validate sync ID
  if (!sync.syncId || !isValidUUID(sync.syncId)) {
    return { valid: false, error: "Invalid syncId" };
  }

  // Validate ledger IDs
  if (!sync.fromLedgerId || !sync.toLedgerId) {
    return { valid: false, error: "Missing ledger IDs" };
  }

  // Validate timestamp
  if (sync.filters.since && sync.filters.since < 0) {
    return { valid: false, error: "Invalid since timestamp" };
  }

  return { valid: true };
}
