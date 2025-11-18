/**
 * Payment schema for PostgreSQL
 *
 * Database schema for payment accounts and payments.
 *
 * @module schema/payments
 */

import {
  pgTable,
  text,
  bigint,
  pgEnum,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Payment provider enum
 */
export const paymentProviderEnum = pgEnum("payment_provider", [
  "stripe",
  "mollie",
  "ledger_token",
]);

/**
 * Payment status enum
 */
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);

/**
 * Payment account status enum
 */
export const paymentAccountStatusEnum = pgEnum("payment_account_status", [
  "active",
  "inactive",
  "suspended",
]);

/**
 * Payment accounts table
 */
export const paymentAccountsPg = pgTable(
  "payment_accounts",
  {
    id: text("id").primaryKey(), // pay_acc_<uuidv7>
    accountOid: text("account_oid").notNull(), // oid:onoal:org:... | oid:onoal:user:...
    provider: paymentProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    status: paymentAccountStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Unique: one account per provider per OID
    accountProviderUnique: unique("uq_payment_accounts_account_provider").on(
      table.accountOid,
      table.provider
    ),
    // Indexes
    accountOidIdx: index("idx_payment_accounts_account_oid").on(
      table.accountOid
    ),
    providerIdx: index("idx_payment_accounts_provider").on(table.provider),
    statusIdx: index("idx_payment_accounts_status").on(table.status),
  })
);

/**
 * Payments table
 */
export const paymentsPg = pgTable(
  "payments",
  {
    id: text("id").primaryKey(), // pay_<uuidv7>
    accountOid: text("account_oid").notNull(),
    provider: paymentProviderEnum("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(), // In smallest unit
    currency: text("currency").notNull(), // "EUR", "USD", etc.
    status: paymentStatusEnum("status").notNull().default("pending"),
    ledgerEntryId: text("ledger_entry_id"), // Reference to ledger entry
    tokenId: text("token_id"), // For ledger token payments
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Unique: prevent duplicate provider payments
    providerPaymentUnique: unique("uq_payments_provider_payment").on(
      table.provider,
      table.providerPaymentId
    ),
    // Indexes
    accountOidIdx: index("idx_payments_account_oid").on(table.accountOid),
    providerIdx: index("idx_payments_provider").on(table.provider),
    statusIdx: index("idx_payments_status").on(table.status),
    ledgerEntryIdx: index("idx_payments_ledger_entry").on(table.ledgerEntryId),
    tokenIdIdx: index("idx_payments_token_id").on(table.tokenId),
  })
);

/**
 * Refunds table
 */
export const refundsPg = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(), // ref_<uuidv7>
    paymentId: text("payment_id")
      .notNull()
      .references(() => paymentsPg.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "succeeded" | "failed"
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Indexes
    paymentIdIdx: index("idx_refunds_payment_id").on(table.paymentId),
    statusIdx: index("idx_refunds_status").on(table.status),
  })
);

/**
 * Export schema
 */
export const paymentSchema = {
  paymentAccounts: paymentAccountsPg,
  payments: paymentsPg,
  refunds: refundsPg,
};

