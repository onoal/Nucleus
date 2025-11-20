/**
 * SQLite storage adapter for Nucleus
 */

import Database from "better-sqlite3";
import type { RecordStore, NucleusRecord, GetChainOpts } from "../types/index.js";
import { StorageConstraintError } from "../types/index.js";

/**
 * SQLite-based storage adapter
 * 
 * Features:
 * - Atomic writes with transactions
 * - Unique constraints on hash and (chainId, index)
 * - Indexed queries for performance
 */
export class SQLiteRecordStore implements RecordStore {
  private db: Database.Database;

  /**
   * Create a new SQLite storage adapter
   * 
   * @param dbPath Path to SQLite database file (use ':memory:' for in-memory)
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Write-Ahead Logging for better concurrency
    this.initSchema();
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        hash TEXT PRIMARY KEY NOT NULL,
        chain_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        module TEXT NOT NULL,
        json TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS records_chain_idx 
        ON records(chain_id, idx);

      CREATE INDEX IF NOT EXISTS records_chain_id 
        ON records(chain_id);

      CREATE INDEX IF NOT EXISTS records_module 
        ON records(module);
    `);
  }

  /**
   * Store a new record
   */
  async put(record: NucleusRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO records (hash, chain_id, idx, created_at, module, json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        record.hash,
        record.chainId,
        record.index,
        record.createdAt,
        record.module,
        JSON.stringify(record)
      );
    } catch (error) {
      // SQLite constraint violation
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        if (error.message.includes("hash")) {
          throw new StorageConstraintError(
            `Record with hash ${record.hash} already exists`,
            "hash"
          );
        } else if (error.message.includes("chain_id")) {
          throw new StorageConstraintError(
            `Record with chainId ${record.chainId} and index ${record.index} already exists`,
            "chain_index"
          );
        }
      }
      // Re-throw unknown errors
      throw error;
    }
  }

  /**
   * Retrieve record by hash
   */
  async getByHash(hash: string): Promise<NucleusRecord | null> {
    const stmt = this.db.prepare(`
      SELECT json FROM records WHERE hash = ?
    `);

    const row = stmt.get(hash) as { json: string } | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.json) as NucleusRecord;
  }

  /**
   * Get all records in a chain
   */
  async getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]> {
    const limit = opts?.limit ?? Number.MAX_SAFE_INTEGER;
    const offset = opts?.offset ?? 0;
    const order = opts?.reverse ? "DESC" : "ASC";

    const stmt = this.db.prepare(`
      SELECT json FROM records
      WHERE chain_id = ?
      ORDER BY idx ${order}
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(chainId, limit, offset) as Array<{ json: string }>;

    return rows.map((row) => JSON.parse(row.json) as NucleusRecord);
  }

  /**
   * Get the head (latest) record in a chain
   */
  async getHead(chainId: string): Promise<NucleusRecord | null> {
    const stmt = this.db.prepare(`
      SELECT json FROM records
      WHERE chain_id = ?
      ORDER BY idx DESC
      LIMIT 1
    `);

    const row = stmt.get(chainId) as { json: string } | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.json) as NucleusRecord;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

