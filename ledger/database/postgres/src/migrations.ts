/**
 * Migration Tracking System
 *
 * Tracks applied migrations and supports rollback.
 *
 * @module database/postgres/migrations
 */

import type { Pool } from "@neondatabase/serverless";

/**
 * Migration definition
 */
export interface Migration {
  /** Migration version (e.g., "001", "002", or timestamp-based) */
  version: string;
  /** Migration name (descriptive) */
  name: string;
  /** Up migration function */
  up: (db: Pool) => Promise<void>;
  /** Down migration function (rollback) */
  down: (db: Pool) => Promise<void>;
  /** When migration was applied (set by tracking system) */
  appliedAt?: Date;
}

/**
 * Migration record in database
 */
interface MigrationRecord {
  version: string;
  name: string;
  applied_at: Date;
}

/**
 * Initialize migration tracking table
 */
export async function initMigrationTable(db: Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Create index for faster lookups
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_migrations_applied_at 
    ON _migrations(applied_at);
  `);
}

/**
 * Track an applied migration
 */
export async function trackMigration(
  db: Pool,
  migration: Migration
): Promise<void> {
  await initMigrationTable(db);

  await db.query(
    `
    INSERT INTO _migrations (version, name, applied_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (version) DO NOTHING;
    `,
    [migration.version, migration.name]
  );
}

/**
 * Get all applied migrations
 */
export async function getAppliedMigrations(
  db: Pool
): Promise<MigrationRecord[]> {
  await initMigrationTable(db);

  const result = await db.query<MigrationRecord>(`
    SELECT version, name, applied_at
    FROM _migrations
    ORDER BY applied_at ASC;
  `);

  return result.rows;
}

/**
 * Check if a migration has been applied
 */
export async function isMigrationApplied(
  db: Pool,
  version: string
): Promise<boolean> {
  await initMigrationTable(db);

  const result = await db.query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM _migrations
    WHERE version = $1;
    `,
    [version]
  );

  return parseInt(result.rows[0]?.count || "0", 10) > 0;
}

/**
 * Get the latest migration version
 */
export async function getLatestMigrationVersion(
  db: Pool
): Promise<string | null> {
  await initMigrationTable(db);

  const result = await db.query<{ version: string }>(
    `
    SELECT version
    FROM _migrations
    ORDER BY applied_at DESC
    LIMIT 1;
    `
  );

  return result.rows[0]?.version || null;
}

/**
 * Rollback a specific migration
 */
export async function rollbackMigration(
  db: Pool,
  migration: Migration
): Promise<void> {
  await initMigrationTable(db);

  // Check if migration is applied
  const isApplied = await isMigrationApplied(db, migration.version);
  if (!isApplied) {
    throw new Error(
      `Migration ${migration.version} (${migration.name}) is not applied`
    );
  }

  // Run down migration
  await migration.down(db);

  // Remove from tracking
  await db.query(
    `
    DELETE FROM _migrations
    WHERE version = $1;
    `,
    [migration.version]
  );
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(
  db: Pool,
  migrations: Migration[],
  targetVersion: string
): Promise<void> {
  await initMigrationTable(db);

  // Get applied migrations in reverse order
  const applied = await getAppliedMigrations(db);
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
  db: Pool,
  migration: Migration
): Promise<void> {
  await initMigrationTable(db);

  // Check if already applied
  const isApplied = await isMigrationApplied(db, migration.version);
  if (isApplied) {
    return; // Already applied, skip
  }

  // Run up migration
  await migration.up(db);

  // Track migration
  await trackMigration(db, migration);
}

/**
 * Apply all pending migrations
 */
export async function applyPendingMigrations(
  db: Pool,
  migrations: Migration[]
): Promise<{ applied: string[]; skipped: string[] }> {
  await initMigrationTable(db);

  const applied: string[] = [];
  const skipped: string[] = [];

  // Sort migrations by version
  const sortedMigrations = [...migrations].sort((a, b) =>
    a.version.localeCompare(b.version)
  );

  for (const migration of sortedMigrations) {
    const isApplied = await isMigrationApplied(db, migration.version);
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
