/**
 * Token module for Onoal Ledger
 *
 * Provides token creation, minting, burning, transfer, and querying functionality.
 * Registers TokenService and API routes.
 *
 * **Note:** Deze module gebruikt nu de universele `createCustomModule` helper
 * van `@onoal/core` voor consistente module creation.
 *
 * @module ledger-module-token
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { createCustomModule, ensureOid } from "@onoal/ledger-core";
import { TokenService } from "./services/token-service.js";
import { tokenSchema } from "./schema/index.js";

/**
 * Token Module
 *
 * Provides token creation, minting, burning, transfer, and querying functionality.
 * Registers TokenService and API routes.
 *
 * **Implementation:** Gebruikt universele `createCustomModule` helper voor
 * consistente module creation die werkt met alle frameworks.
 *
 * @example
 * ```typescript
 * import { tokenModule } from "@onoal/ledger-module-token";
 * import { createLedger } from "@onoal/ledger-core";
 *
 * const ledger = await createLedger({
 *   modules: [tokenModule()],
 *   // ...
 * });
 *
 * // Use token service
 * const tokenService = ledger.getService<TokenService>("tokenService");
 * const result = await tokenService.createToken({ ... });
 * ```
 */
export function tokenModule() {
  return createCustomModule({
    id: "token",
    label: "Token Module",
    version: "1.0.0",
    dependencies: [], // Tokens are independent
    services: {
      tokenService: TokenService,
    },
    // Drizzle schema tables (automatically registered with database adapter)
    drizzleSchema: tokenSchema,
    routes: [
      // POST /token - Create new token
      {
        method: "POST",
        path: "/token",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");

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
              symbol?: string;
              name?: string;
              decimals?: number;
              supply_cap?: string; // BigInt as string
              metadata?: Record<string, unknown>;
              admin_policy?: Record<string, unknown>;
            };

            // Validate required fields
            if (!body.issuer_oid || body.decimals === undefined) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["issuer_oid", "decimals"],
                },
                { status: 400 }
              );
            }

            // Validate OID
            const issuer_oid = ensureOid(body.issuer_oid, "issuer_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });

            // Validate decimals
            if (body.decimals < 0 || body.decimals > 18) {
              return Response.json(
                { error: "Decimals must be between 0 and 18" },
                { status: 400 }
              );
            }

            // Parse supply_cap (BigInt from string)
            const supply_cap =
              body.supply_cap !== undefined
                ? BigInt(body.supply_cap)
                : undefined;

            // Create token
            const result = await tokenService.createToken({
              issuer_oid,
              symbol: body.symbol,
              name: body.name,
              decimals: body.decimals,
              supply_cap: supply_cap ?? null,
              metadata: body.metadata,
              admin_policy: body.admin_policy,
            });

            return Response.json(result);
          } catch (error) {
            console.error("Token creation error:", error);
            return Response.json(
              {
                error: "Failed to create token",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /token/:id - Get token by ID
      {
        method: "GET",
        path: "/token/:id",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const tokenId = params.id;
          const requester_oid = params._requester_oid;

          if (!tokenId) {
            return Response.json(
              { error: "Token ID required" },
              { status: 400 }
            );
          }

          try {
            const token = await tokenService.getToken(tokenId, requester_oid);

            if (!token) {
              return Response.json(
                { error: "Token not found" },
                { status: 404 }
              );
            }

            return Response.json({
              token_id: token.id,
              issuer_oid: token.issuerOid,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              supply_cap: token.supplyCap?.toString(),
              supply: token.supply.toString(),
              supply_formatted: tokenService.formatBalance(
                token.supply,
                token.decimals
              ),
              status: token.status,
              metadata: token.metadata,
              admin_policy: token.adminPolicy,
              created_at: token.createdAt,
              updated_at: token.updatedAt,
            });
          } catch (error) {
            console.error("Token retrieval error:", error);
            return Response.json(
              {
                error: "Failed to retrieve token",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // POST /token/:id/mint - Mint tokens (requires DPoP)
      {
        method: "POST",
        path: "/token/:id/mint",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
            _request_context?: any;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const tokenId = params.id;
          const requester_oid = params._requester_oid;
          const requestContext = params._request_context;

          if (!tokenId) {
            return Response.json(
              { error: "Token ID required" },
              { status: 400 }
            );
          }

          // DPoP is required for token mutations
          if (!requestContext || requestContext.source !== "connect_token") {
            return Response.json(
              {
                error: "DPoP-bound Connect token required for token mutations",
              },
              { status: 401 }
            );
          }

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
              to?: string;
              amount?: string; // BigInt as string
              tx_id?: string;
              memo?: string;
            };

            // Validate required fields
            if (!body.to || !body.amount || !body.tx_id) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["to", "amount", "tx_id"],
                },
                { status: 400 }
              );
            }

            // Validate OID
            const to = ensureOid(body.to, "to", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });

            // Parse amount (BigInt from string)
            const amount = BigInt(body.amount);

            if (amount <= 0) {
              return Response.json(
                { error: "Amount must be greater than 0" },
                { status: 400 }
              );
            }

            // Build context from request
            const ctx: Record<string, unknown> = {};
            if (requestContext.claims?.grant_id) {
              ctx.grant_jti = requestContext.claims.grant_id;
            }
            if (requestContext.claims?.cnf?.jkt) {
              ctx.dpop_thumbprint = requestContext.claims.cnf.jkt;
            }
            if (body.memo) {
              ctx.memo = body.memo;
            }

            // Mint tokens
            const result = await tokenService.mintToken({
              tokenId,
              to,
              amount,
              txId: body.tx_id,
              actorOid: requester_oid || "unknown",
              ctx: Object.keys(ctx).length > 0 ? ctx : undefined,
            });

            return Response.json({
              tx_id: result.tx_id,
              ledger_id: result.ledger_id,
              token_id: result.token_id,
              kind: result.kind,
              to: result.to,
              amount: result.amount.toString(),
              new_balance: result.new_balance.toString(),
              new_supply: result.new_supply.toString(),
              timestamp: result.timestamp,
            });
          } catch (error) {
            console.error("Token mint error:", error);
            return Response.json(
              {
                error: "Failed to mint tokens",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // POST /token/:id/transfer - Transfer tokens (requires DPoP)
      {
        method: "POST",
        path: "/token/:id/transfer",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
            _request_context?: any;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const tokenId = params.id;
          const requester_oid = params._requester_oid;
          const requestContext = params._request_context;

          if (!tokenId) {
            return Response.json(
              { error: "Token ID required" },
              { status: 400 }
            );
          }

          // DPoP is required for token mutations
          if (!requestContext || requestContext.source !== "connect_token") {
            return Response.json(
              {
                error: "DPoP-bound Connect token required for token mutations",
              },
              { status: 401 }
            );
          }

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
              from?: string;
              to?: string;
              amount?: string; // BigInt as string
              nonce?: string; // BigInt as string
              tx_id?: string;
              memo?: string;
            };

            // Validate required fields
            if (
              !body.from ||
              !body.to ||
              !body.amount ||
              !body.nonce ||
              !body.tx_id
            ) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["from", "to", "amount", "nonce", "tx_id"],
                },
                { status: 400 }
              );
            }

            // Validate OIDs
            const from = ensureOid(body.from, "from", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });
            const to = ensureOid(body.to, "to", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });

            // Parse amount and nonce (BigInt from string)
            const amount = BigInt(body.amount);
            const nonce = BigInt(body.nonce);

            if (amount <= 0) {
              return Response.json(
                { error: "Amount must be greater than 0" },
                { status: 400 }
              );
            }

            // Build context from request
            const ctx: Record<string, unknown> = {};
            if (requestContext.claims?.grant_id) {
              ctx.grant_jti = requestContext.claims.grant_id;
            }
            if (requestContext.claims?.cnf?.jkt) {
              ctx.dpop_thumbprint = requestContext.claims.cnf.jkt;
            }
            if (body.memo) {
              ctx.memo = body.memo;
            }

            // Transfer tokens
            const result = await tokenService.transferToken({
              tokenId,
              from,
              to,
              amount,
              nonce,
              txId: body.tx_id,
              actorOid: requester_oid || "unknown",
              ctx: Object.keys(ctx).length > 0 ? ctx : undefined,
            });

            return Response.json({
              tx_id: result.tx_id,
              ledger_id: result.ledger_id,
              token_id: result.token_id,
              kind: result.kind,
              from: result.from,
              to: result.to,
              amount: result.amount.toString(),
              from_balance: result.from_balance.toString(),
              to_balance: result.to_balance.toString(),
              from_nonce: result.from_nonce.toString(),
              to_nonce: result.to_nonce.toString(),
              timestamp: result.timestamp,
            });
          } catch (error) {
            console.error("Token transfer error:", error);
            return Response.json(
              {
                error: "Failed to transfer tokens",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // POST /token/:id/burn - Burn tokens (requires DPoP)
      {
        method: "POST",
        path: "/token/:id/burn",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
            _request_context?: any;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const tokenId = params.id;
          const requester_oid = params._requester_oid;
          const requestContext = params._request_context;

          if (!tokenId) {
            return Response.json(
              { error: "Token ID required" },
              { status: 400 }
            );
          }

          // DPoP is required for token mutations
          if (!requestContext || requestContext.source !== "connect_token") {
            return Response.json(
              {
                error: "DPoP-bound Connect token required for token mutations",
              },
              { status: 401 }
            );
          }

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
              from?: string;
              amount?: string; // BigInt as string
              nonce?: string; // BigInt as string
              tx_id?: string;
              memo?: string;
            };

            // Validate required fields
            if (!body.from || !body.amount || !body.nonce || !body.tx_id) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["from", "amount", "nonce", "tx_id"],
                },
                { status: 400 }
              );
            }

            // Validate OID
            const from = ensureOid(body.from, "from", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });

            // Parse amount and nonce (BigInt from string)
            const amount = BigInt(body.amount);
            const nonce = BigInt(body.nonce);

            if (amount <= 0) {
              return Response.json(
                { error: "Amount must be greater than 0" },
                { status: 400 }
              );
            }

            // Build context from request
            const ctx: Record<string, unknown> = {};
            if (requestContext.claims?.grant_id) {
              ctx.grant_jti = requestContext.claims.grant_id;
            }
            if (requestContext.claims?.cnf?.jkt) {
              ctx.dpop_thumbprint = requestContext.claims.cnf.jkt;
            }
            if (body.memo) {
              ctx.memo = body.memo;
            }

            // Burn tokens
            const result = await tokenService.burnToken({
              tokenId,
              from,
              amount,
              nonce,
              txId: body.tx_id,
              actorOid: requester_oid || "unknown",
              ctx: Object.keys(ctx).length > 0 ? ctx : undefined,
            });

            return Response.json({
              tx_id: result.tx_id,
              ledger_id: result.ledger_id,
              token_id: result.token_id,
              kind: result.kind,
              from: result.from,
              amount: result.amount.toString(),
              new_balance: result.new_balance.toString(),
              new_supply: result.new_supply.toString(),
              timestamp: result.timestamp,
            });
          } catch (error) {
            console.error("Token burn error:", error);
            return Response.json(
              {
                error: "Failed to burn tokens",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /token/:id/balance - Get token balance
      {
        method: "GET",
        path: "/token/:id/balance",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const tokenId = params.id;
          const requester_oid = params._requester_oid;

          if (!tokenId) {
            return Response.json(
              { error: "Token ID required" },
              { status: 400 }
            );
          }

          try {
            // Parse query parameters
            const url = new URL(req.url);
            const subject_oid = url.searchParams.get("subject_oid");

            if (!subject_oid) {
              return Response.json(
                { error: "subject_oid query parameter required" },
                { status: 400 }
              );
            }

            // Validate OID
            const subjectOid = ensureOid(subject_oid, "subject_oid", {
              allowHierarchical: true,
              allowExternalNamespaces: true,
            });

            // Get balance
            const balance = await tokenService.getBalance(
              tokenId,
              subjectOid,
              requester_oid
            );

            if (!balance) {
              return Response.json(
                { error: "Balance not found or access denied" },
                { status: 404 }
              );
            }

            return Response.json({
              token_id: balance.token_id,
              subject_oid: balance.subject_oid,
              balance: balance.balance.toString(),
              balance_formatted: balance.balance_formatted,
              nonce: balance.nonce.toString(),
              updated_at: balance.updated_at,
            });
          } catch (error) {
            console.error("Balance retrieval error:", error);
            return Response.json(
              {
                error: "Failed to retrieve balance",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /token/list - List tokens
      {
        method: "GET",
        path: "/token/list",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const requester_oid = params._requester_oid;

          try {
            // Parse query parameters
            const url = new URL(req.url);
            const issuer_oid = url.searchParams.get("issuer_oid") || undefined;
            const status = url.searchParams.get("status") as
              | "active"
              | "paused"
              | undefined;
            const limit = url.searchParams.get("limit")
              ? parseInt(url.searchParams.get("limit")!, 10)
              : undefined;
            const cursor = url.searchParams.get("cursor")
              ? parseInt(url.searchParams.get("cursor")!, 10)
              : undefined;

            // List tokens
            const result = await tokenService.listTokens(
              {
                issuer_oid,
                status,
                limit,
                cursor,
              },
              requester_oid
            );

            return Response.json({
              tokens: result.tokens.map((token) => ({
                token_id: token.id,
                issuer_oid: token.issuerOid,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                supply_cap: token.supplyCap?.toString(),
                supply: token.supply.toString(),
                supply_formatted: tokenService.formatBalance(
                  token.supply,
                  token.decimals
                ),
                status: token.status,
                metadata: token.metadata,
                admin_policy: token.adminPolicy,
                created_at: token.createdAt,
                updated_at: token.updatedAt,
              })),
              next_cursor: result.next_cursor,
              has_more: result.has_more,
            });
          } catch (error) {
            console.error("Token list error:", error);
            return Response.json(
              {
                error: "Failed to list tokens",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /token/:id/holders - Get token holders
      {
        method: "GET",
        path: "/token/:id/holders",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const tokenId = params.id;
          const requester_oid = params._requester_oid;

          if (!tokenId) {
            return Response.json(
              { error: "Token ID required" },
              { status: 400 }
            );
          }

          try {
            // Parse query parameters
            const url = new URL(req.url);
            const limit = url.searchParams.get("limit")
              ? parseInt(url.searchParams.get("limit")!, 10)
              : 100;
            const cursor = url.searchParams.get("cursor")
              ? parseInt(url.searchParams.get("cursor")!, 10)
              : undefined;

            // Get holders
            const result = await tokenService.getHolders(
              tokenId,
              requester_oid,
              limit,
              cursor
            );

            return Response.json({
              holders: result.holders.map((holder) => ({
                subject_oid: holder.subject_oid,
                balance: holder.balance.toString(),
                balance_formatted: holder.balance_formatted,
                nonce: holder.nonce.toString(),
                updated_at: holder.updated_at,
              })),
              next_cursor: result.next_cursor,
              has_more: result.has_more,
            });
          } catch (error) {
            console.error("Holders retrieval error:", error);
            return Response.json(
              {
                error: "Failed to retrieve holders",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /token/:id/ledger - Get token ledger history
      {
        method: "GET",
        path: "/token/:id/ledger",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const tokenService = ledger.getService<TokenService>("tokenService");
          const tokenId = params.id;
          const requester_oid = params._requester_oid;

          if (!tokenId) {
            return Response.json(
              { error: "Token ID required" },
              { status: 400 }
            );
          }

          try {
            // Parse query parameters
            const url = new URL(req.url);
            const limit = url.searchParams.get("limit")
              ? parseInt(url.searchParams.get("limit")!, 10)
              : 100;
            const cursor = url.searchParams.get("cursor")
              ? parseInt(url.searchParams.get("cursor")!, 10)
              : undefined;

            // Get ledger history
            const result = await tokenService.getLedgerHistory(
              tokenId,
              requester_oid,
              limit,
              cursor
            );

            return Response.json({
              entries: result.entries.map((entry) => ({
                ledger_id: entry.ledger_id,
                ts: entry.ts,
                tx_id: entry.tx_id,
                kind: entry.kind,
                from_subject_oid: entry.from_subject_oid,
                to_subject_oid: entry.to_subject_oid,
                amount: entry.amount.toString(),
                amount_formatted: entry.amount_formatted,
                actor_oid: entry.actor_oid,
                ctx: entry.ctx,
                created_at: entry.created_at,
              })),
              next_cursor: result.next_cursor,
              has_more: result.has_more,
            });
          } catch (error) {
            console.error("Ledger history retrieval error:", error);
            return Response.json(
              {
                error: "Failed to retrieve ledger history",
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

// Re-export TokenService and types
export { TokenService } from "./services/token-service.js";
export type {
  Token,
  TokenAccount,
  TokenLedgerEntry,
  CreateTokenOptions,
  MintTokenOptions,
  TransferTokenOptions,
  BurnTokenOptions,
} from "./models/token.js";
