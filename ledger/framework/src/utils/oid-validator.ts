/**
 * OID (Object Identifier) Validator
 *
 * Supports hierarchical OIDs and external namespaces:
 * - Hierarchical: oid:onoal:org:id:user:id, oid:onoal:org:id:service:id
 * - External namespaces: oid:identis:eigen:types, oid:custom:namespace:types
 *
 * Based on: onoal/ledger/src/lib/validation.ts
 * Extended for hierarchical and multi-namespace support
 *
 * @module utils/oid-validator
 */

/**
 * Validation error for OID validation
 */
export class OidValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "OidValidationError";
  }
}

/**
 * Parsed OID structure
 */
export interface ParsedOid {
  namespace: string; // e.g., "onoal", "identis"
  type: string; // e.g., "user", "org", "eigen"
  id: string; // Single ID or hierarchical path
  path?: string[]; // For hierarchical OIDs: ["org", "id", "user", "id"]
  raw: string; // Original OID string
  isHierarchical: boolean; // True if OID has sub-paths
}

/**
 * OID validation options
 */
export interface OidValidationOptions {
  /**
   * Allowed namespaces (default: ["onoal"])
   * Empty array means all namespaces are allowed
   */
  allowedNamespaces?: string[];

  /**
   * Allowed types for onoal namespace (default: all known types)
   * Empty array means all types are allowed
   */
  allowedTypes?: string[];

  /**
   * Allow hierarchical OIDs (default: true)
   * Hierarchical: oid:onoal:org:id:user:id
   */
  allowHierarchical?: boolean;

  /**
   * Allow external namespaces (default: true)
   * External: oid:identis:eigen:types
   */
  allowExternalNamespaces?: boolean;

  /**
   * Minimum ID length (default: 1)
   */
  minIdLength?: number;

  /**
   * Maximum ID length (default: 256)
   */
  maxIdLength?: number;
}

/**
 * OID format regex patterns
 *
 * Format: oid:<namespace>:<type>:<id>[:<subtype>:<subid>]*
 *
 * Examples:
 * - Simple: oid:onoal:user:alice123
 * - Hierarchical: oid:onoal:org:company-id:user:employee-id
 * - External: oid:identis:eigen:types
 * - Hierarchical external: oid:custom:org:org-id:service:service-id
 */

// Base pattern: oid:<namespace>:<type>:<id>
// Namespace: lowercase alphanumeric + hyphens (min 1 char)
// Type: lowercase alphanumeric + hyphens (min 1 char)
// ID: alphanumeric + special chars (min 1 char)
const OID_BASE_PATTERN =
  /^oid:([a-z0-9-]+):([a-z0-9-]+):([A-Za-z0-9._:\-+=\/]+)/;

// Hierarchical pattern: allows multiple :<subtype>:<subid> pairs
const OID_HIERARCHICAL_PATTERN =
  /^oid:([a-z0-9-]+):([a-z0-9-]+):([A-Za-z0-9._:\-+=\/]+)(?::([a-z0-9-]+):([A-Za-z0-9._:\-+=\/]+))*$/;

/**
 * Valid OID types for onoal namespace
 */
const ONOAL_TYPES = [
  "human",
  "user",
  "org",
  "organization",
  "key",
  "service",
  "app",
] as const;

/**
 * Parse an OID string into its components
 *
 * @param oid - OID string to parse
 * @returns Parsed OID structure
 * @throws {OidValidationError} If the OID format is invalid
 *
 * @example
 * ```typescript
 * // Simple OID
 * const parsed = parseOid("oid:onoal:user:alice123");
 * // { namespace: "onoal", type: "user", id: "alice123", isHierarchical: false }
 *
 * // Hierarchical OID
 * const parsed = parseOid("oid:onoal:org:company-id:user:employee-id");
 * // { namespace: "onoal", type: "org", id: "company-id", path: ["org", "company-id", "user", "employee-id"], isHierarchical: true }
 *
 * // External namespace
 * const parsed = parseOid("oid:identis:eigen:types");
 * // { namespace: "identis", type: "eigen", id: "types", isHierarchical: false }
 * ```
 */
export function parseOid(oid: string): ParsedOid {
  if (typeof oid !== "string") {
    throw new OidValidationError("OID must be a string");
  }

  const trimmed = oid.trim();
  if (trimmed.length === 0) {
    throw new OidValidationError("OID cannot be empty");
  }

  // Try hierarchical pattern first (has multiple :<subtype>:<subid> pairs)
  const hierarchicalMatch = OID_HIERARCHICAL_PATTERN.exec(trimmed);
  if (hierarchicalMatch) {
    const namespace = hierarchicalMatch[1];
    const type = hierarchicalMatch[2];
    const firstId = hierarchicalMatch[3];

    if (!namespace || !type || !firstId) {
      throw new OidValidationError("Invalid OID format - missing components");
    }

    // Extract all path segments by splitting on ':'
    // Format: oid:namespace:type:id:subtype:subid:subtype2:subid2
    const parts = trimmed.split(":");
    if (parts.length < 4 || parts[0] !== "oid") {
      throw new OidValidationError("Invalid OID format");
    }

    // parts[0] = "oid"
    // parts[1] = namespace
    // parts[2] = type
    // parts[3] = id
    // parts[4+] = alternating subtype:subid pairs

    const typePart = parts[2];
    const idPart = parts[3];

    if (!typePart || !idPart) {
      throw new OidValidationError("Invalid OID format - missing type or id");
    }

    const path: string[] = [typePart, idPart]; // type, id
    const isHierarchical = parts.length > 4;

    // Add hierarchical pairs
    if (isHierarchical) {
      for (let i = 4; i < parts.length; i += 2) {
        const subtype = parts[i];
        const subid = parts[i + 1];
        if (subtype && subid) {
          path.push(subtype, subid); // subtype, subid
        }
      }
    }

    return {
      namespace,
      type,
      id: firstId,
      path: isHierarchical ? path : undefined,
      raw: trimmed,
      isHierarchical,
    };
  }

  // Fallback to base pattern
  const baseMatch = OID_BASE_PATTERN.exec(trimmed);
  if (!baseMatch) {
    throw new OidValidationError(
      `Invalid OID format. Expected: oid:<namespace>:<type>:<id>[:<subtype>:<subid>]*`
    );
  }

  const namespace = baseMatch[1];
  const type = baseMatch[2];
  const id = baseMatch[3];

  if (!namespace || !type || !id) {
    throw new OidValidationError("Invalid OID format - missing components");
  }

  return {
    namespace,
    type,
    id,
    raw: trimmed,
    isHierarchical: false,
  };
}

/**
 * Validate an OID string
 *
 * @param oid - OID string to validate
 * @param options - Validation options
 * @returns True if valid, throws OidValidationError if invalid
 *
 * @example
 * ```typescript
 * // Basic validation
 * validateOid("oid:onoal:user:alice123");
 *
 * // With options
 * validateOid("oid:identis:eigen:types", {
 *   allowExternalNamespaces: true,
 *   allowHierarchical: true,
 * });
 * ```
 */
export function validateOid(
  oid: string,
  options: OidValidationOptions = {}
): void {
  const {
    allowedNamespaces = ["onoal"],
    allowedTypes = [],
    allowHierarchical = true,
    allowExternalNamespaces = true,
    minIdLength = 1,
    maxIdLength = 256,
  } = options;

  let parsed: ParsedOid;
  try {
    parsed = parseOid(oid);
  } catch (error) {
    if (error instanceof OidValidationError) {
      throw error;
    }
    throw new OidValidationError(
      `Invalid OID format: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate namespace
  if (
    allowedNamespaces.length > 0 &&
    !allowedNamespaces.includes(parsed.namespace)
  ) {
    throw new OidValidationError(
      `Namespace '${parsed.namespace}' not allowed. Allowed: ${allowedNamespaces.join(", ")}`
    );
  }

  // Validate external namespaces
  if (!allowExternalNamespaces && parsed.namespace !== "onoal") {
    throw new OidValidationError(
      `External namespaces not allowed. Only 'onoal' namespace is permitted.`
    );
  }

  // Validate hierarchical OIDs
  if (!allowHierarchical && parsed.isHierarchical) {
    throw new OidValidationError("Hierarchical OIDs not allowed");
  }

  // Validate onoal namespace types
  if (parsed.namespace === "onoal") {
    if (allowedTypes.length > 0 && !allowedTypes.includes(parsed.type)) {
      throw new OidValidationError(
        `Type '${parsed.type}' not allowed for onoal namespace. Allowed: ${allowedTypes.join(", ")}`
      );
    }

    // Default validation: check against known onoal types
    if (
      allowedTypes.length === 0 &&
      !ONOAL_TYPES.includes(parsed.type as any)
    ) {
      // Warn but don't fail for unknown types (for extensibility)
      // Could be a new type or hierarchical OID
    }
  }

  // Validate ID length
  if (parsed.id.length < minIdLength) {
    throw new OidValidationError(
      `ID must be at least ${minIdLength} characters long`
    );
  }

  if (parsed.id.length > maxIdLength) {
    throw new OidValidationError(`ID exceeds maximum length of ${maxIdLength}`);
  }

  // Validate hierarchical path IDs
  if (parsed.path) {
    for (let i = 1; i < parsed.path.length; i += 2) {
      // Every odd index is an ID
      const pathId = parsed.path[i];
      if (!pathId) {
        continue; // Skip if undefined
      }
      if (pathId.length < minIdLength) {
        throw new OidValidationError(
          `Hierarchical path ID at position ${i} must be at least ${minIdLength} characters long`
        );
      }
      if (pathId.length > maxIdLength) {
        throw new OidValidationError(
          `Hierarchical path ID at position ${i} exceeds maximum length of ${maxIdLength}`
        );
      }
    }
  }
}

/**
 * Ensure a value is a valid OID
 *
 * Validates and returns the OID string, or throws an error.
 *
 * @param value - Value to validate
 * @param field - Field name for error messages
 * @param options - Validation options
 * @returns Validated OID string
 * @throws {OidValidationError} If validation fails
 *
 * @example
 * ```typescript
 * const oid = ensureOid(body.subject_oid, "subject_oid");
 * const hierarchicalOid = ensureOid(
 *   body.org_user_oid,
 *   "org_user_oid",
 *   { allowHierarchical: true }
 * );
 * ```
 */
export function ensureOid(
  value: unknown,
  field: string,
  options: OidValidationOptions = {}
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new OidValidationError(`${field} must be a non-empty string`, field);
  }

  const trimmed = value.trim();

  try {
    validateOid(trimmed, options);
  } catch (error) {
    if (error instanceof OidValidationError) {
      throw new OidValidationError(
        `${field} must be a valid OID: ${error.message}`,
        field
      );
    }
    throw error;
  }

  return trimmed;
}

/**
 * Check if an OID is hierarchical
 *
 * @param oid - OID string to check
 * @returns True if OID is hierarchical
 */
export function isHierarchicalOid(oid: string): boolean {
  try {
    const parsed = parseOid(oid);
    return parsed.isHierarchical;
  } catch {
    return false;
  }
}

/**
 * Check if an OID uses an external namespace
 *
 * @param oid - OID string to check
 * @returns True if OID uses external namespace (not "onoal")
 */
export function isExternalNamespace(oid: string): boolean {
  try {
    const parsed = parseOid(oid);
    return parsed.namespace !== "onoal";
  } catch {
    return false;
  }
}

/**
 * Extract parent OID from hierarchical OID
 *
 * @param oid - Hierarchical OID
 * @returns Parent OID or null if not hierarchical
 *
 * @example
 * ```typescript
 * const parent = getParentOid("oid:onoal:org:company-id:user:employee-id");
 * // Returns: "oid:onoal:org:company-id"
 * ```
 */
export function getParentOid(oid: string): string | null {
  try {
    const parsed = parseOid(oid);
    if (!parsed.isHierarchical || !parsed.path) {
      return null;
    }

    // Return first two segments: namespace:type:id
    return `oid:${parsed.namespace}:${parsed.path[0]}:${parsed.path[1]}`;
  } catch {
    return null;
  }
}

/**
 * Extract root OID from hierarchical OID
 *
 * @param oid - Hierarchical OID
 * @returns Root OID (first type:id pair)
 *
 * @example
 * ```typescript
 * const root = getRootOid("oid:onoal:org:company-id:user:employee-id");
 * // Returns: "oid:onoal:org:company-id"
 * ```
 */
export function getRootOid(oid: string): string {
  try {
    const parsed = parseOid(oid);
    return `oid:${parsed.namespace}:${parsed.type}:${parsed.id}`;
  } catch {
    return oid; // Return original if parsing fails
  }
}
