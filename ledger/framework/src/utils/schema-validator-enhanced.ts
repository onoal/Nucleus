/**
 * Enhanced Schema Validator for Ledger Framework
 *
 * Wrapper around the core validation utilities that converts
 * SchemaDefinition to ValidationSchema format.
 *
 * @module utils/schema-validator-enhanced
 */

import type { SchemaDefinition } from "../core/types.js";
import {
  validateSchema,
  validateSchemaOrThrow,
  type ValidationSchema,
  type ValidationResult as CoreValidationResult,
} from "@onoal/core";

/**
 * Convert SchemaDefinition to ValidationSchema format
 */
function convertSchemaDefinition(
  schema: SchemaDefinition[string]
): ValidationSchema {
  return {
    type: "object",
    required: schema.required,
    properties: Object.fromEntries(
      Object.entries(schema.properties || {}).map(([key, field]) => [
        key,
        {
          type: field.type as
            | "string"
            | "number"
            | "boolean"
            | "date"
            | "bigint"
            | "json"
            | "integer"
            | "array"
            | "object",
          ...(field.format && { format: field.format }),
          ...(field.pattern && { pattern: field.pattern }),
          ...(field.default !== undefined && { default: field.default }),
        } as any, // Type assertion needed due to type mismatch between SchemaDefinition and ValidationFieldSchema
      ])
    ),
  };
}

/**
 * Validate payload against schema definition by type
 * Uses the new core validation utilities with field-level errors
 *
 * @param payload - Payload to validate
 * @param type - Entry type
 * @param schemas - Schema definitions
 * @returns Validation result with field-level errors
 */
export function validateSchemaByType(
  payload: unknown,
  type: string,
  schemas: SchemaDefinition
): CoreValidationResult {
  const schema = schemas[type];
  if (!schema) {
    return {
      valid: false,
      errors: [
        {
          field: "root",
          message: `No schema definition found for type: ${type}`,
          code: "SCHEMA_NOT_FOUND",
        },
      ],
    };
  }

  const validationSchema = convertSchemaDefinition(schema);
  return validateSchema(validationSchema, payload);
}
