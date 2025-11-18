/**
 * Payment schema for SQLite
 *
 * Database schema for payment accounts and payments (SQLite version).
 *
 * @module schema/payments-sqlite
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Payment accounts table (SQLite)
 */
export const paymentAccountsSqlite = sqliteTable(
  "payment_accounts",
  {
    id: text("id").primaryKey(), // pay_acc_<uuidv7>
    accountOid: text("account_oid").notNull(),
    provider: text("provider").notNull(), // "stripe" | "mollie" | "ledger_token"
    providerAccountId: text("provider_account_id").notNull(),
    status: text("status").notNull().default("active"), // "active" | "inactive" | "suspended"
    metadata: text("metadata").$type<Record<string, unknown> | null>(), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    accountProviderUnique: unique("uq_payment_accounts_account_provider").on(
      table.accountOid,
      table.provider
    ),
    accountOidIdx: index("idx_payment_accounts_account_oid").on(
      table.accountOid
    ),
    providerIdx: index("idx_payment_accounts_provider").on(table.provider),
    statusIdx: index("idx_payment_accounts_status").on(table.status),
  })
);

/**
 * Payments table (SQLite)
 */
export const paymentsSqlite = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(), // pay_<uuidv7>
    accountOid: text("account_oid").notNull(),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    amount: text("amount").notNull(), // BigInt as string
    currency: text("currency").notNull(),
    status: text("status").notNull().default("pending"),
    ledgerEntryId: text("ledger_entry_id"),
    tokenId: text("token_id"),
    metadata: text("metadata").$type<Record<string, unknown> | null>(), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    providerPaymentUnique: unique("uq_payments_provider_payment").on(
      table.provider,
      table.providerPaymentId
    ),
    accountOidIdx: index("idx_payments_account_oid").on(table.accountOid),
    providerIdx: index("idx_payments_provider").on(table.provider),
    statusIdx: index("idx_payments_status").on(table.status),
    ledgerEntryIdx: index("idx_payments_ledger_entry").on(table.ledgerEntryId),
    tokenIdIdx: index("idx_payments_token_id").on(table.tokenId),
  })
);

/**
 * Refunds table (SQLite)
 */
export const refundsSqlite = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(), // ref_<uuidv7>
    paymentId: text("payment_id")
      .notNull()
      .references(() => paymentsSqlite.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id").notNull(),
    amount: text("amount").notNull(), // BigInt as string
    status: text("status").notNull().default("pending"),
    reason: text("reason"),
    metadata: text("metadata").$type<Record<string, unknown> | null>(), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    paymentIdIdx: index("idx_refunds_payment_id").on(table.paymentId),
    statusIdx: index("idx_refunds_status").on(table.status),
  })
);

/**
 * Export schema
 */
export const paymentSchemaSqlite = {
  paymentAccounts: paymentAccountsSqlite,
  payments: paymentsSqlite,
  refunds: refundsSqlite,
};
