/**
 * ACL (Access Control List) Types
 *
 * Engine-side access control types.
 */

/**
 * ACL Grant
 *
 * Represents a permission grant for a subject to access a resource.
 */
export interface Grant {
  /** Subject OID (who has access) */
  subjectOid: string;

  /** Resource OID (what they can access) */
  resourceOid: string;

  /** Action/permission (e.g., "read", "write", "admin") */
  action: string;

  /** Who granted this access */
  grantedBy: string;

  /** When this grant was created (unix timestamp in seconds) */
  grantedAt: number;

  /** Optional expiration (unix timestamp in seconds) */
  expiresAt?: number;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Check parameters
 *
 * Used to check if a requester has access to a resource.
 */
export interface CheckParams {
  /** Requester OID (who is requesting access) */
  requesterOid: string;

  /** Resource OID (what they want to access) */
  resourceOid: string;

  /** Action/permission (e.g., "read", "write", "admin") */
  action: string;
}

/**
 * Revoke parameters
 *
 * Used to revoke access from a subject.
 */
export interface RevokeParams {
  /** Subject OID (whose access to revoke) */
  subjectOid: string;

  /** Resource OID (what to revoke access to) */
  resourceOid: string;

  /** Action/permission to revoke */
  action: string;
}

/**
 * ACL Configuration
 */
export type AclConfig = "none" | "inMemory";
