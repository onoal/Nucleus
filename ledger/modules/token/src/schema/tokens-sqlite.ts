/**
 * Token schema for SQLite (Drizzle ORM)
 *
 * SQLite variant of token schema (no enums, different types)
 * BigInt values are stored as TEXT in SQLite.
 *
 * @module schema/tokens-sqlite
 */

import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Tokens table (SQLite)
 */
export const tokensSqlite = sqliteTable(
  "tokens",
  {
    id: text("id").primaryKey(), // tok_<uuidv7>
    issuerOid: text("issuer_oid").notNull(),
    symbol: text("symbol"),
    name: text("name"),
    decimals: integer("decimals").notNull(), // 0-18
    supplyCap: text("supply_cap"), // Store as text (BigInt serialized)
    supply: text("supply").notNull().default("0"), // Store as text (BigInt serialized)
    status: text("status").notNull().default("active"), // 'active' | 'paused'
    metadata: text("metadata"), // JSON string
    adminPolicy: text("admin_policy"), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    issuerIdx: index("idx_tokens_issuer").on(table.issuerOid),
    statusIdx: index("idx_tokens_status").on(table.status),
    decimalsCheck: check(
      "tokens_decimals_check",
      sql`${table.decimals} >= 0 AND ${table.decimals} <= 18`
    ),
    statusCheck: check(
      "tokens_status_check",
      sql`${table.status} IN ('active', 'paused')`
    ),
  })
);

/**
 * Token accounts table (SQLite)
 */
export const tokenAccountsSqlite = sqliteTable(
  "token_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenId: text("token_id")
      .notNull()
      .references(() => tokensSqlite.id, { onDelete: "cascade" }),
    subjectOid: text("subject_oid").notNull(),
    balance: text("balance").notNull().default("0"), // Store as text (BigInt serialized)
    nonce: text("nonce").notNull().default("0"), // Store as text (BigInt serialized)
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    tokenSubjectUnique: unique("uq_token_accounts_token_subject").on(
      table.tokenId,
      table.subjectOid
    ),
    tokenIdx: index("idx_token_accounts_token").on(table.tokenId),
    subjectIdx: index("idx_token_accounts_subject").on(table.subjectOid),
  })
);

/**
 * Token ledger table (SQLite)
 */
export const tokenLedgerSqlite = sqliteTable(
  "token_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts: integer("ts", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    tokenId: text("token_id")
      .notNull()
      .references(() => tokensSqlite.id, { onDelete: "cascade" }),
    txId: text("tx_id").notNull(), // UUID as text
    kind: text("kind").notNull(), // 'mint' | 'burn' | 'transfer' | 'adjust'
    fromSubjectOid: text("from_subject_oid"),
    toSubjectOid: text("to_subject_oid"),
    amount: text("amount").notNull(), // Store as text (BigInt serialized)
    actorOid: text("actor_oid").notNull(),
    ctx: text("ctx"), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    tokenTxUnique: unique("uq_token_ledger_tx").on(table.tokenId, table.txId),
    tokenIdx: index("idx_token_ledger_token").on(table.tokenId),
    timestampIdx: index("idx_token_ledger_ts").on(table.ts),
    kindCheck: check(
      "token_ledger_kind_check",
      sql`${table.kind} IN ('mint', 'burn', 'transfer', 'adjust')`
    ),
    amountCheck: check(
      "token_ledger_amount_check",
      sql`CAST(${table.amount} AS INTEGER) > 0`
    ),
  })
);

/**
 * Export all schemas
 */
export const tokenSchemaSqlite = {
  tokens: tokensSqlite,
  tokenAccounts: tokenAccountsSqlite,
  tokenLedger: tokenLedgerSqlite,
};
