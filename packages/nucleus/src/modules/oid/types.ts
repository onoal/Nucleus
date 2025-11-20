/**
 * Types for oid module
 *
 * The oid module handles anchoring of OID records per namespace in Nucleus.
 * It provides an integrity layer on top of OID storage.
 */

// Import official OID types and functions from @onoal/oid-core
import type { OidRecord, OidKey, OidProof, OidKind } from "@onoal/oid-core";
import { Oid } from "@onoal/oid-core";

// Re-export official types for convenience
export type { OidRecord, OidKey, OidProof, OidKind };

/**
 * OID record body
 *
 * Wraps a complete OID Core Record for anchoring in Nucleus
 */
export interface OidBody {
  /** Complete OID record (oid-core/v0.1.1 format) */
  oidRecord: OidRecord;
}

/**
 * Recommended chainId pattern for OID records
 *
 * Pattern: `oid:{namespace}:{base64url(oid)}`
 *
 * This creates one chain per OID, making it easy to track the
 * complete history of an OID (creation, key rotations, updates).
 *
 * @param oid OID string
 * @returns Recommended chainId
 *
 * @example
 * ```typescript
 * const chainId = generateOidChainId('oid:onoal:user:abc123');
 * // => "oid:onoal:b25vYWw6dXNlcjphYmMxMjM"
 * ```
 */
export function generateOidChainId(oid: string): string {
  // Extract namespace from OID (oid:namespace:type:id)
  const parts = oid.split(":");
  if (parts.length < 2) {
    throw new Error(`Invalid OID format: ${oid}`);
  }

  const namespace = parts[1];

  // Base64url encode the full OID (without padding)
  const encoded = Buffer.from(oid, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `oid:${namespace}:${encoded}`;
}

/**
 * Parsed OID structure
 *
 * Re-export from @onoal/oid-core
 */
export interface ParsedOid {
  namespace: string;
  type: string;
  identifier: string;
}

/**
 * Parse OID string
 *
 * Uses official @onoal/oid-core parser
 */
export function parseOid(oid: string): ParsedOid {
  try {
    const parsed = Oid.parse(oid);

    // Convert to our ParsedOid format
    // Official format: { namespace, segments: [...] }
    // Our format: { namespace, type, identifier }
    const segments = parsed.segments || [];

    return {
      namespace: parsed.namespace,
      type: segments[0] || "",
      identifier: segments[1] || "",
    };
  } catch (error) {
    throw new Error(`Invalid OID format: ${oid}`);
  }
}
