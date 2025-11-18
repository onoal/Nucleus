/**
 * Asset module for Onoal Ledger
 *
 * Provides asset creation and querying functionality via AssetService.
 * Includes API routes for REST endpoints.
 *
 * **Note:** Deze module gebruikt nu de universele `createCustomModule` helper
 * van `@onoal/core` voor consistente module creation.
 *
 * Based on: onoal/ledger/src/routes/asset-v2.ts
 *
 * @module ledger-module-asset
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { createCustomModule, ensureOid } from "@onoal/ledger-core";
import { AssetService } from "./services/asset-service.js";

/**
 * Asset Module
 *
 * Provides asset creation and querying functionality.
 * Registers AssetService and API routes.
 *
 * **Implementation:** Gebruikt universele `createCustomModule` helper voor
 * consistente module creation die werkt met alle frameworks.
 *
 * @example
 * ```typescript
 * import { assetModule } from "@onoal/ledger-module-asset";
 * import { createLedger } from "@onoal/ledger-core";
 *
 * const ledger = await createLedger({
 *   modules: [assetModule()],
 *   // ...
 * });
 *
 * // Use asset service
 * const assetService = ledger.getService<AssetService>("assetService");
 * const result = await assetService.issueAsset({ ... });
 * ```
 */
export function assetModule() {
  return createCustomModule({
    id: "asset",
    label: "Asset Module",
    version: "1.0.0",
    dependencies: ["proof"], // Assets may reference proofs
    services: {
      assetService: AssetService,
    },
    routes: [
      // POST /asset/issue - Issue asset
      {
        method: "POST",
        path: "/asset/issue",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined>
        ) => {
          const assetService = ledger.getService<AssetService>("assetService");

          // Parse request body
          const contentType = req.headers.get("content-type") || "";
          if (!contentType.toLowerCase().includes("application/json")) {
            return Response.json(
              { error: 'Content-Type must be "application/json"' },
              { status: 400 }
            );
          }

          try {
            const body = (await req.json()) as {
              issuer_oid?: string;
              owner_oid?: string;
              type?: string;
              payload?: Record<string, unknown>;
              meta?: Record<string, unknown>;
              exp?: number;
            };
            const { type, payload, meta, exp } = body;

            // Validate required fields
            if (!body.issuer_oid || !body.owner_oid || !type || !payload) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["issuer_oid", "owner_oid", "type", "payload"],
                },
                { status: 400 }
              );
            }

            // Validate OIDs (supports hierarchical and external namespaces)
            const issuer_oid = ensureOid(body.issuer_oid, "issuer_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });
            const owner_oid = ensureOid(body.owner_oid, "owner_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });

            // Issue asset
            const result = await assetService.issueAsset({
              issuer_oid,
              owner_oid,
              type,
              payload,
              meta,
              exp,
            });

            return Response.json(result);
          } catch (error) {
            console.error("Asset creation error:", error);
            return Response.json(
              {
                error: "Failed to create asset",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /asset/:id - Get asset by ledger entry ID
      {
        method: "GET",
        path: "/asset/:id",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const assetService = ledger.getService<AssetService>("assetService");
          const id = params.id;
          const requester_oid = params._requester_oid;

          if (!id) {
            return Response.json(
              { error: "Asset ID required" },
              { status: 400 }
            );
          }

          try {
            // Use requester_oid for ACL check if available
            const asset = await assetService.getAsset(id, requester_oid);

            if (!asset) {
              return Response.json(
                { error: "Asset not found" },
                { status: 404 }
              );
            }

            return Response.json({
              id: asset.id,
              stream: asset.stream,
              timestamp: asset.timestamp,
              payload: asset.payload,
              hash: asset.hash,
              prev_hash: asset.prev_hash,
              signature: asset.signature,
              status: asset.status,
              meta: asset.meta,
              created_at: asset.created_at,
            });
          } catch (error) {
            console.error("Asset retrieval error:", error);
            return Response.json(
              {
                error: "Failed to retrieve asset",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /asset/list - Query assets
      {
        method: "GET",
        path: "/asset/list",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const assetService = ledger.getService<AssetService>("assetService");
          const requester_oid = params._requester_oid;

          try {
            // Parse query parameters
            const url = new URL(req.url);
            const owner_oid = url.searchParams.get("owner_oid") || undefined;
            const issuer_oid = url.searchParams.get("issuer_oid") || undefined;
            const type = url.searchParams.get("type") || undefined;
            const status = url.searchParams.get("status") || undefined;
            const limit = url.searchParams.get("limit")
              ? parseInt(url.searchParams.get("limit")!, 10)
              : undefined;
            const cursor = url.searchParams.get("cursor")
              ? parseInt(url.searchParams.get("cursor")!, 10)
              : undefined;

            // Query assets with requester_oid for ACL checks
            const result = await assetService.queryAssets({
              requester_oid,
              owner_oid,
              issuer_oid,
              type,
              status: status as any,
              limit,
              cursor,
            });

            return Response.json({
              assets: result.entries,
              next_cursor: result.nextCursor,
              has_more: result.hasMore,
            });
          } catch (error) {
            console.error("Asset query error:", error);
            return Response.json(
              {
                error: "Failed to query assets",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
    ],
  });
}

// Re-export AssetService for convenience
export { AssetService } from "./services/asset-service.js";
export type {
  IssueAssetOptions,
  QueryAssetsFilters,
} from "./services/asset-service.js";
