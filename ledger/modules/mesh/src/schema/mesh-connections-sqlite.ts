/**
 * Mesh Connections schema for SQLite (Drizzle ORM)
 *
 * SQLite variant of mesh connections schema.
 *
 * @module schema/mesh-connections-sqlite
 */

import {
  sqliteTable,
  text,
  real,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Mesh Connections table (SQLite)
 * Stores connections between ledgers.
 */
export const meshConnectionsSqlite = sqliteTable(
  "mesh_connections",
  {
    id: text("id").primaryKey(),
    fromLedgerId: text("from_ledger_id").notNull(),
    toLedgerId: text("to_ledger_id").notNull(),
    trustLevel: real("trust_level").default(0.5).notNull(),
    successfulInteractions: integer("successful_interactions", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    failedInteractions: integer("failed_interactions", { mode: "number" })
      .default(0)
      .notNull(),
    lastInteraction: integer("last_interaction", { mode: "number" }),
    status: text("status")
      .notNull()
      .$type<"connected" | "disconnected">()
      .default("disconnected"),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table: any) => ({
    fromIdx: index("idx_mesh_connections_from").on(table.fromLedgerId),
    toIdx: index("idx_mesh_connections_to").on(table.toLedgerId),
    statusIdx: index("idx_mesh_connections_status").on(table.status),
    uniqueConnection: unique("unique_mesh_connection").on(
      table.fromLedgerId,
      table.toLedgerId
    ),
  })
);
