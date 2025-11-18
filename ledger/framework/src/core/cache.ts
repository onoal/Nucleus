/**
 * Caching utilities for Ledger Framework
 *
 * Provides in-memory caching for frequently accessed data.
 */

interface CachedLatestEntry {
  hash: string;
  timestamp: number;
  id: string;
  expiresAt: number;
}

interface CachedPayload {
  parsed: Record<string, unknown>;
  expiresAt: number;
}

/**
 * Latest Entry Cache
 *
 * Caches the latest entry hash to avoid database queries on every append.
 */
export class LatestEntryCache {
  private static cache = new Map<string, CachedLatestEntry>();

  /**
   * Get cached latest entry
   */
  static get(cacheKey: string = "default"): CachedLatestEntry | null {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
    // Remove expired entry
    if (cached) {
      this.cache.delete(cacheKey);
    }
    return null;
  }

  /**
   * Set cached latest entry
   */
  static set(
    cacheKey: string,
    entry: { hash: string; timestamp: number; id: string },
    ttl: number = 1000 // 1 second default
  ): void {
    this.cache.set(cacheKey, {
      ...entry,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalidate cache for a specific key
   */
  static invalidate(cacheKey: string = "default"): void {
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache entries
   */
  static clear(): void {
    this.cache.clear();
  }
}

/**
 * Payload Cache
 *
 * Caches parsed JSON payloads to avoid repeated parsing.
 */
export class PayloadCache {
  private static cache = new Map<string, CachedPayload>();

  /**
   * Get parsed payload from cache
   */
  static get(
    entryId: string,
    raw: string | Record<string, unknown>
  ): Record<string, unknown> | null {
    const cached = this.cache.get(entryId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.parsed;
    }
    // Remove expired entry
    if (cached) {
      this.cache.delete(entryId);
    }
    return null;
  }

  /**
   * Set parsed payload in cache
   */
  static set(
    entryId: string,
    parsed: Record<string, unknown>,
    ttl: number = 60000 // 1 minute default
  ): void {
    this.cache.set(entryId, {
      parsed,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Get or parse payload (with caching)
   */
  static getOrParse(
    entryId: string,
    raw: string | Record<string, unknown>
  ): Record<string, unknown> {
    // Check cache first
    const cached = this.get(entryId, raw);
    if (cached) {
      return cached;
    }

    // Parse if not cached
    const parsed =
      typeof raw === "string" ? JSON.parse(raw) : raw;

    // Cache result
    this.set(entryId, parsed);

    return parsed;
  }

  /**
   * Invalidate cache for a specific entry
   */
  static invalidate(entryId: string): void {
    this.cache.delete(entryId);
  }

  /**
   * Clear all cached payloads
   */
  static clear(): void {
    this.cache.clear();
  }
}

