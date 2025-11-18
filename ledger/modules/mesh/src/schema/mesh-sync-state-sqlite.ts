/**
 * Mesh Sync State schema for SQLite (Drizzle ORM)
 *
 * SQLite variant of mesh sync state schema.
 *
 * @module schema/mesh-sync-state-sqlite
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Mesh Sync State table (SQLite)
 * Stores synchronization state for each ledger connection.
 */
export const meshSyncStateSqlite = sqliteTable(
  "mesh_sync_state",
  {
    id: text("id").primaryKey(),
    ledgerId: text("ledger_id").notNull(),
    stream: text("stream"), // Optional stream filter
    lastSyncedTimestamp: integer("last_synced_timestamp", { mode: "number" }),
    syncStatus: text("sync_status")
      .notNull()
      .$type<"synced" | "syncing" | "error">()
      .default("synced"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
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
