/**
 * Hash chain implementation for ledger integrity
 *
 * @module core/hash-chain
 */

import { sha256 } from "@noble/hashes/sha256.js";
import { asc, and, count, desc, eq, gte, lte, max, min } from "drizzle-orm";
import { bytesToHex } from "../lib/crypto-utils.js";
import type { LedgerDb } from "./db.js";
import { schema } from "./schema.js";
import type { ChainVerificationResult } from "./types-internal.js";
import { LedgerSigner } from "./signer.js";
import { LedgerCore } from "./ledger-core.js";
import type { LedgerStream } from "./types-internal.js";

/**
 * Hash chain manager for ledger integrity
 */
export class HashChain {
  /**
   * Compute SHA-256 hash of payload
   */
  static computeHash(payload: unknown): string {
    const payloadStr = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const hash = sha256(encoder.encode(payloadStr));
    return bytesToHex(hash);
  }

  /**
   * Get the latest entry in the chain
   */
  static async getLatestEntry(
    db: LedgerDb
  ): Promise<{ hash: string; timestamp: number } | null> {
    const result = await db.query.ledgerEntries.findFirst({
      columns: { hash: true, timestamp: true },
      orderBy: (table, { desc: d }) => d(table.timestamp),
    });

    return result || null;
  }

  /**
   * Verify chain integrity
   *
   * Enhanced with hash recomputation, signature verification, and detailed error tracking
   *
   * @param db - Database instance
   * @param signer - Ledger signer with public key for signature verification
   * @param startId - Optional entry ID to start verification from
   * @param limit - Maximum number of entries to verify (default: 100)
   * @returns Chain verification result with detailed statistics and errors
   */
  static async verifyChain(
    db: LedgerDb,
    signer: LedgerSigner,
    startId?: string,
    limit: number = 100
  ): Promise<ChainVerificationResult> {
    // Early return if limit is 0
    if (limit === 0) {
      return { valid: true, entries_checked: 0 };
    }

    let startTimestamp: number | undefined;

    if (startId) {
      const startEntry = await db.query.ledgerEntries.findFirst({
        columns: { timestamp: true },
        where: (table, { eq }) => eq(table.id, startId),
      });

      if (!startEntry) {
        return { valid: true, entries_checked: 0 };
      }

      startTimestamp = startEntry.timestamp;
    }

    const whereClause = startTimestamp
      ? gte(schema.ledgerEntries.timestamp, startTimestamp)
      : undefined;

    const rows = await db
      .select({
        id: schema.ledgerEntries.id,
        stream: schema.ledgerEntries.stream,
        hash: schema.ledgerEntries.hash,
        prevHash: schema.ledgerEntries.prevHash,
        timestamp: schema.ledgerEntries.timestamp,
        payload: schema.ledgerEntries.payload,
        signature: schema.ledgerEntries.signature,
      })
      .from(schema.ledgerEntries)
      .where(whereClause)
      .orderBy(asc(schema.ledgerEntries.timestamp))
      .limit(limit);

    if (rows.length === 0) {
      return { valid: true, entries_checked: 0 };
    }

    const startTime = Date.now();
    let prevHash: string | null = null;
    let lastTimestamp: number | null = null;
    let entriesChecked = 0;
    let hashMismatches = 0;
    let signatureFailures = 0;
    let timestampIssues = 0;
    let payloadErrors = 0;
    const errors: Array<{
      entry_id: string;
      type:
        | "hash_mismatch"
        | "signature_invalid"
        | "timestamp_out_of_order"
        | "payload_invalid";
      message: string;
    }> = [];

    for (const entry of rows) {
      // 1. Verify payload can be parsed and is valid
      let payloadParsed: Record<string, unknown>;
      try {
        payloadParsed =
          typeof entry.payload === "string"
            ? JSON.parse(entry.payload)
            : (entry.payload as Record<string, unknown>);

        // Verify payload is object
        if (typeof payloadParsed !== "object" || payloadParsed === null) {
          payloadErrors++;
          errors.push({
            entry_id: entry.id,
            type: "payload_invalid",
            message: "Payload is not an object",
          });

          return {
            valid: false,
            error: `Invalid payload at entry ${entry.id}: not an object`,
            entries_checked: entriesChecked,
            hash_mismatches: hashMismatches,
            signature_failures: signatureFailures,
            timestamp_issues: timestampIssues,
            payload_errors: payloadErrors,
            errors,
          };
        }
      } catch (error) {
        payloadErrors++;
        errors.push({
          entry_id: entry.id,
          type: "payload_invalid",
          message: `Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`,
        });

        return {
          valid: false,
          error: `Invalid JSON payload at entry ${entry.id}`,
          entries_checked: entriesChecked,
          hash_mismatches: hashMismatches,
          signature_failures: signatureFailures,
          timestamp_issues: timestampIssues,
          payload_errors: payloadErrors,
          errors,
        };
      }

      // 2. Verify hash matches computed hash
      const computedHash = LedgerCore.computeHash(
        entry.stream as LedgerStream,
        entry.id,
        payloadParsed
      );

      if (entry.hash !== computedHash) {
        hashMismatches++;
        errors.push({
          entry_id: entry.id,
          type: "hash_mismatch",
          message: `Hash mismatch: stored ${entry.hash}, computed ${computedHash}`,
        });

        return {
          valid: false,
          error: `Hash mismatch at entry ${entry.id}`,
          entries_checked: entriesChecked,
          hash_mismatches: hashMismatches,
          signature_failures: signatureFailures,
          timestamp_issues: timestampIssues,
          payload_errors: payloadErrors,
          errors,
        };
      }

      // 3. Verify signature if present
      if (entry.signature) {
        const message = entry.prevHash
          ? `${entry.hash}:${entry.prevHash}`
          : entry.hash;

        const isValid = LedgerSigner.verify(
          message,
          entry.signature,
          signer.getPublicKeyHex()
        );

        if (!isValid) {
          signatureFailures++;
          errors.push({
            entry_id: entry.id,
            type: "signature_invalid",
            message: "Invalid signature",
          });

          return {
            valid: false,
            error: `Invalid signature at entry ${entry.id}`,
            entries_checked: entriesChecked,
            hash_mismatches: hashMismatches,
            signature_failures: signatureFailures,
            timestamp_issues: timestampIssues,
            payload_errors: payloadErrors,
            errors,
          };
        }
      }

      // 4. Verify timestamp ordering
      if (lastTimestamp !== null && entry.timestamp < lastTimestamp) {
        timestampIssues++;
        errors.push({
          entry_id: entry.id,
          type: "timestamp_out_of_order",
          message: `Timestamp out of order: ${entry.timestamp} < ${lastTimestamp}`,
        });

        return {
          valid: false,
          error: `Timestamp out of order at entry ${entry.id}: ${entry.timestamp} < ${lastTimestamp}`,
          entries_checked: entriesChecked,
          hash_mismatches: hashMismatches,
          signature_failures: signatureFailures,
          timestamp_issues: timestampIssues,
          payload_errors: payloadErrors,
          errors,
        };
      }

      // Optional: Check for large gaps (warning only, doesn't fail verification)
      if (lastTimestamp !== null) {
        const gap = entry.timestamp - lastTimestamp;
        if (gap > 24 * 60 * 60 * 1000) {
          // 24 hours - log warning but don't fail
          // This could be intentional (e.g., system downtime)
          // We could add this to a warnings array in the future
        }
      }

      // 5. Verify prevHash chain (existing check)
      if (prevHash === null && entry.prevHash !== null && !startTimestamp) {
        return {
          valid: false,
          error: `First entry ${entry.id} has non-null prev_hash`,
          entries_checked: entriesChecked,
          hash_mismatches: hashMismatches,
          signature_failures: signatureFailures,
          timestamp_issues: timestampIssues,
          payload_errors: payloadErrors,
          errors,
        };
      }

      if (prevHash !== null && entry.prevHash !== prevHash) {
        return {
          valid: false,
          error: `Chain broken at entry ${entry.id}: expected prev_hash ${prevHash}, got ${entry.prevHash}`,
          entries_checked: entriesChecked,
          hash_mismatches: hashMismatches,
          signature_failures: signatureFailures,
          timestamp_issues: timestampIssues,
          payload_errors: payloadErrors,
          errors,
        };
      }

      prevHash = entry.hash;
      lastTimestamp = entry.timestamp;
      entriesChecked++;
    }

    const verificationDuration = Date.now() - startTime;

    return {
      valid: true,
      entries_checked: entriesChecked,
      hash_mismatches: hashMismatches,
      signature_failures: signatureFailures,
      timestamp_issues: timestampIssues,
      payload_errors: payloadErrors,
      first_entry_timestamp: rows.length > 0 ? rows[0].timestamp : undefined,
      last_entry_timestamp:
        rows.length > 0 ? rows[rows.length - 1].timestamp : undefined,
      verification_duration_ms: verificationDuration,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Build Merkle tree from entry hashes
   *
   * Creates a binary Merkle tree structure where:
   * - Leaf nodes are entry hashes
   * - Internal nodes are hashes of left + right child hashes
   * - If odd number of nodes, last node is duplicated
   *
   * @param hashes - Array of entry hashes
   * @returns Merkle root hash
   */
  static buildMerkleTree(hashes: string[]): string {
    if (hashes.length === 0) {
      throw new Error("Cannot build Merkle tree from empty array");
    }

    if (hashes.length === 1) {
      return hashes[0]!; // Safe: we checked length === 1
    }

    // Build tree level by level
    let currentLevel = hashes;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]!; // Safe: i < length
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1]! : left; // Duplicate last if odd

        const combined = `${left}:${right}`;
        const hash = bytesToHex(sha256(new TextEncoder().encode(combined)));
        nextLevel.push(hash);
      }

      currentLevel = nextLevel;
    }

    // Safe: while loop ensures length >= 1, and we return early if length === 1
    return currentLevel[0]!;
  }

  /**
   * Create a checkpoint (Merkle root) for a time range
   *
   * Uses Merkle tree structure for better integrity verification.
   * The checkpoint contains a signed Merkle root hash of all entries
   * in the specified time range.
   *
   * @param db - Database instance
   * @param signer - Ledger signer for signing the checkpoint
   * @param startTimestamp - Start timestamp (inclusive)
   * @param endTimestamp - End timestamp (inclusive)
   * @returns Merkle root hash
   */
  static async createCheckpoint(
    db: LedgerDb,
    signer: LedgerSigner,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<string> {
    const rows = await db
      .select({ hash: schema.ledgerEntries.hash })
      .from(schema.ledgerEntries)
      .where(
        and(
          gte(schema.ledgerEntries.timestamp, startTimestamp),
          lte(schema.ledgerEntries.timestamp, endTimestamp)
        )
      )
      .orderBy(asc(schema.ledgerEntries.timestamp));

    if (rows.length === 0) {
      throw new Error("No entries found for checkpoint");
    }

    // Build Merkle tree from entry hashes
    const hashes = rows.map((row: any) => row.hash);
    const rootHash = this.buildMerkleTree(hashes);

    // Sign root hash
    const signature = signer.sign(rootHash);
    const id = crypto.randomUUID();

    await db.insert(schema.ledgerCheckpoints).values({
      id,
      timestamp: Date.now(),
      rootHash,
      signature,
      entriesCount: rows.length,
      startTimestamp,
      endTimestamp,
      createdAt: Date.now(),
    });

    return rootHash;
  }

  /**
   * Get the latest checkpoint
   */
  static async getLatestCheckpoint(db: LedgerDb): Promise<{
    id: string;
    timestamp: number;
    root_hash: string;
    signature: string;
    entries_count: number;
  } | null> {
    const checkpoint = await db.query.ledgerCheckpoints.findFirst({
      columns: {
        id: true,
        timestamp: true,
        rootHash: true,
        signature: true,
        entriesCount: true,
      },
      orderBy: (table, { desc: d }) => d(table.timestamp),
    });

    if (!checkpoint) {
      return null;
    }

    return {
      id: checkpoint.id,
      timestamp: checkpoint.timestamp,
      root_hash: checkpoint.rootHash,
      signature: checkpoint.signature,
      entries_count: checkpoint.entriesCount,
    };
  }

  /**
   * Count total entries in the ledger
   */
  static async countEntries(db: LedgerDb): Promise<number> {
    const [result] = await db
      .select({ count: count(schema.ledgerEntries.id) })
      .from(schema.ledgerEntries);

    return Number(result?.count ?? 0);
  }

  /**
   * Get chain statistics
   */
  static async getChainStats(db: LedgerDb): Promise<{
    total_entries: number;
    oldest_timestamp: number | null;
    newest_timestamp: number | null;
    chain_length: number;
  }> {
    const [result] = await db
      .select({
        total: count(schema.ledgerEntries.id),
        oldest: min(schema.ledgerEntries.timestamp),
        newest: max(schema.ledgerEntries.timestamp),
      })
      .from(schema.ledgerEntries);

    const totalEntries = Number(result?.total ?? 0);

    return {
      total_entries: totalEntries,
      oldest_timestamp: result?.oldest ?? null,
      newest_timestamp: result?.newest ?? null,
      chain_length: totalEntries,
    };
  }
}
