/**
 * Schema Validator for Ledger Framework
 *
 * Validates ledger entry payloads against JSON Schema definitions.
 * Supports custom formats (OID, date-time) and TypeScript type inference.
 *
 * @module utils/schema-validator
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { SchemaDefinition } from "../core/types.js";

// Initialize Ajv with all errors and strict mode
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

// Custom format: OID (Object Identifier)
// Format: oid:<namespace>:<type>:<id>[:<subtype>:<subid>]*
// Supports hierarchical OIDs and external namespaces
import { validateOid } from "./oid-validator.js";

ajv.addFormat("oid", {
  type: "string",
  validate: (oid: string) => {
    try {
      validateOid(oid, {
        allowHierarchical: true,
        allowExternalNamespaces: true,
      });
      return true;
    } catch {
      return false;
    }
  },
});

// Custom format: timestamp (Unix timestamp in milliseconds)
ajv.addFormat("timestamp", {
  type: "number",
  validate: (timestamp: number) => {
    return (
      typeof timestamp === "number" &&
      timestamp > 0 &&
      timestamp <= Number.MAX_SAFE_INTEGER
    );
  },
});

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate payload against schema
 *
 * @param payload - Payload to validate
 * @param schema - JSON Schema definition
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: "object",
 *   required: ["subject_oid", "age"],
 *   properties: {
 *     subject_oid: { type: "string", format: "oid" },
 *     age: { type: "number", minimum: 0, maximum: 150 },
 *   },
 * };
 *
 * const result = validateSchema(
 *   { subject_oid: "oid:onoal:user:123", age: 25 },
 *   schema
 * );
 *
 * if (!result.valid) {
 *   console.error("Validation errors:", result.errors);
 * }
 * ```
 */
export function validateSchema(
  payload: unknown,
  schema: SchemaDefinition[string]
): ValidationResult {
  try {
    const validate = ajv.compile(schema);
    const valid = validate(payload);

    if (!valid) {
      const errorMessages =
        validate.errors?.map((e: any) => {
          const path = e.instancePath || "/";
          const message = e.message || "Validation failed";
          const paramsStr = e.params
            ? " (" + JSON.stringify(e.params) + ")"
            : "";
          return path + " " + message + paramsStr;
        }) || [];

      return {
        valid: false,
        errors: errorMessages,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [
        error instanceof Error
          ? `Schema compilation error: ${error.message}`
          : "Unknown schema compilation error",
      ],
    };
  }
}

/**
 * Validate payload against schema definition by type
 *
 * @param payload - Payload to validate
 * @param type - Entry type
 * @param schemas - Schema definitions
 * @returns Validation result
 */
export function validateSchemaByType(
  payload: unknown,
  type: string,
  schemas: SchemaDefinition
): ValidationResult {
  const schema = schemas[type];
  if (!schema) {
    return {
      valid: false,
      errors: [`No schema definition found for type: ${type}`],
    };
  }

  return validateSchema(payload, schema);
}

/**
 * Infer TypeScript type from schema
 *
 * This is a helper type for compile-time type inference.
 * Runtime validation is done by validateSchema().
 */
export type InferSchemaType<T> = T extends {
  type: "object";
  properties: infer P;
  required?: infer R;
}
  ? {
      [K in keyof P]: P[K] extends { type: "string" }
        ? string
        : P[K] extends { type: "number" }
          ? number
          : P[K] extends { type: "boolean" }
            ? boolean
            : P[K] extends { type: "array" }
              ? unknown[]
              : unknown;
    } & (R extends readonly (infer U)[]
      ? U extends keyof P
        ? {
            [K in U]-?: P[K] extends { type: "string" }
              ? string
              : P[K] extends { type: "number" }
                ? number
                : P[K] extends { type: "boolean" }
                  ? boolean
                  : unknown;
          }
        : {}
      : {})
  : never;
