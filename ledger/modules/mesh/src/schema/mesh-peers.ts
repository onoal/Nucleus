/**
 * Mesh Peers schema for PostgreSQL (Drizzle ORM)
 *
 * Stores information about connected peers in the mesh network.
 *
 * @module schema/mesh-peers
 */

import { pgTable, text, real, bigint, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Mesh Peers table (PostgreSQL)
 * Stores connected peers in the mesh network.
 */
export const meshPeersPg = pgTable(
  "mesh_peers",
  {
    id: text("id").primaryKey(),
    ledgerId: text("ledger_id").notNull().unique(),
    ledgerOid: text("ledger_oid").notNull(),
    publicKey: text("public_key").notNull(),
    endpoint: text("endpoint").notNull(),
    capabilities: text("capabilities").array(), // PostgreSQL array
    trustLevel: real("trust_level").default(0.5).notNull(),
    lastSeen: bigint("last_seen", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    connectedAt: bigint("connected_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table: any) => ({
    ledgerIdIdx: index("idx_mesh_peers_ledger_id").on(table.ledgerId),
    ledgerOidIdx: index("idx_mesh_peers_ledger_oid").on(table.ledgerOid),
    lastSeenIdx: index("idx_mesh_peers_last_seen").on(table.lastSeen),
  })
);
