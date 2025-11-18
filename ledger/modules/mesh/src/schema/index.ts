/**
 * Mesh schema exports
 *
 * Standardized schema exports for db:generate discovery.
 *
 * @module schema
 */

// PostgreSQL schema (production)
export { meshPeersPg } from "./mesh-peers.js";
export { meshConnectionsPg } from "./mesh-connections.js";
export { meshSyncStatePg } from "./mesh-sync-state.js";

// SQLite schema (development/testing)
export { meshPeersSqlite } from "./mesh-peers-sqlite.js";
export { meshConnectionsSqlite } from "./mesh-connections-sqlite.js";
export { meshSyncStateSqlite } from "./mesh-sync-state-sqlite.js";

// Import for schema objects
import { meshPeersPg } from "./mesh-peers.js";
import { meshConnectionsPg } from "./mesh-connections.js";
import { meshSyncStatePg } from "./mesh-sync-state.js";

/**
 * Mesh schema for PostgreSQL
 * Used by db:generate to discover and merge schemas
 */
export const meshSchema = {
  meshPeers: meshPeersPg,
  meshConnections: meshConnectionsPg,
  meshSyncState: meshSyncStatePg,
};

/**
 * Mesh schema for SQLite
 * Used by db:generate to discover and merge schemas
 */
import { meshPeersSqlite } from "./mesh-peers-sqlite.js";
import { meshConnectionsSqlite } from "./mesh-connections-sqlite.js";
import { meshSyncStateSqlite } from "./mesh-sync-state-sqlite.js";

export const meshSchemaSqlite = {
  meshPeers: meshPeersSqlite,
  meshConnections: meshConnectionsSqlite,
  meshSyncState: meshSyncStateSqlite,
};

/**
 * Drizzle schema for module registration
 * This is what gets passed to the module's drizzleSchema property
 */
export const meshDrizzleSchema = {
  meshPeers: meshPeersPg, // Will be adapted by database adapter
  meshConnections: meshConnectionsPg,
  meshSyncState: meshSyncStatePg,
};
