/**
 * Route Helpers
 *
 * Utility functions for route handlers: response creation, request parsing, pagination, etc.
 * These helpers can be imported and used in custom endpoints, similar to React hooks.
 *
 * @module routes/helpers
 */

/**
 * JSON response helper
 *
 * @param data - Data to return in response
 * @param status - HTTP status code (default: 200)
 * @returns Response object
 *
 * @example
 * ```typescript
 * return json({ id: "123", name: "Token" }, 201);
 * ```
 */
export function json(data: any, status = 200): Response {
  // Serialize BigInt values to strings for JSON compatibility
  const serialized = JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
  return Response.json(serialized, { status });
}

/**
 * Error response helper
 *
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @returns Response object with error format
 *
 * @example
 * ```typescript
 * return error("Missing required field: name", 400);
 * ```
 */
export function error(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Not found response helper
 *
 * @param message - Error message (default: "Not found")
 * @returns Response object with 404 status
 *
 * @example
 * ```typescript
 * return notFound("Token not found");
 * ```
 */
export function notFound(message = "Not found"): Response {
  return error(message, 404);
}

/**
 * Unauthorized response helper
 *
 * @param message - Error message (default: "Unauthorized")
 * @returns Response object with 401 status
 *
 * @example
 * ```typescript
 * return unauthorized("Authentication required");
 * ```
 */
export function unauthorized(message = "Unauthorized"): Response {
  return error(message, 401);
}

/**
 * Parse JSON body helper
 *
 * Validates Content-Type header and parses JSON body.
 * Throws error if Content-Type is not application/json.
 *
 * @param req - Request object
 * @returns Parsed JSON body
 * @throws Error if Content-Type is not application/json
 *
 * @example
 * ```typescript
 * const body = await parseBody<{ name: string; email: string }>(req);
 * ```
 */
export async function parseBody<T>(req: Request): Promise<T> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error('Content-Type must be "application/json"');
  }
  return req.json() as Promise<T>;
}

/**
 * Pagination helper
 *
 * Extracts pagination parameters from query string.
 * Limits maximum page size to 50.
 *
 * @param req - Request object
 * @returns Pagination parameters (limit, cursor)
 *
 * @example
 * ```typescript
 * const { limit, cursor } = getPagination(req);
 * const results = await service.list({ limit, cursor });
 * ```
 */
export function getPagination(req: Request): {
  limit: number;
  cursor?: number;
} {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  let limit = 20; // Default

  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    // Only use parsed value if it's a valid positive number
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 50);
    }
  }

  const cursorParam = url.searchParams.get("cursor");
  let cursor: number | undefined = undefined;
  if (cursorParam) {
    const parsed = parseInt(cursorParam, 10);
    // Only use parsed value if it's a valid number
    if (!isNaN(parsed)) {
      cursor = parsed;
    }
  }

  return { limit, cursor };
}

/**
 * Get query parameter helper
 *
 * @param req - Request object
 * @param key - Query parameter key
 * @returns Query parameter value or null if not found
 *
 * @example
 * ```typescript
 * const filter = getQueryParam(req, "filter");
 * ```
 */
export function getQueryParam(req: Request, key: string): string | null {
  const url = new URL(req.url);
  return url.searchParams.get(key);
}
