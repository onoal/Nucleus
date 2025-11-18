/**
 * Mesh Sync Service
 *
 * Handles entry synchronization between ledgers.
 * Allows syncing entries from remote ledgers in the mesh network.
 *
 * @module services/mesh-sync-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type { LedgerDatabase } from "@onoal/ledger-core";
import type { EntrySync, EntrySyncResponse } from "../types.js";
import { MeshNetworkService } from "./mesh-network-service.js";
import { validateSync } from "../utils/validation.js";
import { PeerNotFoundError } from "../errors.js";
import { meshSchema } from "../schema/index.js";
import { meshSchemaSqlite } from "../schema/index.js";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Mesh Sync Service
 *
 * Handles entry synchronization between ledgers.
 *
 * @example
 * ```typescript
 * const meshSync = ledger.getService<MeshSyncService>("meshSyncService");
 * const result = await meshSync.syncWith("ledger-b-id", {
 *   stream: "main",
 *   since: Date.now() - 86400000, // Last 24 hours
 * });
 * ```
 */
export class MeshSyncService {
  private ledger: OnoalLedger;
  private meshNetwork: MeshNetworkService;

  constructor(ledger: OnoalLedger) {
    this.ledger = ledger;
    this.meshNetwork =
      ledger.getService<MeshNetworkService>("meshNetworkService");
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
      meshSyncState: schema.meshSyncState,
    };
  }

  /**
   * Sync with remote ledger
   *
   * Synchronizes entries from a remote ledger since the last sync timestamp.
   *
   * @param toLedgerId - Target ledger ID
   * @param filters - Sync filters
   * @returns Sync response with entries
   */
  async syncWith(
    toLedgerId: string,
    filters: EntrySync["filters"]
  ): Promise<EntrySyncResponse> {
    // Get peer
    const peers = await this.meshNetwork.getPeers();
    const peer = peers.find((p) => p.ledgerId === toLedgerId);
    if (!peer) {
      throw new PeerNotFoundError(toLedgerId);
    }

    // Get last sync timestamp
    const lastSync = await this.getLastSyncTimestamp(
      toLedgerId,
      filters.stream
    );
    const since = filters.since || lastSync || 0;

    // Get ledger config for fromLedgerId
    // TODO: Get ledgerOid from options (need to pass options to service)
    const fromLedgerId = this.ledger.config.name;

    // Create sync request
    const sync: EntrySync = {
      syncId: globalThis.crypto.randomUUID(),
      fromLedgerId,
      toLedgerId,
      filters: {
        ...filters,
        since,
      },
    };

    // Validate sync
    const validation = validateSync(sync);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Update sync state to "syncing"
    await this.updateSyncState(toLedgerId, filters.stream, "syncing", null);

    // Send sync request
    let response: globalThis.Response;
    try {
      response = await globalThis.fetch(`${peer.endpoint}/mesh/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sync),
      });
    } catch (error) {
      await this.updateSyncState(
        toLedgerId,
        filters.stream,
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
      await this.meshNetwork.recordFailure(toLedgerId);
      throw new Error(
        `Failed to send sync request: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    if (!response.ok) {
      await this.updateSyncState(
        toLedgerId,
        filters.stream,
        "error",
        `HTTP ${response.status}: ${response.statusText}`
      );
      await this.meshNetwork.recordFailure(toLedgerId);
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    const result: EntrySyncResponse = await response.json();

    // Update sync state
    await this.updateSyncState(
      toLedgerId,
      filters.stream,
      "synced",
      null,
      result.lastSyncedTimestamp
    );

    // Record success
    await this.meshNetwork.recordSuccess(toLedgerId);

    return result;
  }

  /**
   * Get last sync timestamp
   *
   * @param ledgerId - Remote ledger ID
   * @param stream - Optional stream filter
   * @returns Last sync timestamp or null
   */
  private async getLastSyncTimestamp(
    ledgerId: string,
    stream?: string
  ): Promise<number | null> {
    const db = this.getDb();
    const tables = this.getTables();

    const state = await db
      .select()
      .from(tables.meshSyncState)
      .where(
        and(
          eq(tables.meshSyncState.ledgerId, ledgerId),
          stream
            ? eq(tables.meshSyncState.stream, stream)
            : isNull(tables.meshSyncState.stream)
        )
      )
      .limit(1);

    if (state.length === 0) {
      return null;
    }

    return state[0].lastSyncedTimestamp || null;
  }

  /**
   * Update sync state
   *
   * @param ledgerId - Remote ledger ID
   * @param stream - Optional stream filter
   * @param status - Sync status
   * @param errorMessage - Error message (if status is "error")
   * @param lastSyncedTimestamp - Last synced timestamp
   */
  private async updateSyncState(
    ledgerId: string,
    stream: string | undefined,
    status: "synced" | "syncing" | "error",
    errorMessage: string | null,
    lastSyncedTimestamp?: number
  ): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();
    const now = Date.now();

    const stateId = `${ledgerId}-${stream || "default"}`;

    await db
      .insert(tables.meshSyncState)
      .values({
        id: stateId,
        ledgerId,
        stream: stream || null,
        syncStatus: status,
        errorMessage: errorMessage || null,
        lastSyncedTimestamp: lastSyncedTimestamp || null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [tables.meshSyncState.ledgerId, tables.meshSyncState.stream],
        set: {
          syncStatus: status,
          errorMessage: errorMessage || null,
          lastSyncedTimestamp: lastSyncedTimestamp || undefined,
          updatedAt: now,
        },
      });
  }
}
