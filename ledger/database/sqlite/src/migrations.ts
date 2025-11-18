/**
 * Migration Tracking System for SQLite
 *
 * Tracks applied migrations and supports rollback.
 *
 * @module database/sqlite/migrations
 */

import type { Database } from "better-sqlite3";

/**
 * Migration definition
 */
export interface Migration {
  /** Migration version (e.g., "001", "002", or timestamp-based) */
  version: string;
  /** Migration name (descriptive) */
  name: string;
  /** Up migration function */
  up: (db: Database) => Promise<void>;
  /** Down migration function (rollback) */
  down: (db: Database) => Promise<void>;
  /** When migration was applied (set by tracking system) */
  appliedAt?: Date;
}

/**
 * Migration record in database
 */
interface MigrationRecord {
  version: string;
  name: string;
  applied_at: number; // Unix timestamp
}

/**
 * Initialize migration tracking table
 */
export function initMigrationTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
}

/**
 * Track an applied migration
 */
export function trackMigration(db: Database, migration: Migration): void {
  initMigrationTable(db);

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO _migrations (version, name, applied_at)
    VALUES (?, ?, ?);
  `);

  stmt.run(migration.version, migration.name, Date.now());
}

/**
 * Get all applied migrations
 */
export function getAppliedMigrations(db: Database): MigrationRecord[] {
  initMigrationTable(db);

  const stmt = db.prepare(`
    SELECT version, name, applied_at
    FROM _migrations
    ORDER BY applied_at ASC;
  `);

  return stmt.all() as MigrationRecord[];
}

/**
 * Check if a migration has been applied
 */
export function isMigrationApplied(db: Database, version: string): boolean {
  initMigrationTable(db);

  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM _migrations
    WHERE version = ?;
  `);

  const result = stmt.get() as { count: number };
  return result.count > 0;
}

/**
 * Get the latest migration version
 */
export function getLatestMigrationVersion(db: Database): string | null {
  initMigrationTable(db);

  const stmt = db.prepare(`
    SELECT version
    FROM _migrations
    ORDER BY applied_at DESC
    LIMIT 1;
  `);

  const result = stmt.get() as { version: string } | undefined;
  return result?.version || null;
}

/**
 * Rollback a specific migration
 */
export async function rollbackMigration(
  db: Database,
  migration: Migration
): Promise<void> {
  initMigrationTable(db);

  // Check if migration is applied
  const isApplied = isMigrationApplied(db, migration.version);
  if (!isApplied) {
    throw new Error(
      `Migration ${migration.version} (${migration.name}) is not applied`
    );
  }

  // Run down migration
  const result = migration.down(db);
  if (result instanceof Promise) {
    await result;
  }

  // Remove from tracking
  const stmt = db.prepare(`
    DELETE FROM _migrations
    WHERE version = ?;
  `);

  stmt.run(migration.version);
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(
  db: Database,
  migrations: Migration[],
  targetVersion: string
): Promise<void> {
  initMigrationTable(db);

  // Get applied migrations in reverse order
  const applied = getAppliedMigrations(db);
  const appliedVersions = applied.map((m) => m.version);

  // Find migrations to rollback (those applied after target version)
  const migrationsToRollback = migrations
    .filter((m) => {
      const appliedIndex = appliedVersions.indexOf(m.version);
      const targetIndex = appliedVersions.indexOf(targetVersion);
      return appliedIndex > targetIndex;
    })
    .reverse(); // Rollback in reverse order

  for (const migration of migrationsToRollback) {
    await rollbackMigration(db, migration);
  }
}

/**
 * Apply a migration
 */
export async function applyMigration(
  db: Database,
  migration: Migration
): Promise<void> {
  initMigrationTable(db);

  // Check if already applied
  const isApplied = isMigrationApplied(db, migration.version);
  if (isApplied) {
    return; // Already applied, skip
  }

  // Run up migration
  const result = migration.up(db);
  if (result instanceof Promise) {
    await result;
  }

  // Track migration
  trackMigration(db, migration);
}

/**
 * Apply all pending migrations
 */
export async function applyPendingMigrations(
  db: Database,
  migrations: Migration[]
): Promise<{ applied: string[]; skipped: string[] }> {
  initMigrationTable(db);

  const applied: string[] = [];
  const skipped: string[] = [];

  // Sort migrations by version
  const sortedMigrations = [...migrations].sort((a, b) =>
    a.version.localeCompare(b.version)
  );

  for (const migration of sortedMigrations) {
    const isApplied = isMigrationApplied(db, migration.version);
    if (isApplied) {
      skipped.push(migration.version);
      continue;
    }

    try {
      await applyMigration(db, migration);
      applied.push(migration.version);
    } catch (error) {
      throw new Error(
        `Failed to apply migration ${migration.version} (${migration.name}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return { applied, skipped };
}
