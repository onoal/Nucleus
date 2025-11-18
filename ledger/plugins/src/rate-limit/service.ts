/**
 * Rate Limiter Service
 *
 * Implements rate limiting with sliding window algorithm.
 * Supports both in-memory and Redis storage.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitWindow {
  requests: number[];
  resetAt: number;
}

export class RateLimiter {
  // In-memory storage for rate limits
  private memoryStore = new Map<string, RateLimitWindow>();

  constructor(
    private storage: "memory" | "redis",
    private redisClient?: any
  ) {}

  /**
   * Check if a request is within rate limit
   */
  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    if (this.storage === "memory") {
      return this.checkMemoryLimit(key, limit, windowMs);
    } else {
      return this.checkRedisLimit(key, limit, windowMs);
    }
  }

  /**
   * In-memory rate limiting (sliding window)
   */
  private checkMemoryLimit(
    key: string,
    limit: number,
    windowMs: number
  ): RateLimitResult {
    const now = Date.now();
    const window = this.getOrCreateWindow(key, windowMs);

    // Remove old entries outside the window
    window.requests = window.requests.filter((ts) => ts > now - windowMs);

    const allowed = window.requests.length < limit;
    if (allowed) {
      window.requests.push(now);
    }

    // Update reset time
    window.resetAt = now + windowMs;

    return {
      allowed,
      remaining: Math.max(0, limit - window.requests.length),
      resetAt: window.resetAt,
    };
  }

  /**
   * Redis-based rate limiting
   */
  private async checkRedisLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    if (!this.redisClient) {
      throw new Error("Redis client not provided for Redis rate limiting");
    }

    const redisKey = `rate_limit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Redis sorted set for sliding window
      // Score is timestamp, value is request ID
      const requestId = crypto.randomUUID();

      // Add current request
      await this.redisClient.zAdd(redisKey, {
        score: now,
        value: requestId,
      });

      // Remove old entries
      await this.redisClient.zRemRangeByScore(redisKey, 0, windowStart);

      // Count requests in window
      const count = await this.redisClient.zCard(redisKey);

      // Set expiration
      await this.redisClient.expire(redisKey, Math.ceil(windowMs / 1000));

      const allowed = count <= limit;
      const ttl = await this.redisClient.ttl(redisKey);

      return {
        allowed,
        remaining: Math.max(0, limit - count),
        resetAt: now + ttl * 1000,
      };
    } catch (error) {
      // Fallback to allowing request if Redis fails
      console.error("Redis rate limit check failed:", error);
      return {
        allowed: true,
        remaining: limit,
        resetAt: now + windowMs,
      };
    }
  }

  /**
   * Get or create a rate limit window
   */
  private getOrCreateWindow(key: string, windowMs: number): RateLimitWindow {
    if (!this.memoryStore.has(key)) {
      this.memoryStore.set(key, {
        requests: [],
        resetAt: Date.now() + windowMs,
      });
    }
    return this.memoryStore.get(key)!;
  }

  /**
   * Parse window string to milliseconds
   * Examples: "1m" -> 60000, "1h" -> 3600000, "1d" -> 86400000
   */
  static parseWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(
        `Invalid window format: ${window}. Use format like "1m", "1h", "1d"`
      );
    }

    const value = parseInt(match[1]!, 10);
    const unit = match[2]!;

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }
}
