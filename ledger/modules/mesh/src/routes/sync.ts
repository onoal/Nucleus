/**
 * Mesh Sync Routes
 *
 * Handles entry synchronization endpoints.
 *
 * @module routes/sync
 */

import type { OnoalLedger, LedgerEntry } from "@onoal/ledger-core";
import type { EntrySync, EntrySyncResponse, MeshPeer } from "../types.js";
import { validateSync } from "../utils/validation.js";
import { MeshNetworkService } from "../services/mesh-network-service.js";

/**
 * POST /mesh/sync - Entry synchronization
 *
 * Handles incoming entry synchronization requests.
 */
export async function syncHandler(
  req: Request,
  ledger: OnoalLedger
): Promise<Response> {
  try {
    const body = await req.json();
    const sync = body as EntrySync;

    // Validate sync
    const validation = validateSync(sync);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Get peer
    const meshNetwork =
      ledger.getService<MeshNetworkService>("meshNetworkService");
    const peers = await meshNetwork.getPeers();
    const peer = peers.find((p: MeshPeer) => p.ledgerId === sync.fromLedgerId);

    if (!peer) {
      return Response.json({ error: "Unknown peer" }, { status: 403 });
    }

    // Get entries since timestamp
    const filters: any = {
      status: "active",
      limit: 1000, // Max sync batch size
    };

    if (sync.filters.stream) {
      filters.stream = sync.filters.stream;
    }

    // Query entries (for now, get all and filter by timestamp)
    // TODO: Implement timestamp-based query in ledger-core
    const result = await ledger.query(filters);

    // Filter entries by timestamp if since is provided
    let entries = result.entries;
    if (sync.filters.since) {
      entries = entries.filter(
        (e: LedgerEntry) => e.timestamp >= sync.filters.since!
      );
    }

    const response: EntrySyncResponse = {
      syncId: sync.syncId,
      entries: entries.map((e: LedgerEntry) => ({
        id: e.id,
        hash: e.hash,
        timestamp: e.timestamp,
        payload: e.payload,
        prevHash: e.prev_hash ?? undefined,
        signature: e.signature ?? undefined,
        status: e.status,
      })),
      hasMore: result.hasMore && entries.length >= 1000,
      lastSyncedTimestamp: Date.now(),
    };

    // Record success
    await meshNetwork.recordSuccess(sync.fromLedgerId);

    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
