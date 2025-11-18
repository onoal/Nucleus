/**
 * Testing Utilities for Ledger Framework
 *
 * Framework-specific implementation of testing utilities.
 *
 * @module testing
 */

import type {
  OnoalLedger,
  OnoalLedgerConfig,
  OnoalLedgerModule,
} from "../core/types.js";
import { createLedger } from "../core/ledger.js";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import type { TestServer } from "@onoal/core/testing";

/**
 * Options for creating a test ledger
 */
export interface TestLedgerOptions {
  /** Ledger name (default: "test-ledger") */
  name?: string;
  /** Modules to load */
  modules?: OnoalLedgerModule[];
  /** Plugins to load */
  plugins?: OnoalLedgerConfig["plugins"];
  /** Custom signing key (default: random) */
  signingKey?: Uint8Array;
  /** Logger configuration (default: error level, no colors) */
  logger?: OnoalLedgerConfig["logger"];
  /** Custom database path (default: ":memory:") */
  databasePath?: string;
}

/**
 * Create a test ledger instance
 *
 * Automatically uses in-memory SQLite database for fast, isolated tests.
 * Logs are suppressed by default (error level only).
 *
 * @param options - Test ledger configuration
 * @returns Configured ledger instance
 *
 * @example
 * ```typescript
 * import { createTestLedger } from "@onoal/ledger-core/testing";
 * import { myModule } from "./my-module";
 *
 * describe("My Module", () => {
 *   it("should register service", async () => {
 *     const ledger = await createTestLedger({
 *       modules: [myModule],
 *     });
 *
 *     expect(ledger.hasService("myService")).toBe(true);
 *   });
 * });
 * ```
 */
export async function createTestLedger(
  options: TestLedgerOptions = {}
): Promise<OnoalLedger> {
  // Generate random signing key if not provided
  const signingKey =
    options.signingKey ||
    (() => {
      const key = new Uint8Array(32);
      crypto.getRandomValues(key);
      return key;
    })();

  // Create in-memory SQLite database
  const database = sqliteAdapter({
    path: options.databasePath || ":memory:",
    enableWAL: true,
  });

  // Create ledger with test configuration
  const ledger = await createLedger({
    name: options.name || "test-ledger",
    signingKey,
    database,
    modules: options.modules || [],
    plugins: options.plugins || [],
    logger: options.logger || {
      level: "error", // Suppress logs in tests
      enableColors: false,
      enableTimestamp: false,
      enableContext: false,
      format: "json",
    },
  });

  return ledger;
}

/**
 * Create a test HTTP server
 *
 * Creates a mock HTTP server that can handle requests to ledger routes.
 * Useful for testing route handlers without starting a real server.
 *
 * @param ledger - Ledger instance
 * @param baseUrl - Base URL for requests (default: "http://localhost:3000")
 * @returns Test server instance
 */
export function createTestServer(
  ledger: OnoalLedger,
  baseUrl: string = "http://localhost:3000"
): TestServer {
  // Get all routes from modules
  const routes: Array<{
    method: string;
    path: string;
    handler: (
      req: Request,
      ledger: OnoalLedger,
      params?: any
    ) => Promise<Response>;
  }> = [];

  for (const module of ledger.getModules()) {
    if (module.routes) {
      for (const route of module.routes) {
        routes.push({
          method: route.method,
          path: route.path,
          handler: route.handler,
        });
      }
    }
  }

  // Helper to find matching route
  const findRoute = (method: string, path: string) => {
    for (const route of routes) {
      if (route.method !== method) continue;

      // Simple path matching (supports :param)
      const routePattern = route.path.replace(/:[^/]+/g, "([^/]+)");
      const regex = new RegExp(`^${routePattern}$`);
      const match = path.match(regex);

      if (match) {
        // Extract params
        const paramNames = route.path.match(/:[^/]+/g) || [];
        const params: Record<string, string> = {};
        paramNames.forEach((paramName, index) => {
          const paramValue = match[index + 1];
          if (paramValue) {
            params[paramName.slice(1)] = paramValue;
          }
        });

        return { route, params };
      }
    }
    return null;
  };

  // Helper to create request
  const makeRequest = async (
    method: string,
    path: string,
    body?: any,
    options?: RequestInit
  ): Promise<Response> => {
    const url = `${baseUrl}${path}`;
    const found = findRoute(method, path);

    if (!found) {
      return new Response(JSON.stringify({ error: "Not Found", path }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const request = new Request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    try {
      return await found.route.handler(request, ledger, found.params);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  return {
    get: (path: string, options?: RequestInit) =>
      makeRequest("GET", path, undefined, options),
    post: (path: string, body?: any, options?: RequestInit) =>
      makeRequest("POST", path, body, options),
    put: (path: string, body?: any, options?: RequestInit) =>
      makeRequest("PUT", path, body, options),
    delete: (path: string, options?: RequestInit) =>
      makeRequest("DELETE", path, undefined, options),
    patch: (path: string, body?: any, options?: RequestInit) =>
      makeRequest("PATCH", path, body, options),
  };
}

// Re-export utilities from @onoal/core
export { mockService, waitForHook } from "@onoal/core/testing";
export {
  testEntries,
  testOids,
  createTestEntry,
  seedTestData,
} from "@onoal/core";
