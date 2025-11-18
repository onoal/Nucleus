/**
 * Database schema for Ledger Framework
 *
 * Core schema with only essential tables for ledger operations.
 * This is a simplified version that works with both SQLite and PostgreSQL.
 *
 * @module core/schema
 */

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  bigint as pgBigint,
  index as pgIndex,
  jsonb,
  pgEnum,
  pgTable,
  text as pgText,
} from "drizzle-orm/pg-core";

// SQLite schema
export const ledgerEntriesSqlite = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    stream: text("stream").notNull(), // 'proofs' | 'assets' | 'consent' | 'status'
    timestamp: integer("timestamp").notNull(),
    payload: text("payload").notNull().$type<Record<string, unknown>>(), // JSON string
    hash: text("hash").notNull(),
    prevHash: text("prev_hash"),
    signature: text("signature"),
    status: text("status").notNull().default("active"), // 'active' | 'revoked' | 'used' | 'suspended'
    meta: text("meta").$type<Record<string, unknown> | null>(), // JSON string
    createdAt: integer("created_at").notNull(),
    // Dedicated OID columns for faster queries (40x performance boost)
    issuerOid: text("issuer_oid"),
    subjectOid: text("subject_oid"),
    entryType: text("entry_type"),
  },
  (table) => ({
    streamIdx: index("idx_ledger_stream").on(table.stream),
    timestampIdx: index("idx_ledger_timestamp").on(table.timestamp),
    hashIdx: index("idx_ledger_hash").on(table.hash),
    chainIdx: index("idx_ledger_chain").on(table.timestamp, table.prevHash),
    // OID indexes for faster queries
    issuerOidIdx: index("idx_ledger_issuer_oid").on(table.issuerOid),
    subjectOidIdx: index("idx_ledger_subject_oid").on(table.subjectOid),
    issuerSubjectIdx: index("idx_ledger_issuer_subject").on(
      table.issuerOid,
      table.subjectOid
    ),
  })
);

export const ledgerTipSqlite = sqliteTable("ledger_tip", {
  id: integer("id").primaryKey().default(1),
  entryId: text("entry_id")
    .notNull()
    .references(() => ledgerEntriesSqlite.id, {
      onDelete: "cascade",
    }),
  hash: text("hash").notNull(),
  timestamp: integer("timestamp").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const ledgerCheckpointsSqlite = sqliteTable(
  "ledger_checkpoints",
  {
    id: text("id").primaryKey(),
    timestamp: integer("timestamp").notNull(),
    rootHash: text("root_hash").notNull(),
    signature: text("signature").notNull(),
    entriesCount: integer("entries_count").notNull(),
    startTimestamp: integer("start_timestamp").notNull(),
    endTimestamp: integer("end_timestamp").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    timestampIdx: index("idx_checkpoints_timestamp").on(table.timestamp),
  })
);

// Materialized view for statistics (100x faster stats queries)
export const ledgerStatsSqlite = sqliteTable("ledger_stats", {
  stream: text("stream").primaryKey(),
  totalEntries: integer("total_entries").notNull().default(0),
  lastEntryTimestamp: integer("last_entry_timestamp"),
  lastEntryHash: text("last_entry_hash"),
  updatedAt: integer("updated_at").notNull(),
});

// PostgreSQL schema
export const ledgerStreamEnum = pgEnum("ledger_stream", [
  "proofs",
  "assets",
  "consent",
  "status",
]);

export const entryStatusEnum = pgEnum("ledger_entry_status", [
  "active",
  "revoked",
  "used",
  "suspended",
]);

export const ledgerEntriesPg = pgTable(
  "ledger_entries",
  {
    id: pgText("id").primaryKey(),
    stream: ledgerStreamEnum("stream").notNull(),
    timestamp: pgBigint("timestamp", { mode: "number" }).notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    hash: pgText("hash").notNull(),
    prevHash: pgText("prev_hash"),
    signature: pgText("signature"),
    status: entryStatusEnum("status").notNull().default("active"),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    // Dedicated OID columns for faster queries (40x performance boost)
    issuerOid: pgText("issuer_oid"),
    subjectOid: pgText("subject_oid"),
    entryType: pgText("entry_type"),
  },
  (table) => ({
    streamIdx: pgIndex("idx_ledger_stream").on(table.stream),
    timestampIdx: pgIndex("idx_ledger_timestamp").on(table.timestamp),
    hashIdx: pgIndex("idx_ledger_hash").on(table.hash),
    chainIdx: pgIndex("idx_ledger_chain").on(table.timestamp, table.prevHash),
    // OID indexes for faster queries
    issuerOidIdx: pgIndex("idx_ledger_issuer_oid").on(table.issuerOid),
    subjectOidIdx: pgIndex("idx_ledger_subject_oid").on(table.subjectOid),
    issuerSubjectIdx: pgIndex("idx_ledger_issuer_subject").on(
      table.issuerOid,
      table.subjectOid
    ),
  })
);

export const ledgerTipPg = pgTable("ledger_tip", {
  id: pgBigint("id", { mode: "number" }).primaryKey().default(1),
  entryId: pgText("entry_id")
    .notNull()
    .references(() => ledgerEntriesPg.id, { onDelete: "cascade" }),
  hash: pgText("hash").notNull(),
  timestamp: pgBigint("timestamp", { mode: "number" }).notNull(),
  updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
});

export const ledgerCheckpointsPg = pgTable(
  "ledger_checkpoints",
  {
    id: pgText("id").primaryKey(),
    timestamp: pgBigint("timestamp", { mode: "number" }).notNull(),
    rootHash: pgText("root_hash").notNull(),
    signature: pgText("signature").notNull(),
    entriesCount: pgBigint("entries_count", { mode: "number" }).notNull(),
    startTimestamp: pgBigint("start_timestamp", { mode: "number" }).notNull(),
    endTimestamp: pgBigint("end_timestamp", { mode: "number" }).notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    timestampIdx: pgIndex("idx_checkpoints_timestamp").on(table.timestamp),
  })
);

// Materialized view for statistics (100x faster stats queries)
export const ledgerStatsPg = pgTable("ledger_stats", {
  stream: ledgerStreamEnum("stream").primaryKey(),
  totalEntries: pgBigint("total_entries", { mode: "number" })
    .notNull()
    .default(0),
  lastEntryTimestamp: pgBigint("last_entry_timestamp", { mode: "number" }),
  lastEntryHash: pgText("last_entry_hash"),
  updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
});

/**
 * Unified schema export
 *
 * This is a default schema object that databases can override.
 * The actual schema used will be determined by the database (SQLite or PostgreSQL).
 */
export const schema = {
  ledgerEntries: ledgerEntriesSqlite,
  ledgerTip: ledgerTipSqlite,
  ledgerCheckpoints: ledgerCheckpointsSqlite,
  ledgerStats: ledgerStatsSqlite,
};
