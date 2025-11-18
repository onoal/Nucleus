/**
 * Mesh Connections schema for PostgreSQL (Drizzle ORM)
 *
 * Stores connections between ledgers in the mesh network.
 *
 * @module schema/mesh-connections
 */

import {
  pgTable,
  text,
  real,
  bigint,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Mesh Connections table (PostgreSQL)
 * Stores connections between ledgers.
 */
export const meshConnectionsPg = pgTable(
  "mesh_connections",
  {
    id: text("id").primaryKey(),
    fromLedgerId: text("from_ledger_id").notNull(),
    toLedgerId: text("to_ledger_id").notNull(),
    trustLevel: real("trust_level").default(0.5).notNull(),
    successfulInteractions: bigint("successful_interactions", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    failedInteractions: bigint("failed_interactions", { mode: "number" })
      .default(0)
      .notNull(),
    lastInteraction: bigint("last_interaction", { mode: "number" }),
    status: text("status")
      .notNull()
      .$type<"connected" | "disconnected">()
      .default("disconnected"),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
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
