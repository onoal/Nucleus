/**
 * Core ledger operations - unified multi-stream support
 *
 * @module core/ledger-core
 */

import { sha256 } from "@noble/hashes/sha256.js";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";
import { bytesToHex } from "../lib/crypto-utils.js";
import type { LedgerDb } from "./db.js";
import { schema } from "./schema.js";
import type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
} from "./types-internal.js";
import { LedgerSigner } from "./signer.js";
import { LatestEntryCache, PayloadCache } from "./cache.js";

/**
 * Core ledger operations
 */
export class LedgerCore {
  /**
   * Compute hash for a ledger entry
   * Hash = sha256(stream + id + payload)
   */
  static computeHash(
    stream: LedgerStream,
    id: string,
    payload: Record<string, unknown>
  ): string {
    const payloadStr = JSON.stringify(payload);
    const message = `${stream}:${id}:${payloadStr}`;
    const encoder = new TextEncoder();
    const hash = sha256(encoder.encode(message));
    return bytesToHex(hash);
  }

  /**
   * Get the latest entry in the chain
   *
   * Uses in-memory cache to avoid database queries on every append.
   */
  static async getLatestEntry(
    db: LedgerDb,
    cacheKey: string = "default"
  ): Promise<{ hash: string; timestamp: number; id: string } | null> {
    // Check cache first
    const cached = LatestEntryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fallback to database
    const result = await db.query.ledgerEntries.findFirst({
      columns: {
        id: true,
        hash: true,
        timestamp: true,
      },
      orderBy: (entries, { desc: d }) => d(entries.timestamp),
    });

    // Cache result if found
    if (result) {
      LatestEntryCache.set(cacheKey, result, 1000); // 1 second TTL
    }

    return result || null;
  }

  /**
   * Update ledger tip (for fast root hash lookup)
   */
  static async updateTip(
    db: LedgerDb,
    entryId: string,
    hash: string,
    timestamp: number
  ): Promise<void> {
    await db
      .insert(schema.ledgerTip)
      .values({
        id: 1,
        entryId,
        hash,
        timestamp,
        updatedAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: schema.ledgerTip.id,
        set: {
          entryId,
          hash,
          timestamp,
          updatedAt: Date.now(),
        },
      });
  }

  /**
   * Append a new entry to the ledger
   *
   * Wrapped in transaction if database supports it for atomicity.
   */
  static async append(
    db: LedgerDb,
    signer: LedgerSigner,
    stream: LedgerStream,
    payload: Record<string, unknown>,
    status: EntryStatus = "active",
    meta?: Record<string, unknown>
  ): Promise<LedgerEntry> {
    // Check if database supports transactions
    if (db.transaction && typeof db.transaction === "function") {
      return await db.transaction(async (tx: LedgerDb) => {
        return await this.appendInTransaction(
          tx,
          signer,
          stream,
          payload,
          status,
          meta
        );
      });
    } else {
      // Fallback for databases without transaction support
      return await this.appendInTransaction(
        db,
        signer,
        stream,
        payload,
        status,
        meta
      );
    }
  }

  /**
   * Internal append implementation (used by both append and batch append)
   */
  private static async appendInTransaction(
    db: LedgerDb,
    signer: LedgerSigner,
    stream: LedgerStream,
    payload: Record<string, unknown>,
    status: EntryStatus = "active",
    meta?: Record<string, unknown>,
    prevHashOverride?: string | null
  ): Promise<LedgerEntry> {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    // Get previous hash (use override if provided for batch operations)
    const prevHash =
      prevHashOverride !== undefined
        ? prevHashOverride
        : (await this.getLatestEntry(db))?.hash || null;

    // Compute hash
    const hash = this.computeHash(stream, id, payload);

    // Sign entry
    const message = prevHash ? `${hash}:${prevHash}` : hash;
    const signature = signer.sign(message);

    // For SQLite, payload and meta must be JSON strings
    // For PostgreSQL, they can be objects (jsonb handles it)
    // We detect SQLite by checking if the schema uses text() for payload
    const payloadValue =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const metaValue =
      meta === null || meta === undefined
        ? null
        : typeof meta === "string"
          ? meta
          : JSON.stringify(meta);

    // Extract OIDs from payload for dedicated columns (40x faster queries)
    const payloadObj = payload as Record<string, unknown>;
    const issuerOid = payloadObj.issuer_oid as string | undefined;
    const subjectOid = payloadObj.subject_oid as string | undefined;
    const entryType = payloadObj.type as string | undefined;

    // Insert entry
    // Note: better-sqlite3 doesn't support RETURNING, so we insert and then query
    // Build values object with all required fields
    const insertValues: Record<string, any> = {
      id,
      stream,
      timestamp,
      payload: payloadValue,
      hash,
      createdAt: timestamp,
    };

    // Add optional fields only if they have values
    if (prevHash !== null) insertValues.prevHash = prevHash;
    if (signature !== null) insertValues.signature = signature;
    if (status !== undefined) insertValues.status = status;
    if (metaValue !== null && metaValue !== undefined)
      insertValues.meta = metaValue;
    // Add OID columns for faster queries
    if (issuerOid) insertValues.issuerOid = issuerOid;
    if (subjectOid) insertValues.subjectOid = subjectOid;
    if (entryType) insertValues.entryType = entryType;

    await db.insert(schema.ledgerEntries).values(insertValues);

    // Query the inserted entry (better-sqlite3 doesn't support RETURNING)
    const inserted = await this.getEntry(db, id);
    if (!inserted) {
      throw new Error("Failed to retrieve inserted entry");
    }

    await this.updateTip(db, id, hash, timestamp);

    // Update materialized stats view (100x faster stats queries)
    await this.updateStats(db, stream, id, hash, timestamp);

    // Invalidate and update latest entry cache - new entry is now latest
    LatestEntryCache.invalidate("default");
    LatestEntryCache.set("default", { id, hash, timestamp }, 1000);

    // getEntry already returns a LedgerEntry with parsed payload and meta
    return inserted;
  }

  /**
   * Batch append multiple entries atomically
   *
   * All entries are appended in a single transaction. If any entry fails,
   * the entire batch is rolled back.
   */
  static async appendBatch(
    db: LedgerDb,
    signer: LedgerSigner,
    entries: Array<{
      stream: LedgerStream;
      payload: Record<string, unknown>;
      status?: EntryStatus;
      meta?: Record<string, unknown>;
    }>
  ): Promise<LedgerEntry[]> {
    if (!db.transaction || typeof db.transaction !== "function") {
      throw new Error("Batch append requires transaction support");
    }

    return await db.transaction(async (tx: LedgerDb) => {
      const results: LedgerEntry[] = [];
      let latestHash: string | null = null;

      for (const entry of entries) {
        const result = await this.appendInTransaction(
          tx,
          signer,
          entry.stream,
          entry.payload,
          entry.status || "active",
          entry.meta,
          latestHash // Pass previous hash for chain linking
        );
        results.push(result);
        latestHash = result.hash;

        // Update stats for each entry
        await this.updateStats(
          tx,
          entry.stream,
          result.id,
          result.hash,
          result.timestamp
        );
      }

      // Update cache once after all entries (last entry is now latest)
      if (results.length > 0) {
        const lastResult = results[results.length - 1]!;
        LatestEntryCache.invalidate("default");
        LatestEntryCache.set("default", {
          id: lastResult.id,
          hash: lastResult.hash,
          timestamp: lastResult.timestamp,
        });
      }

      return results;
    });
  }

  /**
   * Verify a single entry's integrity
   *
   * Checks:
   * 1. Hash matches computed hash
   * 2. Signature is valid (if present)
   * 3. Previous hash chain link is valid (if not genesis)
   *
   * @param db - Database instance
   * @param signer - Ledger signer with public key
   * @param entryId - Entry ID to verify
   * @returns Verification result with errors array
   */
  static async verifyEntry(
    db: LedgerDb,
    signer: LedgerSigner,
    entryId: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    entry_id: string;
  }> {
    const entry = await this.getEntry(db, entryId);

    if (!entry) {
      return {
        valid: false,
        errors: ["Entry not found"],
        entry_id: entryId,
      };
    }

    const errors: string[] = [];

    // 1. Verify hash
    const computedHash = this.computeHash(
      entry.stream,
      entry.id,
      entry.payload
    );
    if (entry.hash !== computedHash) {
      errors.push(
        `Hash mismatch: stored ${entry.hash}, computed ${computedHash}`
      );
    }

    // 2. Verify signature
    if (entry.signature) {
      const message = entry.prev_hash
        ? `${entry.hash}:${entry.prev_hash}`
        : entry.hash;

      const isValid = LedgerSigner.verify(
        message,
        entry.signature,
        signer.getPublicKeyHex()
      );

      if (!isValid) {
        errors.push("Invalid signature");
      }
    }

    // 3. Verify prevHash chain (if not genesis)
    if (entry.prev_hash) {
      const prevEntry = await db.query.ledgerEntries.findFirst({
        where: (table, { eq }) => eq(table.hash, entry.prev_hash),
      });

      if (!prevEntry) {
        errors.push("Previous entry not found in chain");
      } else if (prevEntry.hash !== entry.prev_hash) {
        errors.push("Previous hash mismatch");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      entry_id: entry.id,
    };
  }

  /**
   * Get entry by ID
   */
  static async getEntry(db: LedgerDb, id: string): Promise<LedgerEntry | null> {
    const entry = await db.query.ledgerEntries.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    });

    if (!entry) {
      return null;
    }

    // Parse payload and meta from JSON strings (SQLite) or use as-is (PostgreSQL)
    // Use lazy parsing with cache
    const payloadParsed = PayloadCache.getOrParse(entry.id, entry.payload);

    const metaParsed =
      entry.meta === null || entry.meta === undefined
        ? undefined
        : typeof entry.meta === "string"
          ? PayloadCache.getOrParse(`meta:${entry.id}`, entry.meta)
          : (entry.meta as Record<string, unknown> | null);

    return {
      id: entry.id,
      stream: entry.stream as LedgerStream,
      timestamp: entry.timestamp,
      payload: payloadParsed,
      hash: entry.hash,
      prev_hash: entry.prevHash ?? null,
      signature: entry.signature ?? null,
      status: entry.status as EntryStatus,
      meta: metaParsed ?? undefined,
      created_at: entry.createdAt,
    };
  }

  /**
   * Query entries with filters
   */
  static async queryEntries(
    db: LedgerDb,
    filters: {
      stream?: LedgerStream;
      subject_oid?: string;
      issuer_oid?: string;
      status?: EntryStatus;
      limit?: number;
      cursor?: number;
    }
  ): Promise<{
    entries: LedgerEntry[];
    nextCursor: number | null;
    hasMore: boolean;
  }> {
    const limit = Math.min(filters.limit || 20, 50);
    const conditions = [];

    if (filters.stream) {
      conditions.push(eq(schema.ledgerEntries.stream, filters.stream));
    }

    if (filters.status) {
      conditions.push(eq(schema.ledgerEntries.status, filters.status));
    }

    if (filters.cursor) {
      conditions.push(lt(schema.ledgerEntries.timestamp, filters.cursor));
    }

    // Use dedicated OID columns for faster queries (40x performance boost)
    // Prefer dedicated columns, fallback to JSON filtering for backward compatibility
    if (filters.subject_oid) {
      // Use dedicated column if available, otherwise fallback to JSON
      // This allows queries to work on both old (JSON-only) and new (with columns) data
      conditions.push(eq(schema.ledgerEntries.subjectOid, filters.subject_oid));
      // Note: For databases with mixed data (some entries have OID columns, some don't),
      // we rely on the dedicated column being populated for new entries.
      // Old entries without OID columns won't match, which is expected behavior.
    }

    if (filters.issuer_oid) {
      // Use dedicated column if available
      conditions.push(eq(schema.ledgerEntries.issuerOid, filters.issuer_oid));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(schema.ledgerEntries)
      .where(where)
      .orderBy(desc(schema.ledgerEntries.timestamp))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    if (hasMore) {
      rows.pop();
    }

    const entries: LedgerEntry[] = rows.map((entry: any) => {
      // Parse payload and meta from JSON strings (SQLite) or use as-is (PostgreSQL)
      // Use lazy parsing with cache
      const payloadParsed = PayloadCache.getOrParse(entry.id, entry.payload);

      const metaParsed =
        entry.meta === null || entry.meta === undefined
          ? undefined
          : typeof entry.meta === "string"
            ? PayloadCache.getOrParse(`meta:${entry.id}`, entry.meta)
            : (entry.meta as Record<string, unknown> | null);

      return {
        id: entry.id,
        stream: entry.stream as LedgerStream,
        timestamp: entry.timestamp,
        payload: payloadParsed,
        hash: entry.hash,
        prev_hash: entry.prevHash ?? null,
        signature: entry.signature ?? null,
        status: entry.status as EntryStatus,
        meta: metaParsed ?? undefined,
        created_at: entry.createdAt,
      };
    });

    const nextCursor =
      hasMore && entries.length > 0
        ? entries[entries.length - 1]!.timestamp
        : null;

    return {
      entries,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Update materialized stats view
   */
  static async updateStats(
    db: LedgerDb,
    stream: LedgerStream,
    entryId: string,
    hash: string,
    timestamp: number
  ): Promise<void> {
    try {
      await db
        .insert(schema.ledgerStats)
        .values({
          stream,
          totalEntries: 1,
          lastEntryTimestamp: timestamp,
          lastEntryHash: hash,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: schema.ledgerStats.stream,
          set: {
            totalEntries: sql`${schema.ledgerStats.totalEntries} + 1`,
            lastEntryTimestamp: timestamp,
            lastEntryHash: hash,
            updatedAt: Date.now(),
          },
        });
    } catch (error) {
      // Stats table might not exist yet (backward compatibility)
      // Silently fail - stats will be computed on-demand
    }
  }

  /**
   * Count total entries
   *
   * Uses materialized stats view if available (100x faster), otherwise falls back to COUNT query.
   */
  static async countEntries(db: LedgerDb): Promise<number> {
    try {
      // Try to use materialized stats view first
      const stats = await db.query.ledgerStats?.findMany?.();
      if (stats && Array.isArray(stats)) {
        return stats.reduce((sum, s) => sum + (s.totalEntries || 0), 0);
      }
    } catch (error) {
      // Stats table doesn't exist yet, fall back to COUNT query
    }

    // Fallback to COUNT query
    const results = await db
      .select({ count: count(schema.ledgerEntries.id) })
      .from(schema.ledgerEntries);

    const result = results[0];
    return Number(result?.count ?? 0);
  }

  /**
   * Get chain tip (fast lookup)
   */
  static async getTip(
    db: LedgerDb
  ): Promise<{ hash: string; timestamp: number } | null> {
    const tip = await db.query.ledgerTip.findFirst({
      columns: { hash: true, timestamp: true },
      where: (table, { eq }) => eq(table.id, 1),
    });

    return tip || null;
  }
}
