/**
 * Proof module for Onoal Ledger
 *
 * Provides proof creation and querying functionality via ProofService.
 * Includes API routes for REST endpoints.
 *
 * **Note:** Deze module gebruikt nu de universele `createCustomModule` helper
 * van `@onoal/core` voor consistente module creation.
 *
 * Based on: onoal/ledger/src/routes/submit.ts
 *
 * @module ledger-module-proof
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { createCustomModule, ensureOid } from "@onoal/ledger-core";
import { ProofService } from "./services/proof-service.js";

/**
 * Proof Module
 *
 * Provides proof creation and querying functionality.
 * Registers ProofService and API routes.
 *
 * **Implementation:** Gebruikt universele `createCustomModule` helper voor
 * consistente module creation die werkt met alle frameworks.
 *
 * @example
 * ```typescript
 * import { proofModule } from "@onoal/ledger-module-proof";
 * import { createLedger } from "@onoal/ledger-core";
 *
 * const ledger = await createLedger({
 *   modules: [proofModule()],
 *   // ...
 * });
 *
 * // Use proof service
 * const proofService = ledger.getService<ProofService>("proofService");
 * const entry = await proofService.createProof({ ... });
 * ```
 */
export function proofModule() {
  return createCustomModule({
    id: "proof",
    label: "Proof Module",
    version: "1.0.0",
    services: {
      proofService: ProofService,
    },
    routes: [
      // POST /ledger/submit - Submit proof
      {
        method: "POST",
        path: "/ledger/submit",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined>
        ) => {
          const proofService = ledger.getService<ProofService>("proofService");

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
              subject_oid?: string;
              issuer_oid?: string;
              target?: string;
              type?: string;
              payload?: unknown;
              meta?: Record<string, unknown>;
            };
            const { target, type, payload, meta } = body;

            // Validate required fields
            if (
              !body.subject_oid ||
              !body.issuer_oid ||
              !target ||
              !type ||
              !payload
            ) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: [
                    "subject_oid",
                    "issuer_oid",
                    "target",
                    "type",
                    "payload",
                  ],
                },
                { status: 400 }
              );
            }

            // Validate OIDs (supports hierarchical and external namespaces)
            const subject_oid = ensureOid(body.subject_oid, "subject_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });
            const issuer_oid = ensureOid(body.issuer_oid, "issuer_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });

            // Create proof
            const entry = await proofService.createProof({
              subject_oid,
              issuer_oid,
              target,
              type,
              payload,
              meta,
            });

            // Check if this was an existing proof (idempotency)
            const isNew = (entry as any)._isNew ?? false;

            // Response format matches original ledger
            return Response.json(
              {
                id: entry.id,
                hash: isNew ? entry.hash : "", // Empty hash for existing proofs
                timestamp: entry.timestamp,
                prev_hash: isNew ? entry.prev_hash : null, // Only for new proofs
                stream: entry.stream,
              },
              { status: isNew ? 201 : 200 } // 201 for new, 200 for existing
            );
          } catch (error) {
            console.error("Proof creation error:", error);
            return Response.json(
              {
                error: "Failed to create proof",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /ledger/proof/:id - Get proof by ID
      {
        method: "GET",
        path: "/ledger/proof/:id",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const proofService = ledger.getService<ProofService>("proofService");
          const id = params.id;
          const requester_oid = params._requester_oid;

          if (!id) {
            return Response.json(
              { error: "Proof ID required" },
              { status: 400 }
            );
          }

          try {
            // Use requester_oid for ACL check if available
            const proof = await proofService.getProof(id, requester_oid);

            if (!proof) {
              return Response.json(
                { error: "Proof not found" },
                { status: 404 }
              );
            }

            return Response.json({
              id: proof.id,
              stream: proof.stream,
              timestamp: proof.timestamp,
              payload: proof.payload,
              hash: proof.hash,
              prev_hash: proof.prev_hash,
              signature: proof.signature,
              status: proof.status,
              meta: proof.meta,
              created_at: proof.created_at,
            });
          } catch (error) {
            console.error("Proof retrieval error:", error);
            return Response.json(
              {
                error: "Failed to retrieve proof",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /ledger/proofs - Query proofs
      {
        method: "GET",
        path: "/ledger/proofs",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const proofService = ledger.getService<ProofService>("proofService");
          const requester_oid = params._requester_oid;

          try {
            // Parse query parameters
            const url = new URL(req.url);
            const subject_oid =
              url.searchParams.get("subject_oid") || undefined;
            const issuer_oid = url.searchParams.get("issuer_oid") || undefined;
            const type = url.searchParams.get("type") || undefined;
            const status = url.searchParams.get("status") || undefined;
            const limit = url.searchParams.get("limit")
              ? parseInt(url.searchParams.get("limit")!, 10)
              : undefined;
            const cursor = url.searchParams.get("cursor")
              ? parseInt(url.searchParams.get("cursor")!, 10)
              : undefined;

            // Validation: subject_oid or issuer_oid is required (matches original)
            if (!subject_oid && !issuer_oid) {
              return Response.json(
                {
                  error: "validation_error",
                  message:
                    "subject_oid or issuer_oid query parameter is required",
                },
                { status: 400 }
              );
            }

            // Query proofs with requester_oid for ACL checks
            const result = await proofService.queryProofs({
              requester_oid,
              subject_oid,
              issuer_oid,
              type,
              status: status as any,
              limit,
              cursor,
            });

            // Response format matches original (nextCursor instead of next_cursor)
            // Note: Signed cursors not yet implemented, using timestamp for now
            return Response.json({
              proofs: result.entries,
              hasMore: result.hasMore,
              nextCursor: result.nextCursor
                ? result.nextCursor.toString()
                : null, // Will be signed token in future
            });
          } catch (error) {
            console.error("Proof query error:", error);
            return Response.json(
              {
                error: "Failed to query proofs",
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

// Re-export ProofService for convenience
export { ProofService } from "./services/proof-service.js";
export type {
  CreateProofOptions,
  QueryProofsFilters,
} from "./services/proof-service.js";
