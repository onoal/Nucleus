/**
 * Core Ledger Schema Exports
 *
 * Standardized schema exports for db:generate discovery.
 * This file exports all core ledger schemas in a consistent format.
 *
 * @module schema
 */

// Import schemas
import {
  ledgerEntriesPg,
  ledgerTipPg,
  ledgerCheckpointsPg,
  ledgerEntriesSqlite,
  ledgerTipSqlite,
  ledgerCheckpointsSqlite,
  ledgerStreamEnum,
  entryStatusEnum,
} from "../core/schema.js";

// Re-export individual schemas
export {
  ledgerEntriesPg,
  ledgerTipPg,
  ledgerCheckpointsPg,
  ledgerStreamEnum,
  entryStatusEnum,
  ledgerEntriesSqlite,
  ledgerTipSqlite,
  ledgerCheckpointsSqlite,
};

/**
 * Core ledger schema for PostgreSQL
 * Used by db:generate to discover and merge schemas
 */
export const ledgerCoreSchema = {
  ledgerEntries: ledgerEntriesPg,
  ledgerTip: ledgerTipPg,
  ledgerCheckpoints: ledgerCheckpointsPg,
};

/**
 * Core ledger schema for SQLite
 * Used by db:generate to discover and merge schemas
 */
export const ledgerCoreSchemaSqlite = {
  ledgerEntries: ledgerEntriesSqlite,
  ledgerTip: ledgerTipSqlite,
  ledgerCheckpoints: ledgerCheckpointsSqlite,
};
