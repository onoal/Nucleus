/**
 * Asset Service for Ledger Framework
 *
 * Provides asset creation and querying functionality.
 * Based on: onoal/ledger/src/routes/asset-v2.ts and onoal/ledger/src/assets.ts
 *
 * @module services/asset-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
  UnifiedAccessLayer,
} from "@onoal/ledger-core";
import type { LedgerDatabase } from "@onoal/ledger-core";
import { SignJWT } from "jose";

/**
 * Asset creation options
 */
export interface IssueAssetOptions {
  issuer_oid: string;
  owner_oid: string;
  type: string;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
  exp?: number; // Optional expiration timestamp
}

/**
 * Asset query filters
 */
export interface QueryAssetsFilters {
  requester_oid?: string; // Required for ACL checks (optional for backward compatibility)
  owner_oid?: string;
  issuer_oid?: string;
  type?: string;
  status?: EntryStatus;
  limit?: number;
  cursor?: number;
}

/**
 * Asset Service
 *
 * Service-based architecture (Medusa.js pattern) for asset management.
 * Handles asset creation, querying, and retrieval.
 *
 * Note: This is a simplified version. Full asset type system with
 * schema validation and policies can be added later.
 */
export class AssetService {
  constructor(private ledger: OnoalLedger) {}

  /**
   * Issue asset with idempotency and ACL grants
   *
   * Creates a new asset in the ledger using the "assets" stream.
   * Based on: onoal/ledger/src/routes/asset-v2.ts:224-538
   *
   * Idempotency: Checks if asset already exists by owner_oid, type, issuer_oid
   * ACL Grants: Automatically grants full access to owner_oid and issuer_oid
   *
   * @param options - Asset creation options
   * @returns Asset creation result with asset_id, ledger_hash, asset_jwt
   *
   * @example
   * ```typescript
   * const assetService = ledger.getService<AssetService>("assetService");
   * const result = await assetService.issueAsset({
   *   issuer_oid: "oid:onoal:org:test",
   *   owner_oid: "oid:onoal:user:123",
   *   type: "ticket",
   *   payload: { event: "festival", section: "VIP" },
   * });
   * ```
   */
  async issueAsset(options: IssueAssetOptions): Promise<{
    asset_id: string;
    ledger_hash: string;
    asset_jwt: string;
    ledger_entry_id: string;
    timestamp: number;
  }> {
    // 1. Check if asset already exists (idempotency)
    // Based on: onoal/ledger/src/routes/asset-v2.ts:387-396
    // Query assets with matching owner_oid, issuer_oid, then filter by type
    const queryResult = await this.ledger.query({
      stream: "assets",
      subject_oid: options.owner_oid,
      issuer_oid: options.issuer_oid,
      limit: 100, // Get enough to find matching asset
    });

    // Filter by type in JavaScript (payload filtering)
    const existingAsset =
      queryResult.entries.find((entry) => {
        const payload = entry.payload as Record<string, unknown>;
        return payload.type === options.type;
      }) || null;

    let finalAssetId: string;
    let entry: LedgerEntry & { asset_jwt: string };
    let timestamp: number;

    if (existingAsset) {
      // Asset already exists - use existing ID
      // Based on: onoal/ledger/src/routes/asset-v2.ts:400-412
      const existingPayload = existingAsset.payload as Record<string, unknown>;
      finalAssetId = existingPayload.asset_id as string;
      timestamp = existingAsset.timestamp;
      entry = {
        ...existingAsset,
        asset_jwt: (existingPayload.asset_jwt as string) || "",
      };
    } else {
      // Create new asset
      const assetId = crypto.randomUUID();
      timestamp = Date.now();

      // Create asset JWT
      // Based on: onoal/ledger/src/assets.ts:66-130
      const assetJwt = await this.createAssetJWT(
        assetId,
        options.issuer_oid,
        options.owner_oid,
        options.type,
        options.payload,
        options.exp
      );

      // Create asset payload for ledger
      const assetPayload = {
        asset_id: assetId,
        issuer_oid: options.issuer_oid,
        owner_oid: options.owner_oid,
        type: options.type,
        payload: options.payload,
        asset_jwt: assetJwt,
        action: "issued",
      };

      // Append to ledger
      const ledgerEntry = await this.ledger.append({
        type: "asset", // This will be validated if customSchemas is defined
        issuer_oid: options.issuer_oid,
        subject_oid: options.owner_oid,
        payload: assetPayload,
        stream: "assets" as LedgerStream,
        meta: options.meta,
      });
      // Add asset_jwt to entry
      entry = {
        ...ledgerEntry,
        asset_jwt: assetJwt,
      };
      finalAssetId = assetId;
    }

    // 2. Seed ACL via UAL (always ensure grants are in place, even for existing assets)
    // Based on: onoal/ledger/src/routes/asset-v2.ts:449-485
    const ual = this.ledger.getService<UnifiedAccessLayer>("ual");
    if (ual) {
      const aclGrants = [
        {
          resourceKind: "asset" as const,
          resourceId: finalAssetId,
          principalOid: options.owner_oid,
          scope: "full" as const,
          grantedBy: options.issuer_oid,
        },
        {
          resourceKind: "asset" as const,
          resourceId: finalAssetId,
          principalOid: options.issuer_oid,
          scope: "full" as const,
          grantedBy: "system",
        },
      ];

      // If payload contains user_oid that differs from owner_oid, grant access to user_oid too
      const payloadUserOid = (options.payload as { user_oid?: string })
        ?.user_oid;
      if (
        payloadUserOid &&
        payloadUserOid !== options.owner_oid &&
        payloadUserOid.startsWith("oid:onoal:")
      ) {
        aclGrants.push({
          resourceKind: "asset",
          resourceId: finalAssetId,
          principalOid: payloadUserOid,
          scope: "full",
          grantedBy: options.issuer_oid,
        });
      }

      // Grant ACL (onConflictDoNothing ensures idempotency)
      await ual.grant(aclGrants);
    }

    return {
      asset_id: finalAssetId,
      ledger_hash: entry.hash,
      asset_jwt: entry.asset_jwt || "",
      ledger_entry_id: entry.id,
      timestamp,
    };
  }

  /**
   * Create asset JWT
   *
   * Creates a signed JWT for the asset that can be verified independently.
   * Based on: onoal/ledger/src/assets.ts:66-130
   *
   * @param assetId - Asset ID
   * @param issuerOid - Issuer OID
   * @param ownerOid - Owner OID
   * @param type - Asset type
   * @param payload - Asset payload
   * @param exp - Optional expiration timestamp
   * @returns Signed JWT string
   */
  private async createAssetJWT(
    assetId: string,
    issuerOid: string,
    ownerOid: string,
    type: string,
    payload: Record<string, unknown>,
    exp?: number
  ): Promise<string> {
    const signer = this.ledger.getService<any>("signer");
    const signingKey = this.ledger.config.signingKey;

    const jwtPayload = {
      asset_id: assetId,
      issuer_oid: issuerOid,
      owner_oid: ownerOid,
      type,
      payload,
      iat: Math.floor(Date.now() / 1000),
      ...(exp && { exp: Math.floor(exp / 1000) }),
    };

    const jwt = await new SignJWT(jwtPayload)
      .setProtectedHeader({
        alg: "EdDSA",
        crv: "Ed25519",
      })
      .setIssuedAt(jwtPayload.iat)
      .setIssuer(issuerOid)
      .setSubject(assetId)
      .setAudience("ledger")
      .sign(signingKey);

    return jwt;
  }

  /**
   * Query assets with ACL checks
   *
   * Queries assets from the ledger with optional filters.
   * If UAL is available and requester_oid is provided, uses ACL-aware querying.
   * Otherwise falls back to direct query (backward compatible).
   *
   * Uses UAL.list() for ACL-aware querying
   *
   * @param filters - Query filters
   * @returns Query result with entries, cursor, and hasMore flag
   *
   * @example
   * ```typescript
   * // With ACL (recommended)
   * const result = await assetService.queryAssets({
   *   requester_oid: "oid:onoal:user:123",
   *   owner_oid: "oid:onoal:user:123",
   *   type: "ticket",
   *   limit: 20,
   * });
   *
   * // Without ACL (backward compatible)
   * const result = await assetService.queryAssets({
   *   owner_oid: "oid:onoal:user:123",
   *   type: "ticket",
   *   limit: 20,
   * });
   * ```
   */
  async queryAssets(filters: QueryAssetsFilters): Promise<{
    entries: LedgerEntry[];
    nextCursor: number | null;
    hasMore: boolean;
  }> {
    const ual = this.ledger.getService<UnifiedAccessLayer>("ual");

    // If UAL is available and requester_oid is provided, use ACL-aware querying
    if (ual && filters.requester_oid) {
      // Use UAL.list() for ACL-aware querying
      const result = await ual.list(filters.requester_oid, {
        kind: "asset",
        subjectOid: filters.owner_oid,
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
      stream: "assets",
      subject_oid: filters.owner_oid, // owner_oid maps to subject_oid in ledger
      issuer_oid: filters.issuer_oid,
      status: filters.status,
      limit: filters.limit,
      cursor: filters.cursor,
    });
  }

  /**
   * Get asset by ID with ACL check
   *
   * Retrieves a single asset entry by its ledger entry ID.
   * If UAL is available and requester_oid is provided, uses ACL check.
   * Otherwise falls back to direct query (backward compatible).
   *
   * Note: This searches by ledger entry ID, not asset_id.
   * Uses UAL.require() for ACL check
   *
   * @param id - Ledger entry ID
   * @param requester_oid - Optional requester OID for ACL check
   * @returns Asset entry or null if not found or access denied
   *
   * @example
   * ```typescript
   * // With ACL (recommended)
   * const asset = await assetService.getAsset("ledger-entry-id-123", "oid:onoal:user:123");
   *
   * // Without ACL (backward compatible)
   * const asset = await assetService.getAsset("ledger-entry-id-123");
   * ```
   */
  async getAsset(
    id: string,
    requester_oid?: string
  ): Promise<LedgerEntry | null> {
    const ual = this.ledger.getService<UnifiedAccessLayer>("ual");

    // If UAL is available and requester_oid is provided, use ACL check
    if (ual && requester_oid) {
      // Use UAL.require() for ACL check
      try {
        const asset = await ual.require(requester_oid, "read", {
          kind: "asset",
          id,
        });
        return asset as LedgerEntry;
      } catch (error) {
        // ACL check failed - return null
        return null;
      }
    }

    // Fallback to direct query if UAL not available or requester_oid not provided
    const entry = await this.ledger.get(id);
    // Verify it's an asset entry
    if (entry && entry.stream === "assets") {
      return entry;
    }
    return null;
  }
}
