/**
 * SQLite adapter for Ledger Framework
 *
 * Uses Drizzle ORM with better-sqlite3 for Node.js deployments.
 * Perfect for development, testing, and small-scale production deployments.
 *
 * @module adapter-node/sqlite
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { LedgerDatabase } from "@onoal/ledger-core";
import {
  ledgerEntriesSqlite,
  ledgerTipSqlite,
  ledgerCheckpointsSqlite,
} from "@onoal/ledger-core/internal";
import { applyPendingMigrations, initMigrationTable } from "./migrations.js";
import { getAllMigrations } from "./migrations/index.js";

export interface SqliteAdapterOptions {
  /** Path to SQLite database file (use ":memory:" for in-memory database) */
  path: string;
  /** Optional: enable WAL mode for better concurrency (default: true) */
  enableWAL?: boolean;
}

/**
 * Create SQLite adapter
 *
 * @param options - SQLite adapter options
 * @returns Ledger adapter instance
 *
 * @example
 * ```typescript
 * const adapter = sqliteAdapter({
 *   path: "./ledger.db",
 *   enableWAL: true,
 * });
 *
 * const ledger = await createLedger({
 *   name: "my-ledger",
 *   signingKey: privateKey,
 *   adapter,
 * });
 * ```
 */
export function sqliteAdapter(options: SqliteAdapterOptions): LedgerDatabase {
  const sqliteDb = new Database(options.path);

  // Enable WAL mode for better concurrency
  if (options.enableWAL !== false) {
    sqliteDb.pragma("journal_mode = WAL");
  }

  // Create Drizzle instance with SQLite ledger schema
  const db = drizzle(sqliteDb, {
    schema: {
      ledgerEntries: ledgerEntriesSqlite,
      ledgerTip: ledgerTipSqlite,
      ledgerCheckpoints: ledgerCheckpointsSqlite,
    },
  });

  /**
   * Run migrations programmatically
   * Creates tables if they don't exist and applies core migrations
   */
  async function migrate(): Promise<void> {
    // Initialize migration tracking table
    initMigrationTable(sqliteDb);

    // Apply core migrations first (e.g., OID columns, stats table)
    const coreMigrations = getAllMigrations();
    try {
      const result = await applyPendingMigrations(sqliteDb, coreMigrations);
      if (result.applied.length > 0) {
        console.log(
          `[MIGRATE] Applied ${result.applied.length} core migration(s): ${result.applied.join(", ")}`
        );
      }
      if (result.skipped.length > 0) {
        console.log(
          `[MIGRATE] Skipped ${result.skipped.length} already applied migration(s): ${result.skipped.join(", ")}`
        );
      }
    } catch (error) {
      console.error("[MIGRATE] Failed to apply core migrations:", error);
      throw error;
    }

    // Create ledger_entries table
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        stream TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload TEXT NOT NULL,
        hash TEXT NOT NULL,
        prev_hash TEXT,
        signature TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        meta TEXT,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_ledger_stream ON ledger_entries(stream);
      CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_ledger_hash ON ledger_entries(hash);
      CREATE INDEX IF NOT EXISTS idx_ledger_chain ON ledger_entries(timestamp, prev_hash);
    `);

    // Create ledger_tip table
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS ledger_tip (
        id INTEGER PRIMARY KEY DEFAULT 1,
        entry_id TEXT NOT NULL,
        hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES ledger_entries(id) ON DELETE CASCADE
      );
    `);

    // Create ledger_checkpoints table
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS ledger_checkpoints (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        root_hash TEXT NOT NULL,
        signature TEXT NOT NULL,
        entries_count INTEGER NOT NULL,
        start_timestamp INTEGER NOT NULL,
        end_timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON ledger_checkpoints(timestamp);
    `);
  }

  const adapter: LedgerDatabase = {
    id: "sqlite",
    db,
    provider: "sqlite",
    migrate,
  };

  // Expose underlying database for module migrations (internal use only)
  (adapter as any)._sqliteDb = sqliteDb;

  return adapter;
}

// Export migration utilities
export * from "./migrations.js";
