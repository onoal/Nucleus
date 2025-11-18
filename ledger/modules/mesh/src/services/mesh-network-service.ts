/**
 * Mesh Network Service
 *
 * Manages peer connectivity and mesh network operations.
 * Handles peer discovery, connection management, and presence announcement.
 *
 * @module services/mesh-network-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type { LedgerDatabase } from "@onoal/ledger-core";
import type {
  MeshPeer,
  MeshConnection,
  MeshProtocolModuleOptions,
} from "../types.js";
import { meshSchema } from "../schema/index.js";
import { meshSchemaSqlite } from "../schema/index.js";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { PeerNotFoundError, ConnectionFailedError } from "../errors.js";

/**
 * Mesh Network Service
 *
 * Manages peer connectivity and mesh network operations.
 *
 * @example
 * ```typescript
 * const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
 * await meshNetwork.join(bootstrapNodes);
 * const peers = await meshNetwork.getPeers();
 * ```
 */
export class MeshNetworkService {
  private ledger: OnoalLedger;
  private options: MeshProtocolModuleOptions;
  private isJoined: boolean = false;

  constructor(ledger: OnoalLedger, options: MeshProtocolModuleOptions) {
    this.ledger = ledger;
    this.options = options;
  }

  /**
   * Get database adapter
   */
  private getAdapter(): LedgerDatabase {
    const database = this.ledger.getService<LedgerDatabase>("database");
    if (!database) {
      throw new Error("Database not available");
    }
    return database;
  }

  /**
   * Get database instance
   */
  private getDb() {
    return this.getAdapter().db;
  }

  /**
   * Get mesh schema based on provider
   */
  private getMeshSchema() {
    const adapter = this.getAdapter();

    if (adapter.provider === "postgres") {
      return meshSchema;
    } else if (adapter.provider === "sqlite" || adapter.provider === "d1") {
      return meshSchemaSqlite;
    } else {
      throw new Error(`Unsupported database provider: ${adapter.provider}`);
    }
  }

  /**
   * Get schema tables
   */
  private getTables() {
    const schema = this.getMeshSchema();
    return {
      meshPeers: schema.meshPeers,
      meshConnections: schema.meshConnections,
      meshSyncState: schema.meshSyncState,
    };
  }

  /**
   * Join mesh network
   *
   * Discovers peers from bootstrap nodes and announces presence.
   *
   * @param bootstrapNodes - Optional bootstrap nodes (uses options if not provided)
   */
  async join(
    bootstrapNodes?: Array<{ ledgerId: string; endpoint: string }>
  ): Promise<void> {
    if (this.isJoined) {
      throw new Error("Already joined mesh network");
    }

    const nodes = bootstrapNodes || this.options.bootstrapNodes;

    // Discover peers from bootstrap nodes
    for (const node of nodes) {
      try {
        const peers = await this.discoverPeers(node.endpoint);
        for (const peer of peers) {
          await this.addPeer(peer);
        }
      } catch (error) {
        // Log but continue with other bootstrap nodes
        console.warn(`Failed to discover peers from ${node.endpoint}:`, error);
      }
    }

    // Announce presence to discovered peers
    await this.announcePresence();

    this.isJoined = true;
  }

  /**
   * Leave mesh network
   *
   * Disconnects from all peers and cleans up.
   */
  async leave(): Promise<void> {
    if (!this.isJoined) {
      return;
    }

    // Disconnect from all peers
    const peers = await this.getPeers();
    for (const peer of peers) {
      if (peer.connectedAt) {
        await this.disconnectPeer(peer.ledgerId);
      }
    }

    this.isJoined = false;
  }

  /**
   * Get connected peers
   *
   * @returns List of known peers
   */
  async getPeers(): Promise<MeshPeer[]> {
    const db = this.getDb();
    const tables = this.getTables();

    const peers = await db
      .select()
      .from(tables.meshPeers)
      .orderBy(tables.meshPeers.lastSeen);

    // Type for database row (can be PostgreSQL or SQLite)
    type PeerRow =
      | InferSelectModel<typeof meshSchema.meshPeers>
      | InferSelectModel<typeof meshSchemaSqlite.meshPeers>;

    return peers.map((p: PeerRow) => ({
      id: p.id,
      ledgerId: p.ledgerId,
      ledgerOid: p.ledgerOid,
      publicKey: p.publicKey,
      endpoint: p.endpoint,
      capabilities:
        typeof p.capabilities === "string"
          ? JSON.parse(p.capabilities)
          : p.capabilities || [],
      trustLevel: p.trustLevel,
      lastSeen: p.lastSeen,
      connectedAt: p.connectedAt || undefined,
    }));
  }

  /**
   * Connect to peer
   *
   * Adds a peer to the network and creates a connection.
   *
   * @param peer - Peer to connect to
   */
  async connectPeer(peer: MeshPeer): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();
    const now = Date.now();

    // Upsert peer
    await db
      .insert(tables.meshPeers)
      .values({
        id: peer.id || peer.ledgerId,
        ledgerId: peer.ledgerId,
        ledgerOid: peer.ledgerOid,
        publicKey: peer.publicKey,
        endpoint: peer.endpoint,
        capabilities:
          typeof peer.capabilities === "string"
            ? peer.capabilities
            : JSON.stringify(peer.capabilities),
        trustLevel: peer.trustLevel || 0.5,
        lastSeen: now,
        connectedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tables.meshPeers.ledgerId,
        set: {
          ledgerOid: peer.ledgerOid,
          publicKey: peer.publicKey,
          endpoint: peer.endpoint,
          capabilities:
            typeof peer.capabilities === "string"
              ? peer.capabilities
              : JSON.stringify(peer.capabilities),
          lastSeen: now,
          connectedAt: now,
          updatedAt: now,
        },
      });

    // Create or update connection
    const connectionId = `${this.options.ledgerId}-${peer.ledgerId}`;
    await db
      .insert(tables.meshConnections)
      .values({
        id: connectionId,
        fromLedgerId: this.options.ledgerId,
        toLedgerId: peer.ledgerId,
        trustLevel: peer.trustLevel || 0.5,
        successfulInteractions: 0,
        failedInteractions: 0,
        status: "connected",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          tables.meshConnections.fromLedgerId,
          tables.meshConnections.toLedgerId,
        ],
        set: {
          status: "connected",
          lastInteraction: now,
          updatedAt: now,
        },
      });
  }

  /**
   * Disconnect from peer
   *
   * Updates peer and connection status to disconnected.
   *
   * @param peerId - Peer ledger ID to disconnect from
   */
  async disconnectPeer(peerId: string): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();
    const now = Date.now();

    // Update peer (remove connectedAt)
    await db
      .update(tables.meshPeers)
      .set({
        connectedAt: null,
        updatedAt: now,
      })
      .where(eq(tables.meshPeers.ledgerId, peerId));

    // Update connection status
    const connectionId = `${this.options.ledgerId}-${peerId}`;
    await db
      .update(tables.meshConnections)
      .set({
        status: "disconnected",
        updatedAt: now,
      })
      .where(eq(tables.meshConnections.id, connectionId));
  }

  /**
   * Get connections
   *
   * @returns List of connections
   */
  async getConnections(): Promise<MeshConnection[]> {
    const db = this.getDb();
    const tables = this.getTables();

    const connections = await db
      .select()
      .from(tables.meshConnections)
      .where(eq(tables.meshConnections.fromLedgerId, this.options.ledgerId));

    // Type for database row (can be PostgreSQL or SQLite)
    type ConnectionRow =
      | InferSelectModel<typeof meshSchema.meshConnections>
      | InferSelectModel<typeof meshSchemaSqlite.meshConnections>;

    return connections.map((c: ConnectionRow) => ({
      id: c.id,
      fromLedgerId: c.fromLedgerId,
      toLedgerId: c.toLedgerId,
      trustLevel: c.trustLevel,
      successfulInteractions: c.successfulInteractions,
      failedInteractions: c.failedInteractions,
      lastInteraction: c.lastInteraction || undefined,
      status: c.status as "connected" | "disconnected",
    }));
  }

  /**
   * Update connection trust level
   *
   * @param peerId - Peer ledger ID
   * @param trustLevel - New trust level (0.0 - 1.0)
   */
  async updateTrust(peerId: string, trustLevel: number): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();
    const now = Date.now();

    // Update peer trust level
    await db
      .update(tables.meshPeers)
      .set({
        trustLevel,
        updatedAt: now,
      })
      .where(eq(tables.meshPeers.ledgerId, peerId));

    // Update connection trust level
    const connectionId = `${this.options.ledgerId}-${peerId}`;
    await db
      .update(tables.meshConnections)
      .set({
        trustLevel,
        updatedAt: now,
      })
      .where(eq(tables.meshConnections.id, connectionId));
  }

  /**
   * Record successful interaction
   *
   * @param peerId - Peer ledger ID
   */
  async recordSuccess(peerId: string): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();
    const now = Date.now();

    const connectionId = `${this.options.ledgerId}-${peerId}`;
    const connection = await db
      .select()
      .from(tables.meshConnections)
      .where(eq(tables.meshConnections.id, connectionId))
      .limit(1);

    if (connection.length > 0) {
      const current = connection[0];
      await db
        .update(tables.meshConnections)
        .set({
          successfulInteractions: current.successfulInteractions + 1,
          lastInteraction: now,
          updatedAt: now,
        })
        .where(eq(tables.meshConnections.id, connectionId));

      // Update trust level based on success rate
      const total =
        current.successfulInteractions + current.failedInteractions + 1;
      const newTrustLevel = (current.successfulInteractions + 1) / total;
      await this.updateTrust(peerId, newTrustLevel);
    }
  }

  /**
   * Record failed interaction
   *
   * @param peerId - Peer ledger ID
   */
  async recordFailure(peerId: string): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();
    const now = Date.now();

    const connectionId = `${this.options.ledgerId}-${peerId}`;
    const connection = await db
      .select()
      .from(tables.meshConnections)
      .where(eq(tables.meshConnections.id, connectionId))
      .limit(1);

    if (connection.length > 0) {
      const current = connection[0];
      await db
        .update(tables.meshConnections)
        .set({
          failedInteractions: current.failedInteractions + 1,
          lastInteraction: now,
          updatedAt: now,
        })
        .where(eq(tables.meshConnections.id, connectionId));

      // Update trust level based on success rate
      const total =
        current.successfulInteractions + current.failedInteractions + 1;
      const newTrustLevel = current.successfulInteractions / total;
      await this.updateTrust(peerId, newTrustLevel);
    }
  }

  /**
   * Discover peers from bootstrap node
   *
   * @param endpoint - Bootstrap node endpoint
   * @returns List of discovered peers
   */
  private async discoverPeers(endpoint: string): Promise<MeshPeer[]> {
    try {
      const response = await globalThis.fetch(`${endpoint}/mesh/peers`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new ConnectionFailedError(
          endpoint,
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const peers = data.peers || [];

      return peers.map((p: any) => ({
        id: p.ledgerId || p.id,
        ledgerId: p.ledgerId,
        ledgerOid: p.ledgerOid || "",
        publicKey: p.publicKey || "",
        endpoint: p.endpoint,
        capabilities: p.capabilities || [],
        trustLevel: p.trustLevel || 0.5,
        lastSeen: p.lastSeen || Date.now(),
      }));
    } catch (error) {
      if (error instanceof ConnectionFailedError) {
        throw error;
      }
      throw new ConnectionFailedError(
        endpoint,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Announce presence to peers
   *
   * Sends presence announcement to all known peers.
   */
  private async announcePresence(): Promise<void> {
    const announcement = {
      ledgerId: this.options.ledgerId,
      ledgerOid: this.options.ledgerOid,
      publicKey: this.options.publicKey,
      endpoint: this.options.endpoint,
      capabilities: ["query", "sync"],
    };

    // Send to all known peers
    const peers = await this.getPeers();
    for (const peer of peers) {
      try {
        await globalThis.fetch(`${peer.endpoint}/mesh/peers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(announcement),
        });
      } catch (error) {
        // Log but continue
        console.warn(`Failed to announce to ${peer.endpoint}:`, error);
      }
    }
  }

  /**
   * Add peer (internal)
   *
   * @param peer - Peer to add
   */
  private async addPeer(peer: MeshPeer): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();
    const now = Date.now();

    // Check if already exists
    const existing = await db
      .select()
      .from(tables.meshPeers)
      .where(eq(tables.meshPeers.ledgerId, peer.ledgerId))
      .limit(1);

    if (existing.length > 0) {
      // Update last seen
      await db
        .update(tables.meshPeers)
        .set({
          lastSeen: now,
          updatedAt: now,
        })
        .where(eq(tables.meshPeers.ledgerId, peer.ledgerId));
      return;
    }

    // Add new peer
    await db.insert(tables.meshPeers).values({
      id: peer.id || peer.ledgerId,
      ledgerId: peer.ledgerId,
      ledgerOid: peer.ledgerOid,
      publicKey: peer.publicKey,
      endpoint: peer.endpoint,
      capabilities:
        typeof peer.capabilities === "string"
          ? peer.capabilities
          : JSON.stringify(peer.capabilities),
      trustLevel: peer.trustLevel || 0.5,
      lastSeen: now,
      connectedAt: null, // Not connected yet
      createdAt: now,
      updatedAt: now,
    });
  }
}
