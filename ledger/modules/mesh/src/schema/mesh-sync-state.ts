/**
 * Mesh Sync State schema for PostgreSQL (Drizzle ORM)
 *
 * Stores synchronization state between ledgers.
 *
 * @module schema/mesh-sync-state
 */

import { pgTable, text, bigint, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Mesh Sync State table (PostgreSQL)
 * Stores synchronization state for each ledger connection.
 */
export const meshSyncStatePg = pgTable(
  "mesh_sync_state",
  {
    id: text("id").primaryKey(),
    ledgerId: text("ledger_id").notNull(),
    stream: text("stream"), // Optional stream filter
    lastSyncedTimestamp: bigint("last_synced_timestamp", { mode: "number" }),
    syncStatus: text("sync_status")
      .notNull()
      .$type<"synced" | "syncing" | "error">()
      .default("synced"),
    errorMessage: text("error_message"),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table: any) => ({
    ledgerIdIdx: index("idx_mesh_sync_state_ledger").on(table.ledgerId),
    statusIdx: index("idx_mesh_sync_state_status").on(table.syncStatus),
    uniqueSyncState: unique("unique_mesh_sync_state").on(
      table.ledgerId,
      table.stream
    ),
  })
);
