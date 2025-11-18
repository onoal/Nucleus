/**
 * Connect Service for Ledger Framework
 *
 * Provides connect grant creation and querying functionality.
 * Based on: onoal/ledger/src/routes/connect.ts and onoal/ledger/src/lib/connect-events.ts
 *
 * @module services/connect-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
  UnifiedAccessLayer,
} from "@onoal/ledger-core";

/**
 * Create connect grant options
 */
export interface CreateGrantOptions {
  app_oid: string;
  subject_oid: string;
  scopes: string[];
  controller_oid?: string; // For org↔org contracts
  resource?: string; // Per-resource scoping
  policy?: string; // Policy document reference
  lawful_basis?: string; // GDPR compliance
  ttl_caps?: Record<string, number>; // Per-resource TTL limits
  exp?: number; // Expiration timestamp (Unix seconds)
  challenge_nonce?: string; // Audit trail - nonce from challenge
  vp_jwt_hash?: string; // Cryptographic binding - hash of presentation JWT
  meta?: Record<string, unknown>;
}

/**
 * Connect grant query filters
 */
export interface QueryGrantsFilters {
  requester_oid?: string; // Required for ACL checks (optional for backward compatibility)
  app_oid?: string;
  subject_oid?: string;
  controller_oid?: string;
  status?: EntryStatus;
  limit?: number;
  cursor?: number;
}

/**
 * Connect Service
 *
 * Service-based architecture (Medusa.js pattern) for connect grant management.
 * Handles grant creation, querying, and event logging.
 *
 * Note: This is a simplified version. Full challenge/verify flow with
 * OID core integration can be added later.
 */
export class ConnectService {
  constructor(private ledger: OnoalLedger) {}

  /**
   * Create connect grant with idempotency and ACL grants
   *
   * Creates a new connect grant in the ledger using the "connect_grants" stream.
   * Based on: onoal/ledger/src/routes/connect.ts:176-364
   *
   * Idempotency: Checks if grant already exists by app_oid, subject_oid
   * ACL Grants: Automatically grants access based on grant scopes
   *
   * @param options - Grant creation options
   * @returns Grant creation result with grant_id and ledger_hash
   *
   * @example
   * ```typescript
   * const connectService = ledger.getService<ConnectService>("connectService");
   * const result = await connectService.createGrant({
   *   app_oid: "oid:onoal:app:my-app",
   *   subject_oid: "oid:onoal:user:123",
   *   scopes: ["read:profile", "read:assets"],
   *   exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
   * });
   * ```
   */
  async createGrant(options: CreateGrantOptions): Promise<{
    grant_id: string;
    ledger_hash: string;
    ledger_entry_id: string;
    timestamp: number;
  }> {
    // 1. Check if grant already exists (idempotency)
    // Based on: onoal/ledger/src/routes/connect.ts (similar pattern to proofs/assets)
    // Query grants with matching app_oid, subject_oid
    const queryResult = await this.ledger.query({
      stream: "connect_grants",
      subject_oid: options.subject_oid,
      issuer_oid: options.app_oid,
      limit: 10, // Get enough to find matching grant
    });

    // Find existing grant
    const existingGrant =
      queryResult.entries.find((entry) => {
        const payload = entry.payload as Record<string, unknown>;
        return payload.event_type === "CONNECT_GRANT";
      }) || null;

    let finalGrantId: string;
    let entry: LedgerEntry;
    let timestamp: number;

    if (existingGrant) {
      // Grant already exists - use existing ID
      const existingPayload = existingGrant.payload as Record<string, unknown>;
      finalGrantId = existingPayload.grant_id as string;
      timestamp = existingGrant.timestamp;
      entry = existingGrant;
    } else {
      // Create new grant
      const grantId = crypto.randomUUID();
      timestamp = Date.now();

      // Create grant payload for ledger
      // Based on: onoal/ledger/src/lib/connect-events.ts:38-72
      const grantPayload = {
        grant_id: grantId,
        app_oid: options.app_oid,
        subject_oid: options.subject_oid,
        scopes: options.scopes,
        status: "active",
        ...(options.controller_oid && {
          controller_oid: options.controller_oid,
        }),
        ...(options.resource && { resource: options.resource }),
        ...(options.policy && { policy: options.policy }),
        ...(options.lawful_basis && { lawful_basis: options.lawful_basis }),
        ...(options.ttl_caps && { ttl_caps: options.ttl_caps }),
        ...(options.exp && { exp: options.exp }),
        ...(options.challenge_nonce && {
          challenge_nonce: options.challenge_nonce,
        }),
        ...(options.vp_jwt_hash && { vp_jwt_hash: options.vp_jwt_hash }),
      };

      // Append to ledger in connect_grants stream
      entry = await this.ledger.append({
        type: "connect_grant", // This will be validated if customSchemas is defined
        issuer_oid: options.app_oid, // App is the issuer of the grant
        subject_oid: options.subject_oid,
        payload: grantPayload,
        stream: "connect_grants" as LedgerStream,
        meta: options.meta,
      });
      finalGrantId = grantId;
    }

    // 2. Seed ACL via UAL (if available)
    const ual = this.ledger.getService<UnifiedAccessLayer>("ual");
    if (ual) {
      // Grant access based on scopes
      const aclGrants = options.scopes.map((scope) => ({
        resourceKind: "connect_grant" as const,
        resourceId: finalGrantId,
        principalOid: options.subject_oid,
        scope: scope as "read" | "write" | "full",
        grantedBy: options.app_oid,
        exp: options.exp,
      }));

      await ual.grant(aclGrants);
    }

    return {
      grant_id: finalGrantId,
      ledger_hash: entry.hash,
      ledger_entry_id: entry.id,
      timestamp,
    };
  }

  /**
   * Query connect grants with ACL checks
   *
   * Queries connect grants from the ledger with optional filters.
   * If UAL is available and requester_oid is provided, uses ACL-aware querying.
   * Otherwise falls back to direct query (backward compatible).
   *
   * @param filters - Query filters
   * @returns Query result with entries, cursor, and hasMore flag
   *
   * @example
   * ```typescript
   * // With ACL (recommended)
   * const result = await connectService.queryGrants({
   *   requester_oid: "oid:onoal:user:123",
   *   subject_oid: "oid:onoal:user:123",
   *   app_oid: "oid:onoal:app:my-app",
   *   limit: 20,
   * });
   *
   * // Without ACL (backward compatible)
   * const result = await connectService.queryGrants({
   *   subject_oid: "oid:onoal:user:123",
   *   app_oid: "oid:onoal:app:my-app",
   *   limit: 20,
   * });
   * ```
   */
  async queryGrants(filters: QueryGrantsFilters): Promise<{
    entries: LedgerEntry[];
    nextCursor: number | null;
    hasMore: boolean;
  }> {
    const ual = this.ledger.getService<UnifiedAccessLayer>("ual");

    // If UAL is available and requester_oid is provided, use ACL-aware querying
    if (ual && filters.requester_oid) {
      // Use UAL.list() for ACL-aware querying
      const result = await ual.list(filters.requester_oid, {
        kind: "connect_grant",
        subjectOid: filters.subject_oid,
        issuerOid: filters.app_oid,
        status: filters.status as any,
        limit: filters.limit,
        cursor: filters.cursor,
      });

      return {
        entries: result.items as LedgerEntry[],
        nextCursor: result.nextCursor ?? null,
        hasMore: result.hasMore,
      };
    }

    // Fallback to direct query if UAL not available or requester_oid not provided
    return this.ledger.query({
      stream: "connect_grants",
      subject_oid: filters.subject_oid,
      issuer_oid: filters.app_oid, // app_oid maps to issuer_oid in ledger
      status: filters.status,
      limit: filters.limit,
      cursor: filters.cursor,
    });
  }

  /**
   * Get grant by ledger entry ID with ACL check
   *
   * Retrieves a single connect grant entry by its ledger entry ID.
   * If UAL is available and requester_oid is provided, uses ACL check.
   * Otherwise falls back to direct query (backward compatible).
   *
   * Uses UAL.require() for ACL check
   *
   * @param id - Ledger entry ID
   * @param requester_oid - Optional requester OID for ACL check
   * @returns Grant entry or null if not found or access denied
   *
   * @example
   * ```typescript
   * // With ACL (recommended)
   * const grant = await connectService.getGrant("ledger-entry-id-123", "oid:onoal:user:123");
   *
   * // Without ACL (backward compatible)
   * const grant = await connectService.getGrant("ledger-entry-id-123");
   * ```
   */
  async getGrant(
    id: string,
    requester_oid?: string
  ): Promise<LedgerEntry | null> {
    const ual = this.ledger.getService<UnifiedAccessLayer>("ual");

    // If UAL is available and requester_oid is provided, use ACL check
    if (ual && requester_oid) {
      // Use UAL.require() for ACL check
      try {
        const grant = await ual.require(requester_oid, "read", {
          kind: "connect_grant",
          id,
        });
        return grant as LedgerEntry;
      } catch (error) {
        // ACL check failed - return null
        return null;
      }
    }

    // Fallback to direct query if UAL not available or requester_oid not provided
    const entry = await this.ledger.get(id);
    // Verify it's a connect_grants entry
    if (entry && entry.stream === "connect_grants") {
      return entry;
    }
    return null;
  }

  /**
   * Create connect event
   *
   * Logs a connect event to the consent stream for audit trail.
   * Based on: onoal/ledger/src/lib/connect-events.ts:38-72
   *
   * @param options - Event creation options
   * @returns Event creation result with event_id and ledger_hash
   */
  async createEvent(options: {
    type: string; // e.g., "CONNECT_VERIFY", "CONNECT_REVOKE"
    app_oid: string;
    subject_oid: string;
    grant_id?: string;
    connect_id?: string;
    challenge_nonce?: string;
    scopes?: string[];
    actor_oid?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    event_id: string;
    ledger_hash: string;
    ledger_entry_id: string;
    timestamp: number;
  }> {
    const eventId = crypto.randomUUID();
    const timestamp = Date.now();

    const eventPayload = {
      event_type: options.type,
      event_id: eventId,
      app_oid: options.app_oid,
      subject_oid: options.subject_oid,
      timestamp,
      ...(options.grant_id && { grant_id: options.grant_id }),
      ...(options.connect_id && { connect_id: options.connect_id }),
      ...(options.challenge_nonce && {
        challenge_nonce: options.challenge_nonce,
      }),
      ...(options.scopes && { scopes: options.scopes }),
      ...(options.actor_oid && { actor_oid: options.actor_oid }),
      ...(options.metadata && { metadata: options.metadata }),
    };

    const entry = await this.ledger.append({
      type: "connect_event",
      issuer_oid: options.app_oid,
      subject_oid: options.subject_oid,
      payload: eventPayload,
      stream: "connect_events" as LedgerStream,
    });

    return {
      event_id: eventId,
      ledger_hash: entry.hash,
      ledger_entry_id: entry.id,
      timestamp,
    };
  }
}
