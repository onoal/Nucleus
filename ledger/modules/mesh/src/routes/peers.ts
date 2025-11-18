/**
 * Mesh Peers Routes
 *
 * Handles peer management endpoints.
 *
 * @module routes/peers
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type { MeshPeer } from "../types.js";
import { MeshNetworkService } from "../services/mesh-network-service.js";

/**
 * GET /mesh/peers - List connected peers
 *
 * Returns a list of all known peers in the mesh network.
 */
export async function getPeersHandler(
  req: Request,
  ledger: OnoalLedger
): Promise<Response> {
  try {
    const meshNetwork =
      ledger.getService<MeshNetworkService>("meshNetworkService");
    const peers = await meshNetwork.getPeers();

    return Response.json({
      peers: peers.map((p: MeshPeer) => ({
        ledgerId: p.ledgerId,
        ledgerOid: p.ledgerOid,
        endpoint: p.endpoint,
        capabilities: p.capabilities,
        trustLevel: p.trustLevel,
        lastSeen: p.lastSeen,
        connectedAt: p.connectedAt,
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to get peers",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /mesh/connect - Connect to peer or announce presence
 *
 * Connects to a peer or handles peer announcement.
 */
export async function connectPeerHandler(
  req: Request,
  ledger: OnoalLedger
): Promise<Response> {
  try {
    const body = await req.json();
    const meshNetwork =
      ledger.getService<MeshNetworkService>("meshNetworkService");

    // Validate body
    if (!body.ledgerId || !body.endpoint) {
      return Response.json(
        { error: "Missing required fields: ledgerId, endpoint" },
        { status: 400 }
      );
    }

    // Connect to peer
    await meshNetwork.connectPeer({
      id: body.ledgerId,
      ledgerId: body.ledgerId,
      ledgerOid: body.ledgerOid || "",
      publicKey: body.publicKey || "",
      endpoint: body.endpoint,
      capabilities: body.capabilities || [],
      trustLevel: body.trustLevel || 0.5,
      lastSeen: Date.now(),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to connect peer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
