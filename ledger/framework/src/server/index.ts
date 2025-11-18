/**
 * API Server for Ledger Framework
 *
 * Creates a standalone API server that exposes ledger functionality via REST endpoints.
 * Routes are registered by modules, similar to Registry Framework pattern.
 *
 * @module server
 */

import type { OnoalLedger, OnoalLedgerModule } from "../core/types.js";
import type {
  RequestContext,
  AuthMiddlewareOptions,
} from "../middleware/auth.js";
import { createAuthMiddleware, getRequesterOid } from "../middleware/auth.js";

/**
 * Route definition for ledger API
 */
export interface LedgerRoute {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: (
    req: Request,
    ledger: OnoalLedger,
    params: Record<string, string | undefined> & {
      _requester_oid?: string;
      _request_context?: RequestContext | null;
    }
  ) => Promise<Response>;
}

/**
 * Matched route with extracted parameters
 */
interface MatchedRoute {
  route: LedgerRoute;
  params: Record<string, string>;
}

/**
 * Create a ledger API server
 *
 * Collects routes from all modules and provides request handling.
 * Optionally includes authentication middleware.
 *
 * @param ledger - Ledger instance
 * @param options - Server options including auth middleware
 * @returns Server object with routes and request handler
 *
 * @example
 * ```typescript
 * const ledger = await createLedger({ ... });
 * const server = createLedgerServer(ledger, {
 *   auth: {
 *     verifyConnectToken: async (token, env) => {
 *       // Verify Connect token
 *       return await verifyConnectToken(token, env);
 *     },
 *     verifySessionToken: async (token, env) => {
 *       // Verify Session token
 *       return await verifySessionToken(token, env);
 *     },
 *     publicPaths: ["/health", "/ledger/stats"],
 *   },
 * });
 *
 * // In Cloudflare Worker
 * export default {
 *   async fetch(request: Request, env: Env): Promise<Response> {
 *     return server.handleRequest(request, env);
 *   }
 * };
 *
 * // In Express
 * app.all("*", async (req, res) => {
 *   const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
 *   const request = new Request(url, {
 *     method: req.method,
 *     headers: req.headers as HeadersInit,
 *     body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
 *   });
 *   const response = await server.handleRequest(request, process.env);
 *   const data = await response.json();
 *   res.status(response.status).json(data);
 * });
 * ```
 */
export function createLedgerServer(
  ledger: OnoalLedger,
  options?: {
    auth?: AuthMiddlewareOptions;
  }
) {
  // Collect all routes from modules
  const routes: LedgerRoute[] = [];

  for (const module of ledger.getModules()) {
    if (module.routes) {
      routes.push(...module.routes);
    }
  }

  /**
   * Match route from request
   */
  function matchRoute(method: string, pathname: string): MatchedRoute | null {
    for (const route of routes) {
      if (route.method !== method) {
        continue;
      }

      // Convert route path to regex
      // e.g., "/ledger/proof/:id" -> "^/ledger/proof/([^/]+)$"
      const routePattern = route.path
        .replace(/:[^/]+/g, "([^/]+)")
        .replace(/\//g, "\\/");
      const regex = new RegExp(`^${routePattern}$`);

      const match = pathname.match(regex);
      if (match) {
        // Extract parameter names from route path
        const paramNames = route.path.match(/:[^/]+/g) || [];
        const params: Record<string, string> = {};

        paramNames.forEach((param, index) => {
          const paramName = param.slice(1); // Remove ':'
          const value = match[index + 1];
          if (value) {
            params[paramName] = value;
          }
        });

        return { route, params };
      }
    }

    return null;
  }

  // Create auth middleware if options provided
  const authMiddleware = options?.auth
    ? createAuthMiddleware(options.auth)
    : null;

  /**
   * Handle request (for Hono/Express/Fastify)
   *
   * @param req - Request object
   * @param env - Environment variables (for auth middleware)
   * @returns Response object
   *
   * @example
   * ```typescript
   * const server = createLedgerServer(ledger, { auth: { ... } });
   * const response = await server.handleRequest(request, env);
   * ```
   */
  async function handleRequest(req: Request, env?: any): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;

    // Run authentication middleware if configured
    let requestContext: RequestContext | null = null;
    if (authMiddleware) {
      requestContext = await authMiddleware(req, env);

      // If auth is required and no context was returned, return 401
      // (authMiddleware returns null for public paths, so we need to check)
      if (
        !requestContext &&
        !options?.auth?.publicPaths?.some((path) => pathname.startsWith(path))
      ) {
        return Response.json(
          {
            error: "unauthorized",
            message: "Authorization header with Bearer token is required",
          },
          { status: 401 }
        );
      }
    }

    // Match route
    const matched = matchRoute(method, pathname);

    if (!matched) {
      return Response.json(
        { error: "Not found", path: pathname, method },
        { status: 404 }
      );
    }

    // Call beforeRoute hooks
    // Hooks are called in module registration order
    // If a hook returns a Response, short-circuit (don't execute route handler)
    for (const module of ledger.getModules()) {
      if (module.routeHooks?.beforeRoute) {
        try {
          const result = await module.routeHooks.beforeRoute(
            req,
            matched.route,
            ledger
          );
          // If hook returns Response, short-circuit
          if (result instanceof Response) {
            return result;
          }
        } catch (error) {
          console.error(`Module ${module.id} beforeRoute hook failed:`, error);
          return Response.json(
            {
              error: "Internal server error",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      }
    }

    try {
      // Add request context to params for route handlers
      const paramsWithContext: Record<string, any> = {
        ...matched.params,
      };

      // Add requester OID and context if available
      if (requestContext) {
        paramsWithContext._requester_oid = requestContext.oid;
        paramsWithContext._request_context = requestContext;
      }

      // Execute route handler with extracted params and context
      let response = await matched.route.handler(
        req,
        ledger,
        paramsWithContext as any
      );

      // Call afterRoute hooks
      // Hooks are called in module registration order
      // Hooks can modify the response (headers, logging, metrics, etc.)
      for (const module of ledger.getModules()) {
        if (module.routeHooks?.afterRoute) {
          try {
            response = await module.routeHooks.afterRoute(
              req,
              matched.route,
              response,
              ledger
            );
          } catch (error) {
            // Log error but don't fail request (hooks are non-critical)
            console.error(`Module ${module.id} afterRoute hook failed:`, error);
          }
        }
      }

      return response;
    } catch (error) {
      console.error("Route handler error:", error);
      return Response.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  return {
    ledger,
    routes,
    matchRoute,
    handleRequest,
  };
}

export type LedgerServer = ReturnType<typeof createLedgerServer>;
