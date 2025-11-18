/**
 * Mesh Query Service
 *
 * Handles cross-ledger queries.
 * Allows querying entries from remote ledgers in the mesh network.
 *
 * @module services/mesh-query-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { LedgerSigner } from "@onoal/ledger-core/internal";
import type { CrossLedgerQuery, CrossLedgerQueryResponse } from "../types.js";
import { MeshNetworkService } from "./mesh-network-service.js";
import { signMessage } from "../utils/signature.js";
import { validateQuery } from "../utils/validation.js";
import { PeerNotFoundError, SignatureVerificationError } from "../errors.js";
import { verifyMessage } from "../utils/signature.js";

/**
 * Mesh Query Service
 *
 * Handles cross-ledger queries.
 *
 * @example
 * ```typescript
 * const meshQuery = ledger.getService<MeshQueryService>("meshQueryService");
 * const entries = await meshQuery.queryRemote(
 *   "ledger-b-id",
 *   { subjectOid: "oid:..." },
 *   "oid:requester"
 * );
 * ```
 */
export class MeshQueryService {
  private ledger: OnoalLedger;
  private meshNetwork: MeshNetworkService;

  constructor(ledger: OnoalLedger) {
    this.ledger = ledger;
    this.meshNetwork =
      ledger.getService<MeshNetworkService>("meshNetworkService");
  }

  /**
   * Query remote ledger
   *
   * Sends a query request to a remote ledger and returns matching entries.
   *
   * @param toLedgerId - Target ledger ID
   * @param filters - Query filters
   * @param requesterOid - OID of the requester
   * @returns Query response with entries
   */
  async queryRemote(
    toLedgerId: string,
    filters: CrossLedgerQuery["filters"],
    requesterOid: string
  ): Promise<CrossLedgerQueryResponse> {
    // Get peer
    const peers = await this.meshNetwork.getPeers();
    const peer = peers.find((p) => p.ledgerId === toLedgerId);
    if (!peer) {
      throw new PeerNotFoundError(toLedgerId);
    }

    // Get ledger config for fromLedgerId
    // TODO: Get ledgerOid from options (need to pass options to service)
    const fromLedgerId = this.ledger.config.name;
    const fromLedgerOid = ""; // Will be available via options in future

    // Create query (without signature, will be added after signing)
    const queryWithoutSignature = {
      queryId: globalThis.crypto.randomUUID(),
      fromLedgerId,
      toLedgerId,
      filters: {
        ...filters,
        limit: filters.limit || 100,
      },
      requesterOid,
    };

    // Sign query
    const signer = this.ledger.getService<LedgerSigner>("signer");
    const signedQuery: CrossLedgerQuery = {
      ...queryWithoutSignature,
      signature: signMessage(
        {
          id: queryWithoutSignature.queryId,
          type: "query_request",
          timestamp: Date.now(),
          from: {
            ledgerId: fromLedgerId,
            ledgerOid: fromLedgerOid,
          },
          to: {
            ledgerId: toLedgerId,
          },
          payload: queryWithoutSignature,
        },
        signer
      ),
    };

    // Validate query
    const validation = validateQuery(signedQuery);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid query");
    }

    // Send query
    let response: globalThis.Response;
    try {
      response = await globalThis.fetch(`${peer.endpoint}/mesh/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signedQuery),
      });
    } catch (error) {
      await this.meshNetwork.recordFailure(toLedgerId);
      throw new Error(
        `Failed to send query: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    if (!response.ok) {
      await this.meshNetwork.recordFailure(toLedgerId);
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const result: CrossLedgerQueryResponse = await response.json();

    // Verify response signature
    const isValid = verifyMessage(
      {
        id: result.queryId,
        type: "query_response",
        timestamp: result.proof.timestamp,
        from: {
          ledgerId: toLedgerId,
          ledgerOid: peer.ledgerOid,
        },
        to: {
          ledgerId: fromLedgerId,
        },
        payload: result,
        signature: result.proof.signature,
      },
      peer.publicKey
    );

    if (!isValid) {
      await this.meshNetwork.recordFailure(toLedgerId);
      throw new SignatureVerificationError();
    }

    // Record success
    await this.meshNetwork.recordSuccess(toLedgerId);

    return result;
  }
}
