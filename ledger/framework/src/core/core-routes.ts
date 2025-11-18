/**
 * Core Ledger Routes Module
 *
 * Provides core ledger endpoints: health, hash-root, verify, stats, status, jwks
 * Based on: onoal/ledger/src/routes/{health,hash-root,verify,stats,status,jwks}.ts
 *
 * @module core/core-routes
 */

import type {
  OnoalLedger,
  OnoalLedgerModule,
  LedgerDatabase,
} from "./types.js";
import { HashChain } from "./hash-chain.js";
import type { UnifiedAccessLayer } from "./ual.js";
import type { ProofRecord } from "./types-internal.js";
import { LedgerSigner } from "./signer.js";

/**
 * Core Routes Module
 *
 * Provides essential ledger endpoints that don't belong to specific modules.
 */
export function coreRoutesModule(): OnoalLedgerModule {
  return {
    id: "core-routes",
    label: "Core Routes Module",
    version: "1.0.0",
    routes: [
      // GET /health - Health check
      {
        method: "GET",
        path: "/health",
        handler: async () => {
          return Response.json({ ok: true, ts: Date.now() });
        },
      },
      // GET /ledger/hash-root - Get hash root
      {
        method: "GET",
        path: "/ledger/hash-root",
        handler: async (req: Request, ledger: OnoalLedger) => {
          try {
            const database = ledger.getService<any>("database") as
              | LedgerDatabase
              | undefined;
            if (!database || !database.db) {
              return Response.json(
                { error: "Database not initialized" },
                { status: 500 }
              );
            }
            const db = database.db;
            const latest = await HashChain.getLatestEntry(db);
            const count = await HashChain.countEntries(db);

            return Response.json({
              timestamp: Date.now(),
              root_hash: latest?.hash || null,
              entries: count,
              chain_tip_timestamp: latest?.timestamp || null,
            });
          } catch (error) {
            console.error("Hash root error:", error);
            return Response.json(
              {
                error: "Failed to fetch hash root",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /ledger/verify - Verify chain integrity
      {
        method: "GET",
        path: "/ledger/verify",
        handler: async (req: Request, ledger: OnoalLedger) => {
          try {
            const database = ledger.getService<any>("database") as
              | LedgerDatabase
              | undefined;
            if (!database || !database.db) {
              return Response.json(
                { error: "Database not initialized" },
                { status: 500 }
              );
            }
            const db = database.db;

            // Get signer from service container
            // Signer wordt geregistreerd als service tijdens ledger creatie
            const signer =
              ledger.getService<import("./signer.js").LedgerSigner>("signer");
            if (!signer) {
              return Response.json(
                { error: "Signer not available" },
                { status: 500 }
              );
            }

            const url = new URL(req.url);
            const limitParam = url.searchParams.get("limit");
            const limit = limitParam
              ? Math.min(Math.max(parseInt(limitParam, 10), 1), 1000)
              : 100;

            const result = await HashChain.verifyChain(
              db,
              signer,
              undefined,
              limit
            );

            return Response.json(result);
          } catch (error) {
            console.error("Chain verification error:", error);
            return Response.json(
              {
                error: "Failed to verify hash chain",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /ledger/stats - Get ledger statistics
      {
        method: "GET",
        path: "/ledger/stats",
        handler: async (req: Request, ledger: OnoalLedger) => {
          try {
            const database = ledger.getService<any>("database") as
              | LedgerDatabase
              | undefined;
            if (!database || !database.db) {
              return Response.json(
                { error: "Database not initialized" },
                { status: 500 }
              );
            }
            const db = database.db;
            const stats = await HashChain.getChainStats(db);

            return Response.json(stats);
          } catch (error) {
            console.error("Stats error:", error);
            return Response.json(
              {
                error: "Failed to fetch ledger stats",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /ledger/status/:oid - Get ledger status for an OID
      {
        method: "GET",
        path: "/ledger/status/:oid",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const oid = params.oid;
          const requester_oid = params._requester_oid;

          if (!oid) {
            return Response.json(
              { error: "OID parameter required" },
              { status: 400 }
            );
          }

          if (!requester_oid) {
            return Response.json(
              { error: "unauthorized", message: "Authentication required" },
              { status: 401 }
            );
          }

          try {
            const ual = ledger.getService<UnifiedAccessLayer>("ual");
            if (!ual) {
              return Response.json(
                {
                  error: "UAL not initialized",
                  message:
                    "Unified Access Layer is required for status endpoint",
                },
                { status: 500 }
              );
            }

            // Use UAL.list() to find latest proof for this OID
            const result = await ual.list(requester_oid, {
              kind: "proof",
              subjectOid: oid,
            });

            const status = result.items.at(0);

            if (!status) {
              return Response.json(
                { error: "not_found", message: "No proofs found for this OID" },
                { status: 404 }
              );
            }

            return Response.json({
              oid,
              status: status.status,
              last_updated: status.timestamp,
              last_entry_type: status.type,
            });
          } catch (error) {
            console.error("Status error:", error);
            return Response.json(
              {
                error: "Failed to fetch ledger status",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /.well-known/jwks.json - JWKS endpoint
      {
        method: "GET",
        path: "/.well-known/jwks.json",
        handler: async (req: Request, ledger: OnoalLedger) => {
          try {
            const signer = ledger.getService<any>("signer");
            if (!signer) {
              return Response.json(
                {
                  error: "Signer not initialized",
                  message: "JWT signer is required for JWKS endpoint",
                },
                { status: 500 }
              );
            }

            // Use getJwk() method from LedgerSigner
            // Based on: onoal/ledger/src/routes/jwks.ts:15-20
            const ledgerSigner = signer as LedgerSigner;
            const jwk = ledgerSigner.getJwk();

            if (!jwk) {
              return Response.json(
                {
                  error: "Public key not available",
                  message: "Cannot generate JWKS without public key",
                },
                { status: 500 }
              );
            }

            return Response.json({
              keys: [jwk],
            });
          } catch (error) {
            console.error("JWKS error:", error);
            return Response.json(
              {
                error: "Failed to generate JWKS",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
    ],
  };
}
