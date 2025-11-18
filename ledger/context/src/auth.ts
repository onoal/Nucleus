/**
 * Authentication Middleware
 *
 * Based on: onoal/ledger/src/middleware/auth.ts
 * Supports: Connect tokens, Session tokens, DPoP verification
 *
 * @module context/auth
 */

/**
 * Request context extracted from authentication
 */
export interface RequestContext {
  oid: string;
  role?: string;
  token: string;
  claims: Record<string, unknown>;
  source:
    | "connect_token"
    | "session_token"
    | "service_token"
    | "dev_token"
    | "api_key";
}

/**
 * Authentication middleware options
 */
export interface AuthMiddlewareOptions {
  /**
   * Verify Connect token
   * Should return the Connect token payload with grant_id
   */
  verifyConnectToken?: (token: string, env: any) => Promise<any>;

  /**
   * Verify Session token (OIDC access token)
   * Should return the session payload with sub (subject)
   */
  verifySessionToken?: (token: string, env: any) => Promise<any>;

  /**
   * Verify DPoP proof
   * Should verify the DPoP proof against the Connect token payload
   */
  verifyDpop?: (
    dpopProof: string,
    connectPayload: any,
    htm: string,
    htu: string
  ) => Promise<void>;

  /**
   * Verify Connect grant by ID
   * Should verify that the grant exists and is active
   */
  verifyConnectGrant?: (
    grantId: string,
    appOid: string,
    env: any
  ) => Promise<void>;

  /**
   * Public paths that don't require authentication
   */
  publicPaths?: string[];

  /**
   * Environment variables (for dev tokens, API keys, etc.)
   */
  env?: {
    LEDGER_API_KEY?: string;
    [key: string]: any;
  };
}

/**
 * Create authentication middleware
 *
 * Based on: onoal/ledger/src/middleware/auth.ts:121-438
 * Returns a function that extracts request context from a Request
 *
 * @param options - Middleware configuration
 * @returns Function that extracts RequestContext from a Request
 *
 * @example
 * ```typescript
 * const authMiddleware = createAuthMiddleware({
 *   verifyConnectToken: async (token, env) => {
 *     // Verify Connect token
 *     return await verifyConnectToken(token, env);
 *   },
 *   verifySessionToken: async (token, env) => {
 *     // Verify Session token
 *     return await verifySessionToken(token, env);
 *   },
 *   publicPaths: ["/health", "/ledger/stats"],
 * });
 *
 * // Use in route handler
 * const context = await authMiddleware(req, env);
 * if (!context) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * ```
 */
export function createAuthMiddleware(
  options: AuthMiddlewareOptions
): (req: Request, env?: any) => Promise<RequestContext | null> {
  const publicPaths = new Set(
    options.publicPaths || [
      "/health",
      "/ledger/hash-root",
      "/ledger/verify",
      "/ledger/stats",
      "/.well-known/jwks.json",
    ]
  );

  function isPublicPath(path: string): boolean {
    if (publicPaths.has(path)) {
      return true;
    }

    // Allow /.well-known subpaths
    if (
      path.startsWith("/.well-known/") &&
      !path.startsWith("/.well-known/secure")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Build dev requester (for development/testing)
   */
  function buildDevRequester(
    token: string,
    env: any,
    role?: string,
    principalOverride?: string
  ): RequestContext | null {
    // Dev token format: "dev:oid:onoal:user:123"
    if (token.startsWith("dev:")) {
      const oid = token.slice(4);
      return {
        oid,
        role: role ?? "dev",
        token,
        claims: { sub: oid, role: role ?? "dev" },
        source: "dev_token",
      };
    }

    // Legacy API key fallback
    if (env?.LEDGER_API_KEY && token === env.LEDGER_API_KEY) {
      const defaultPrincipal = principalOverride || "oid:onoal:org:onoal-labs";
      return {
        oid: defaultPrincipal,
        role: role ?? "system",
        token,
        claims: { sub: defaultPrincipal, role: role ?? "system" },
        source: "api_key",
      };
    }

    return null;
  }

  return async (req: Request, env?: any): Promise<RequestContext | null> => {
    const url = new URL(req.url);

    // Check if path is public
    if (isPublicPath(url.pathname)) {
      return null; // No auth required
    }

    // Get Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null; // No auth provided
    }

    const token = authHeader.substring(7).trim();

    // Check for dev tokens and API keys first
    const devRole = req.headers.get("x-ledger-role") || undefined;
    const principalOverride =
      req.headers.get("x-ledger-principal") || undefined;
    const devRequester = buildDevRequester(
      token,
      env || options.env,
      devRole,
      principalOverride
    );
    if (devRequester) {
      return devRequester;
    }

    // Try Connect Token first (DPoP-bound, contains grant_id)
    if (options.verifyConnectToken) {
      try {
        const connectPayload = await options.verifyConnectToken(
          token,
          env || options.env
        );

        // Check if it's a Connect token (has grant_id)
        if (connectPayload.grant_id) {
          // DPoP proof is REQUIRED for Connect tokens
          const dpopProof = req.headers.get("DPoP");
          if (!dpopProof) {
            throw new Error("DPoP proof is required for Connect tokens");
          }

          // Verify DPoP proof
          if (options.verifyDpop) {
            const expectedHtu = `${url.pathname}${url.search}`;
            const expectedHtm = req.method;
            await options.verifyDpop(
              dpopProof,
              connectPayload,
              expectedHtm,
              expectedHtu
            );
          }

          // Verify grant if verification function provided
          if (options.verifyConnectGrant) {
            await options.verifyConnectGrant(
              connectPayload.grant_id,
              connectPayload.actor || connectPayload.sub,
              env || options.env
            );
          }

          // Use actor (app OID) as requester OID
          return {
            oid: connectPayload.actor || connectPayload.sub,
            role: undefined,
            token,
            claims: connectPayload as Record<string, unknown>,
            source: "connect_token",
          };
        }
      } catch (error) {
        // Not a Connect token or verification failed, continue to Session token
        // Log error in development
        if (process.env.NODE_ENV === "development") {
          console.debug("Connect token verification failed:", error);
        }
      }
    }

    // Try Session Token
    if (options.verifySessionToken) {
      try {
        const sessionPayload = await options.verifySessionToken(
          token,
          env || options.env
        );
        return {
          oid: sessionPayload.sub,
          role: sessionPayload.role,
          token,
          claims: sessionPayload as Record<string, unknown>,
          source: "session_token",
        };
      } catch (error) {
        // Not a Session token
        if (process.env.NODE_ENV === "development") {
          console.debug("Session token verification failed:", error);
        }
      }
    }

    // No valid token found
    return null;
  };
}

/**
 * Extract requester OID from request context
 *
 * Helper function to get requester OID from RequestContext
 *
 * @param context - Request context
 * @returns Requester OID or null
 */
export function getRequesterOid(context: RequestContext | null): string | null {
  return context?.oid || null;
}

