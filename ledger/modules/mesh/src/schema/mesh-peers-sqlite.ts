/**
 * Mesh Peers schema for SQLite (Drizzle ORM)
 *
 * SQLite variant of mesh peers schema.
 *
 * @module schema/mesh-peers-sqlite
 */

import {
  sqliteTable,
  text,
  real,
  integer,
  index,
} from "drizzle-orm/sqlite-core";

/**
 * Mesh Peers table (SQLite)
 * Stores connected peers in the mesh network.
 */
export const meshPeersSqlite = sqliteTable(
  "mesh_peers",
  {
    id: text("id").primaryKey(),
    ledgerId: text("ledger_id").notNull().unique(),
    ledgerOid: text("ledger_oid").notNull(),
    publicKey: text("public_key").notNull(),
    endpoint: text("endpoint").notNull(),
    capabilities: text("capabilities"), // JSON string for SQLite
    trustLevel: real("trust_level").default(0.5).notNull(),
    lastSeen: integer("last_seen", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
    connectedAt: integer("connected_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table: any) => ({
    ledgerIdIdx: index("idx_mesh_peers_ledger_id").on(table.ledgerId),
    ledgerOidIdx: index("idx_mesh_peers_ledger_oid").on(table.ledgerOid),
    lastSeenIdx: index("idx_mesh_peers_last_seen").on(table.lastSeen),
  })
);
