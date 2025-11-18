/**
 * Rate Limiting Plugin for Onoal Ledger
 *
 * Prevents abuse by rate limiting ledger operations.
 */

import type { OnoalLedgerPlugin } from "@onoal/ledger-core";

export interface RateLimitConfig {
  /**
   * Maximum number of requests
   */
  requests: number;

  /**
   * Time window
   * Format: "1m" (1 minute), "1h" (1 hour), "1d" (1 day)
   */
  window: string;
}

export interface RateLimitPluginOptions {
  /**
   * Rate limits per operation type
   */
  limits: {
    append?: RateLimitConfig;
    query?: RateLimitConfig;
    verify?: RateLimitConfig;
    get?: RateLimitConfig;
  };

  /**
   * Storage backend for rate limit counters
   * - "memory": In-memory storage (single instance)
   * - "redis": Redis storage (distributed)
   */
  storage?: "memory" | "redis";

  /**
   * Redis client (required if storage is "redis")
   */
  redisClient?: any;

  /**
   * Custom key generator function
   * Default: Uses issuer_oid or IP address
   */
  keyGenerator?: (context: {
    entry?: any;
    filters?: any;
    id?: string;
    ledger: any;
  }) => string;

  /**
   * Callback when rate limit is exceeded
   */
  onLimitExceeded?: (key: string, limit: number, operation: string) => void;

  /**
   * Custom error message formatter
   */
  errorMessage?: (limit: number, window: string) => string;
}

import { RateLimiter } from "./service.js";
import type { OnoalLedger } from "@onoal/ledger-core";

/**
 * Creates a rate limiting plugin for the ledger
 *
 * @example
 * ```typescript
 * const ledger = await createLedger({...});
 * ledger.use(rateLimitPlugin({
 *   limits: {
 *     append: { requests: 100, window: "1m" },
 *     query: { requests: 1000, window: "1m" }
 *   },
 *   storage: "memory"
 * }));
 * ```
 */
export function rateLimitPlugin(
  options: RateLimitPluginOptions
): OnoalLedgerPlugin {
  const limiter = new RateLimiter(
    options.storage || "memory",
    options.redisClient
  );

  const defaultKeyGenerator = (context: {
    entry?: any;
    filters?: any;
    id?: string;
    ledger: OnoalLedger;
  }): string => {
    // Default: use issuer_oid or "anonymous"
    if (context.entry?.issuer_oid) {
      return context.entry.issuer_oid;
    }
    if (context.filters?.issuer_oid) {
      return context.filters.issuer_oid;
    }
    return "anonymous";
  };

  const keyGenerator = options.keyGenerator || defaultKeyGenerator;

  const defaultErrorMessage = (limit: number, window: string): string => {
    return `Rate limit exceeded: ${limit} requests per ${window}`;
  };

  const errorMessage = options.errorMessage || defaultErrorMessage;

  return {
    id: "rate-limit",
    version: "1.0.0",
    hooks: {
      beforeAppend: async (entry, ledger) => {
        const limit = options.limits.append;
        if (!limit) return;

        const key = keyGenerator({ entry, ledger });
        const windowMs = RateLimiter.parseWindow(limit.window);

        const result = await limiter.checkLimit(key, limit.requests, windowMs);

        if (!result.allowed) {
          if (options.onLimitExceeded) {
            options.onLimitExceeded(key, limit.requests, "append");
          }
          throw new Error(errorMessage(limit.requests, limit.window));
        }
      },

      beforeQuery: async (filters, ledger) => {
        const limit = options.limits.query;
        if (!limit) return;

        const key = keyGenerator({ filters, ledger });
        const windowMs = RateLimiter.parseWindow(limit.window);

        const result = await limiter.checkLimit(key, limit.requests, windowMs);

        if (!result.allowed) {
          if (options.onLimitExceeded) {
            options.onLimitExceeded(key, limit.requests, "query");
          }
          throw new Error(errorMessage(limit.requests, limit.window));
        }
      },

      beforeGet: async (id, ledger) => {
        const limit = options.limits.get;
        if (!limit) return;

        const key = keyGenerator({ id, ledger });
        const windowMs = RateLimiter.parseWindow(limit.window);

        const result = await limiter.checkLimit(key, limit.requests, windowMs);

        if (!result.allowed) {
          if (options.onLimitExceeded) {
            options.onLimitExceeded(key, limit.requests, "get");
          }
          throw new Error(errorMessage(limit.requests, limit.window));
        }
      },

      beforeVerifyChain: async (startId, limit, ledger) => {
        const rateLimit = options.limits.verify;
        if (!rateLimit) return;

        const key = keyGenerator({ ledger });
        const windowMs = RateLimiter.parseWindow(rateLimit.window);

        const result = await limiter.checkLimit(
          key,
          rateLimit.requests,
          windowMs
        );

        if (!result.allowed) {
          if (options.onLimitExceeded) {
            options.onLimitExceeded(key, rateLimit.requests, "verify");
          }
          throw new Error(errorMessage(rateLimit.requests, rateLimit.window));
        }
      },
    },
  };
}
