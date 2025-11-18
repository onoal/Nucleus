/**
 * Token schema exports
 *
 * Standardized schema exports for db:generate discovery.
 *
 * @module schema
 */

// PostgreSQL schema (production)
export {
  tokens,
  tokenAccounts,
  tokenLedger,
  tokenStatusEnum,
  tokenLedgerKindEnum,
} from "./tokens.js";

// SQLite schema (development/testing)
export {
  tokensSqlite,
  tokenAccountsSqlite,
  tokenLedgerSqlite,
} from "./tokens-sqlite.js";

// Import for schema object
import { tokens, tokenAccounts, tokenLedger } from "./tokens.js";
import {
  tokensSqlite,
  tokenAccountsSqlite,
  tokenLedgerSqlite,
} from "./tokens-sqlite.js";

/**
 * Token schema for PostgreSQL
 * Used by db:generate to discover and merge schemas
 */
export const tokenSchema = {
  tokens,
  tokenAccounts,
  tokenLedger,
};

/**
 * Token schema for SQLite
 * Used by db:generate to discover and merge schemas
 */
export const tokenSchemaSqlite = {
  tokens: tokensSqlite,
  tokenAccounts: tokenAccountsSqlite,
  tokenLedger: tokenLedgerSqlite,
};
