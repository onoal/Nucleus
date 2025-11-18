/**
 * Routing utilities for mesh network
 *
 * Provides simple routing logic for mesh messages (direct + 1-hop).
 *
 * @module utils/routing
 */

import type { MeshPeer, MeshConnection } from "../types.js";

/**
 * Find direct peer connection
 *
 * Checks if a direct connection exists to the target ledger.
 *
 * @param ledgerId - Target ledger ID
 * @param peers - List of known peers
 * @returns Peer if found, null otherwise
 */
export function findDirectPeer(
  ledgerId: string,
  peers: MeshPeer[]
): MeshPeer | null {
  return peers.find((p) => p.ledgerId === ledgerId && p.connectedAt) || null;
}

/**
 * Find peer that might know target (for 1-hop forwarding)
 *
 * Checks if any connected peer has a connection to the target ledger.
 *
 * @param targetLedgerId - Target ledger ID
 * @param connections - List of connections
 * @param peers - List of known peers
 * @returns Peer that might know target, null otherwise
 */
export function findPeerThatKnows(
  targetLedgerId: string,
  connections: MeshConnection[],
  peers: MeshPeer[]
): MeshPeer | null {
  // Check if any connected peer has connection to target
  for (const connection of connections) {
    if (
      connection.toLedgerId === targetLedgerId &&
      connection.status === "connected"
    ) {
      const peer = peers.find((p) => p.ledgerId === connection.fromLedgerId);
      if (peer) return peer;
    }
  }
  return null;
}

/**
 * Routing result
 */
export interface RoutingResult {
  /** Routing type */
  type: "direct" | "via_peer" | "not_found";
  /** Direct peer (if type is "direct") */
  peer?: MeshPeer;
  /** Via peer for forwarding (if type is "via_peer") */
  viaPeer?: MeshPeer;
}

/**
 * Simple routing: Direct or 1-hop
 *
 * Routes a message to a target ledger using direct connection or 1-hop forwarding.
 *
 * @param targetLedgerId - Target ledger ID
 * @param peers - List of known peers
 * @param connections - List of connections
 * @returns Routing result
 *
 * @example
 * ```typescript
 * const result = routeMessage("target-ledger-id", peers, connections);
 * if (result.type === "direct") {
 *   await sendDirect(result.peer, message);
 * } else if (result.type === "via_peer") {
 *   await forwardViaPeer(result.viaPeer, message);
 * }
 * ```
 */
export function routeMessage(
  targetLedgerId: string,
  peers: MeshPeer[],
  connections: MeshConnection[]
): RoutingResult {
  // 1. Try direct connection
  const directPeer = findDirectPeer(targetLedgerId, peers);
  if (directPeer) {
    return { type: "direct", peer: directPeer };
  }

  // 2. Try 1-hop forwarding
  const viaPeer = findPeerThatKnows(targetLedgerId, connections, peers);
  if (viaPeer) {
    return { type: "via_peer", viaPeer };
  }

  // 3. Not found
  return { type: "not_found" };
}
