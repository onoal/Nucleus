/**
 * Unified Access Layer (UAL) Interface
 *
 * Based on: onoal/ledger/src/ual/index.ts
 * Provides ACL grants and checks for ledger resources
 *
 * @module core/ual
 */

/**
 * ACL Grant definition
 */
export interface ACLGrant {
  resourceKind: "proof" | "asset" | "connect_grant" | "token";
  resourceId: string;
  principalOid: string;
  scope: "read" | "write" | "full";
  grantedBy: string;
  exp?: number; // Optional expiration timestamp (Unix seconds)
}

/**
 * Resource predicate for UAL operations
 */
export interface ResourcePredicate {
  kind: "proof" | "asset" | "connect_grant" | "token";
  id?: string;
  subjectOid?: string;
  issuerOid?: string;
  status?: string;
  type?: string;
}

/**
 * Unified Access Layer Interface
 *
 * Provides ACL grants and checks for ledger resources.
 * This is an optional service - the framework works without it,
 * but with UAL you get enterprise features like ACL checks.
 *
 * Based on: onoal/ledger/src/ual/index.ts
 */
export interface UnifiedAccessLayer {
  /**
   * Grant ACL permissions
   *
   * Grants access permissions to principals for resources.
   * Uses onConflictDoNothing for idempotency.
   *
   * Based on: onoal/ledger/src/ual/index.ts:grant()
   *
   * @param grants - Array of ACL grants to create
   */
  grant(grants: ACLGrant[]): Promise<void>;

  /**
   * Check if principal has access to resource
   *
   * Returns true if principal has the required action permission.
   *
   * Based on: onoal/ledger/src/ual/index.ts:check()
   *
   * @param principalOid - Principal OID to check
   * @param action - Required action (read, write, full)
   * @param resource - Resource predicate
   * @returns True if access is granted
   */
  check(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<boolean>;

  /**
   * Require access (throws if no access)
   *
   * Returns the resource if access is granted, throws error otherwise.
   *
   * Based on: onoal/ledger/src/ual/index.ts:require()
   *
   * @param principalOid - Principal OID to check
   * @param action - Required action (read, write, full)
   * @param resource - Resource predicate
   * @returns Resource data if access is granted
   * @throws Error if access is denied
   */
  require(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<any>;

  /**
   * List resources with ACL filtering
   *
   * Returns only resources that the principal has access to.
   *
   * Based on: onoal/ledger/src/ual/index.ts:list()
   *
   * @param principalOid - Principal OID to filter for
   * @param filters - Resource filters
   * @returns Filtered resources with pagination
   */
  list(
    principalOid: string,
    filters: {
      kind: "proof" | "asset" | "connect_grant" | "token";
      subjectOid?: string;
      issuerOid?: string;
      status?: string;
      type?: string;
      limit?: number;
      cursor?: number;
    }
  ): Promise<{
    items: any[];
    hasMore: boolean;
    nextCursor?: number;
  }>;
}
