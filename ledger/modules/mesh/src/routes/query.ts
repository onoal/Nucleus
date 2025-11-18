/**
 * Mesh Query Routes
 *
 * Handles cross-ledger query endpoints.
 *
 * @module routes/query
 */

import type { OnoalLedger, LedgerEntry } from "@onoal/ledger-core";
import { LedgerSigner } from "@onoal/ledger-core/internal";
import type {
  CrossLedgerQuery,
  CrossLedgerQueryResponse,
  MeshPeer,
} from "../types.js";
import { verifyMessage } from "../utils/signature.js";
import { validateQuery } from "../utils/validation.js";
import { MeshNetworkService } from "../services/mesh-network-service.js";
import { InvalidMessageError, SignatureVerificationError } from "../errors.js";

/**
 * POST /mesh/query - Cross-ledger query
 *
 * Handles incoming cross-ledger query requests.
 */
export async function queryHandler(
  req: Request,
  ledger: OnoalLedger
): Promise<Response> {
  try {
    const body = await req.json();
    const query = body as CrossLedgerQuery;

    // Validate query
    const validation = validateQuery(query);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Get peer to verify signature
    const meshNetwork =
      ledger.getService<MeshNetworkService>("meshNetworkService");
    const peers = await meshNetwork.getPeers();
    const peer = peers.find((p: MeshPeer) => p.ledgerId === query.fromLedgerId);

    if (!peer) {
      return Response.json({ error: "Unknown peer" }, { status: 403 });
    }

    // Verify signature
    const isValid = verifyMessage(
      {
        id: query.queryId,
        type: "query_request",
        timestamp: Date.now(), // TODO: Get from query if available
        from: {
          ledgerId: query.fromLedgerId,
          ledgerOid: peer.ledgerOid,
        },
        to: {
          ledgerId: query.toLedgerId,
        },
        payload: query,
        signature: query.signature,
      },
      peer.publicKey
    );

    if (!isValid) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Execute query using ledger's query method
    const result = await ledger.query({
      subject_oid: query.filters.subjectOid,
      issuer_oid: query.filters.issuerOid,
      status: "active",
      limit: query.filters.limit || 100,
    });

    // Sign response
    const signer = ledger.getService<LedgerSigner>("signer");
    const response: CrossLedgerQueryResponse = {
      queryId: query.queryId,
      entries: result.entries.map((e: LedgerEntry) => ({
        id: e.id,
        hash: e.hash,
        timestamp: e.timestamp,
        payload: e.payload,
        prevHash: e.prev_hash ?? undefined,
        signature: e.signature ?? undefined,
        status: e.status,
      })),
      hasMore: result.hasMore,
      proof: {
        signature: signer.sign(
          JSON.stringify({
            queryId: query.queryId,
            entries: result.entries,
            hasMore: result.hasMore,
            timestamp: Date.now(),
          })
        ),
        timestamp: Date.now(),
      },
    };

    // Record success
    await meshNetwork.recordSuccess(query.fromLedgerId);

    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        error: "Query failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
