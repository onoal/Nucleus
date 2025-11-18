/**
 * Token schema for PostgreSQL (Drizzle ORM)
 *
 * Extracted from: onoal/ledger/src/db/schema.ts
 * Provides token, token_accounts, and token_ledger tables for double-entry accounting.
 *
 * @module schema/tokens
 */

import {
  bigint,
  bigserial,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Token status enum
 */
export const tokenStatusEnum = pgEnum("token_status", ["active", "paused"]);

/**
 * Token ledger kind enum
 */
export const tokenLedgerKindEnum = pgEnum("token_ledger_kind", [
  "mint",
  "burn",
  "transfer",
  "adjust",
]);

/**
 * Tokens table
 * Token definitions and supply management
 */
export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(), // tok_<uuidv7>
    issuerOid: text("issuer_oid").notNull(), // oid:onoal:org:...
    symbol: text("symbol"), // e.g., "USDC", "POINTS"
    name: text("name"), // e.g., "US Dollar Coin"
    decimals: smallint("decimals").notNull(), // 0-18 (like ERC-20)
    supplyCap: bigint("supply_cap", { mode: "bigint" }), // Max supply (null = unlimited)
    supply: bigint("supply", { mode: "bigint" })
      .notNull()
      .default(sql`0`), // Current total supply
    status: tokenStatusEnum("status").notNull().default("active"), // 'active' | 'paused'
    metadata: jsonb("metadata")
      .$type<Record<string, unknown> | null>()
      .default(null), // Additional metadata
    adminPolicy: jsonb("admin_policy")
      .$type<Record<string, unknown> | null>()
      .default(null), // Governance rules
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Indexes for fast lookups
    issuerIdx: index("idx_tokens_issuer").on(table.issuerOid),
    statusIdx: index("idx_tokens_status").on(table.status),
    // Check constraint: decimals must be 0-18
    decimalsCheck: check(
      "tokens_decimals_check",
      sql`${table.decimals} >= 0 AND ${table.decimals} <= 18`
    ),
  })
);

/**
 * Token accounts table
 * Per-account balances and nonces
 */
export const tokenAccounts = pgTable(
  "token_accounts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: text("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    subjectOid: text("subject_oid").notNull(), // oid:onoal:user:... | oid:onoal:org:...
    balance: bigint("balance", { mode: "bigint" })
      .notNull()
      .default(sql`0`), // Account balance in smallest unit
    nonce: bigint("nonce", { mode: "bigint" })
      .notNull()
      .default(sql`0`), // Anti-replay counter
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Unique: one account per token per subject
    tokenSubjectUnique: unique("uq_token_accounts_token_subject").on(
      table.tokenId,
      table.subjectOid
    ),
    // Indexes
    tokenIdx: index("idx_token_accounts_token").on(table.tokenId),
    subjectIdx: index("idx_token_accounts_subject").on(table.subjectOid),
  })
);

/**
 * Token ledger table
 * Append-only double-entry ledger
 */
export const tokenLedger = pgTable(
  "token_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
    tokenId: text("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    txId: uuid("tx_id").notNull(), // Idempotency key (UUID)
    kind: tokenLedgerKindEnum("kind").notNull(), // 'mint' | 'burn' | 'transfer' | 'adjust'
    fromSubjectOid: text("from_subject_oid"), // Source (null for mint)
    toSubjectOid: text("to_subject_oid"), // Destination (null for burn)
    amount: bigint("amount", { mode: "bigint" }).notNull(), // Amount in smallest unit
    actorOid: text("actor_oid").notNull(), // Who initiated the operation
    ctx: jsonb("ctx").$type<Record<string, unknown> | null>(), // Context (grant_jti, dpop_thumbprint, etc.)
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Unique: prevent duplicate transactions
    tokenTxUnique: unique("uq_token_ledger_tx").on(table.tokenId, table.txId),
    // Indexes
    tokenIdx: index("idx_token_ledger_token").on(table.tokenId),
    // Check constraint: amount must be > 0
    amountCheck: check("token_ledger_amount_check", sql`${table.amount} > 0`),
  })
);

/**
 * Export all schemas
 */
export const tokenSchema = {
  tokens,
  tokenAccounts,
  tokenLedger,
};
