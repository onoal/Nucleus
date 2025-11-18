/**
 * Connect module for Onoal Ledger
 *
 * Provides connect grant creation and querying functionality via ConnectService.
 * Includes API routes for REST endpoints.
 *
 * **Note:** Deze module gebruikt nu de universele `createCustomModule` helper
 * van `@onoal/core` voor consistente module creation.
 *
 * Based on: onoal/ledger/src/routes/connect.ts
 *
 * @module ledger-module-connect
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { createCustomModule, ensureOid } from "@onoal/ledger-core";
import { ConnectService } from "./services/connect-service.js";

/**
 * Connect Module
 *
 * Provides connect grant creation and querying functionality.
 * Registers ConnectService and API routes.
 *
 * **Implementation:** Gebruikt universele `createCustomModule` helper voor
 * consistente module creation die werkt met alle frameworks.
 *
 * @example
 * ```typescript
 * import { connectModule } from "@onoal/ledger-module-connect";
 * import { createLedger } from "@onoal/ledger-core";
 *
 * const ledger = await createLedger({
 *   modules: [connectModule()],
 *   // ...
 * });
 *
 * // Use connect service
 * const connectService = ledger.getService<ConnectService>("connectService");
 * const result = await connectService.createGrant({ ... });
 * ```
 */
export function connectModule() {
  return createCustomModule({
    id: "connect",
    label: "Connect Module",
    version: "1.0.0",
    services: {
      connectService: ConnectService,
    },
    routes: [
      // POST /connect/grant - Create connect grant
      {
        method: "POST",
        path: "/connect/grant",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined>
        ) => {
          const connectService =
            ledger.getService<ConnectService>("connectService");

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
              app_oid?: string;
              subject_oid?: string;
              scopes?: string[];
              controller_oid?: string;
              resource?: string;
              policy?: string;
              lawful_basis?: string;
              ttl_caps?: Record<string, number>;
              exp?: number;
              challenge_nonce?: string;
              vp_jwt_hash?: string;
              meta?: Record<string, unknown>;
            };
            const {
              scopes,
              resource,
              policy,
              lawful_basis,
              ttl_caps,
              exp,
              challenge_nonce,
              vp_jwt_hash,
              meta,
            } = body;

            // Validate required fields
            if (
              !body.app_oid ||
              !body.subject_oid ||
              !scopes ||
              scopes.length === 0
            ) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["app_oid", "subject_oid", "scopes"],
                },
                { status: 400 }
              );
            }

            // Validate OIDs (supports hierarchical and external namespaces)
            const app_oid = ensureOid(body.app_oid, "app_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });
            const subject_oid = ensureOid(body.subject_oid, "subject_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });
            const controller_oid = body.controller_oid
              ? ensureOid(body.controller_oid, "controller_oid", {
                  allowHierarchical: true,
                  allowExternalNamespaces: true,
                })
              : undefined;

            // Create grant
            const result = await connectService.createGrant({
              app_oid,
              subject_oid,
              scopes,
              controller_oid,
              resource,
              policy,
              lawful_basis,
              ttl_caps,
              exp,
              challenge_nonce,
              vp_jwt_hash,
              meta,
            });

            return Response.json(result);
          } catch (error) {
            console.error("Grant creation error:", error);
            return Response.json(
              {
                error: "Failed to create grant",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /connect/grant/:id - Get grant by ledger entry ID
      {
        method: "GET",
        path: "/connect/grant/:id",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const connectService =
            ledger.getService<ConnectService>("connectService");
          const id = params.id;
          const requester_oid = params._requester_oid;

          if (!id) {
            return Response.json(
              { error: "Grant ID required" },
              { status: 400 }
            );
          }

          try {
            // Use requester_oid for ACL check if available
            const grant = await connectService.getGrant(id, requester_oid);

            if (!grant) {
              return Response.json(
                { error: "Grant not found" },
                { status: 404 }
              );
            }

            return Response.json({
              id: grant.id,
              stream: grant.stream,
              timestamp: grant.timestamp,
              payload: grant.payload,
              hash: grant.hash,
              prev_hash: grant.prev_hash,
              signature: grant.signature,
              status: grant.status,
              meta: grant.meta,
              created_at: grant.created_at,
            });
          } catch (error) {
            console.error("Grant retrieval error:", error);
            return Response.json(
              {
                error: "Failed to retrieve grant",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /connect/grants - Query grants
      {
        method: "GET",
        path: "/connect/grants",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const connectService =
            ledger.getService<ConnectService>("connectService");
          const requester_oid = params._requester_oid;

          try {
            // Parse query parameters
            const url = new URL(req.url);
            const app_oid = url.searchParams.get("app_oid") || undefined;
            const subject_oid =
              url.searchParams.get("subject_oid") || undefined;
            const controller_oid =
              url.searchParams.get("controller_oid") || undefined;
            const status = url.searchParams.get("status") || undefined;
            const limit = url.searchParams.get("limit")
              ? parseInt(url.searchParams.get("limit")!, 10)
              : undefined;
            const cursor = url.searchParams.get("cursor")
              ? parseInt(url.searchParams.get("cursor")!, 10)
              : undefined;

            // Query grants with requester_oid for ACL checks
            const result = await connectService.queryGrants({
              requester_oid,
              app_oid,
              subject_oid,
              controller_oid,
              status: status as any,
              limit,
              cursor,
            });

            return Response.json({
              grants: result.entries,
              next_cursor: result.nextCursor,
              has_more: result.hasMore,
            });
          } catch (error) {
            console.error("Grant query error:", error);
            return Response.json(
              {
                error: "Failed to query grants",
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

// Re-export ConnectService for convenience
export { ConnectService } from "./services/connect-service.js";
export type {
  CreateGrantOptions,
  QueryGrantsFilters,
} from "./services/connect-service.js";
