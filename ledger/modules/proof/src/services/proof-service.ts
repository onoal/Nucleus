/**
 * Proof Service for Ledger Framework
 *
 * Provides proof creation and querying functionality.
 * Based on: onoal/ledger/src/routes/submit.ts
 *
 * @module services/proof-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
  UnifiedAccessLayer,
} from "@onoal/ledger-core";
import type { LedgerDatabase } from "@onoal/ledger-core";

/**
 * Proof creation options
 */
export interface CreateProofOptions {
  subject_oid: string;
  issuer_oid: string;
  target: string;
  type: string;
  payload: unknown;
  meta?: Record<string, unknown>;
}

/**
 * Proof query filters
 */
export interface QueryProofsFilters {
  requester_oid?: string; // Required for ACL checks (optional for backward compatibility)
  subject_oid?: string;
  issuer_oid?: string;
  type?: string;
  status?: EntryStatus;
  limit?: number;
  cursor?: number;
}

/**
 * Proof Service
 *
 * Service-based architecture (Medusa.js pattern) for proof management.
 * Handles proof creation, querying, and retrieval.
 */
export class ProofService {
  constructor(private ledger: OnoalLedger) {}

  /**
   * Create proof entry with idempotency and ACL grants
   *
   * Creates a new proof entry in the ledger using the "proofs" stream.
   * Based on: onoal/ledger/src/routes/submit.ts:18-161
   *
   * Idempotency: Checks if proof already exists by subject_oid, type, issuer_oid, target
   * ACL Grants: Automatically grants read access to subject_oid and full access to issuer_oid
   *
   * @param options - Proof creation options
   * @returns Ledger entry with proof JWT
   *
   * @example
   * ```typescript
   * const proofService = ledger.getService<ProofService>("proofService");
   * const entry = await proofService.createProof({
   *   subject_oid: "oid:onoal:user:123",
   *   issuer_oid: "oid:onoal:org:test",
   *   target: "venue:nightclub",
   *   type: "AgeOver",
   *   payload: { age: 21, verified: true },
   * });
   * ```
   */
  async createProof(
    options: CreateProofOptions
  ): Promise<LedgerEntry & { proof_jwt?: string; _isNew: boolean }> {
    // 1. Check if proof already exists (idempotency)
    // Based on: onoal/ledger/src/routes/submit.ts:32-43
    // Query proofs with matching subject_oid, issuer_oid, then filter by type and target
    const queryResult = await this.ledger.query({
      stream: "proofs",
      subject_oid: options.subject_oid,
      issuer_oid: options.issuer_oid,
      limit: 100, // Get enough to find matching proof
    });

    // Filter by type and target in JavaScript (payload filtering)
    const existingProof =
      queryResult.entries.find((entry) => {
        const payload = entry.payload as Record<string, unknown>;
        return (
          payload.type === options.type && payload.target === options.target
        );
      }) || null;

    let finalProofId: string;
    let entry: LedgerEntry & { proof_jwt?: string };
    let isNew: boolean;

    if (existingProof) {
      // Proof already exists - use existing ID and skip insertion
      // Based on: onoal/ledger/src/routes/submit.ts:50-63
      finalProofId = existingProof.id;
      entry = existingProof;
      isNew = false;
    } else {
      // Create new proof
      entry = await this.ledger.append({
        type: "proof", // This will be validated if customSchemas is defined
        issuer_oid: options.issuer_oid,
        subject_oid: options.subject_oid,
        payload: {
          subject_oid: options.subject_oid,
          issuer_oid: options.issuer_oid,
          target: options.target,
          type: options.type,
          proof_data: options.payload,
        },
        stream: "proofs" as LedgerStream,
        meta: options.meta,
      });
      finalProofId = entry.id;
      isNew = true;
    }

    // 2. Seed ACL via UAL (always ensure grants are in place, even for existing proofs)
    // Based on: onoal/ledger/src/routes/submit.ts:98-130
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;
    if (ual) {
      const aclGrants = [
        {
          resourceKind: "proof" as const,
          resourceId: finalProofId,
          principalOid: options.subject_oid,
          scope: "read" as const,
          grantedBy: "system",
        },
        {
          resourceKind: "proof" as const,
          resourceId: finalProofId,
          principalOid: options.issuer_oid,
          scope: "full" as const,
          grantedBy: "system",
        },
      ];

      // If payload contains user_oid that differs from subject_oid, grant access to user_oid too
      const payloadUserOid = (options.payload as { user_oid?: string })
        ?.user_oid;
      if (
        payloadUserOid &&
        payloadUserOid !== options.subject_oid &&
        payloadUserOid.startsWith("oid:onoal:")
      ) {
        aclGrants.push({
          resourceKind: "proof",
          resourceId: finalProofId,
          principalOid: payloadUserOid,
          scope: "read",
          grantedBy: "system",
        });
      }

      // Grant ACL (onConflictDoNothing ensures idempotency)
      await ual.grant(aclGrants);
    }

    // Return entry with isNew flag for response formatting
    return {
      ...entry,
      _isNew: isNew,
    } as LedgerEntry & { proof_jwt?: string; _isNew: boolean };
  }

  /**
   * Query proofs with ACL checks
   *
   * Queries proofs from the ledger with optional filters.
   * If UAL is available and requester_oid is provided, uses ACL-aware querying.
   * Otherwise falls back to direct query (backward compatible).
   *
   * Based on: onoal/ledger/src/routes/proofs.ts:84-92
   * Uses UAL.list() for ACL-aware querying
   *
   * @param filters - Query filters
   * @returns Query result with entries, cursor, and hasMore flag
   *
   * @example
   * ```typescript
   * // With ACL (recommended)
   * const result = await proofService.queryProofs({
   *   requester_oid: "oid:onoal:user:123",
   *   subject_oid: "oid:onoal:user:123",
   *   type: "AgeOver",
   *   limit: 20,
   * });
   *
   * // Without ACL (backward compatible)
   * const result = await proofService.queryProofs({
   *   subject_oid: "oid:onoal:user:123",
   *   type: "AgeOver",
   *   limit: 20,
   * });
   * ```
   */
  async queryProofs(filters: QueryProofsFilters): Promise<{
    entries: LedgerEntry[];
    nextCursor: number | null;
    hasMore: boolean;
  }> {
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;

    // If UAL is available and requester_oid is provided, use ACL-aware querying
    if (ual && filters.requester_oid) {
      // Use UAL.list() for ACL-aware querying
      // Based on: onoal/ledger/src/routes/proofs.ts:84-92
      const result = await ual.list(filters.requester_oid, {
        kind: "proof",
        subjectOid: filters.subject_oid,
        issuerOid: filters.issuer_oid,
        status: filters.status as any,
        type: filters.type,
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
      stream: "proofs",
      subject_oid: filters.subject_oid,
      issuer_oid: filters.issuer_oid,
      status: filters.status,
      limit: filters.limit,
      cursor: filters.cursor,
    });
  }

  /**
   * Get proof by ID with ACL check
   *
   * Retrieves a single proof entry by its ID.
   * If UAL is available and requester_oid is provided, uses ACL check.
   * Otherwise falls back to direct query (backward compatible).
   *
   * Based on: onoal/ledger/src/routes/proof.ts:28-31
   * Uses UAL.require() for ACL check
   *
   * @param id - Proof entry ID
   * @param requester_oid - Optional requester OID for ACL check
   * @returns Proof entry or null if not found or access denied
   *
   * @example
   * ```typescript
   * // With ACL (recommended)
   * const proof = await proofService.getProof("proof-id-123", "oid:onoal:user:123");
   *
   * // Without ACL (backward compatible)
   * const proof = await proofService.getProof("proof-id-123");
   * ```
   */
  async getProof(
    id: string,
    requester_oid?: string
  ): Promise<LedgerEntry | null> {
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;

    // If UAL is available and requester_oid is provided, use ACL check
    if (ual && requester_oid) {
      // Use UAL.require() for ACL check
      // Based on: onoal/ledger/src/routes/proof.ts:28-31
      try {
        const proof = await ual.require(requester_oid, "read", {
          kind: "proof",
          id,
        });
        return proof as LedgerEntry;
      } catch (error) {
        // ACL check failed - return null
        return null;
      }
    }

    // Fallback to direct query if UAL not available or requester_oid not provided
    const entry = await this.ledger.get(id);
    // Verify it's a proof entry
    if (entry && entry.stream === "proofs") {
      return entry;
    }
    return null;
  }
}
