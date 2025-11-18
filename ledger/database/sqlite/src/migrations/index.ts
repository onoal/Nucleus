/**
 * Core migrations for Ledger Framework
 *
 * This file exports all core migrations that should be applied to all ledger databases.
 * Additional migrations can be added by modules or plugins.
 *
 * @module database/sqlite/migrations
 */

import { migration001AddOidColumnsAndStats } from "./001_add_oid_columns_and_stats.js";
import type { Migration } from "../migrations.js";

/**
 * All core migrations in order
 */
export const coreMigrations: Migration[] = [migration001AddOidColumnsAndStats];

/**
 * Get all migrations (can be extended by modules/plugins)
 */
export function getAllMigrations(
  additionalMigrations: Migration[] = []
): Migration[] {
  return [...coreMigrations, ...additionalMigrations].sort((a, b) =>
    a.version.localeCompare(b.version)
  );
}
