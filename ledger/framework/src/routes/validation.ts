/**
 * Validation Helpers
 *
 * Utility functions for validating request data in route handlers.
 *
 * @module routes/validation
 */

import type { OidValidationOptions } from "../utils/oid-validator.js";
import { ensureOid } from "../utils/oid-validator.js";

/**
 * Validate required fields helper
 *
 * Checks if all required fields are present in the body.
 * Throws error if any field is missing.
 *
 * @param body - Request body object
 * @param fields - Array of required field names
 * @throws Error if any required field is missing
 *
 * @example
 * ```typescript
 * const body = await parseBody<{ name: string; email: string }>(req);
 * validateRequired(body, ["name", "email"]);
 * ```
 */
export function validateRequired<T extends Record<string, any>>(
  body: T,
  fields: (keyof T)[]
): void {
  const missing = fields.filter((field) => {
    const value = body[field];
    // Check if value is null, undefined, or empty string
    // But allow 0, false, and empty arrays/objects
    return value === null || value === undefined || value === "";
  });
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

/**
 * Validate OID helper
 *
 * Validates and normalizes an Onoal Identifier (OID).
 * Uses existing ensureOid from ledger-core.
 *
 * @param oid - OID string to validate
 * @param fieldName - Name of the field (for error messages)
 * @param options - Validation options
 * @returns Validated and normalized OID
 * @throws Error if OID is invalid
 *
 * @example
 * ```typescript
 * const issuerOid = validateOid(body.issuer_oid, "issuer_oid", {
 *   allowHierarchical: true,
 *   allowExternalNamespaces: true,
 * });
 * ```
 */
export function validateOid(
  oid: string,
  fieldName: string,
  options?: OidValidationOptions
): string {
  return ensureOid(oid, fieldName, options);
}

/**
 * Validate number range helper
 *
 * Checks if a number is within the specified range.
 * Throws error if value is outside range.
 *
 * @param value - Number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - Name of the field (for error messages)
 * @throws Error if value is outside range
 *
 * @example
 * ```typescript
 * validateRange(body.decimals, 0, 18, "decimals");
 * ```
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }
}
