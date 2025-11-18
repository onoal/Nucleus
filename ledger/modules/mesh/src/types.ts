/**
 * Onoal Mesh Network V1 - Type Definitions
 *
 * Type definitions for the Onoal Network Mesh Protocol module.
 * These types define the interfaces for mesh network operations,
 * cross-ledger queries, and synchronization.
 */

/**
 * Ledger Identity
 * Represents a ledger's identity in the mesh network.
 */
export interface LedgerIdentity {
  /** Unique ledger identifier (UUID) */
  ledgerId: string;
  /** Hierarchical OID for this ledger */
  ledgerOid: string;
  /** Ed25519 public key (hex-encoded) */
  publicKey: string;
  /** HTTP endpoint for this ledger */
  endpoint: string;
  /** Capabilities this ledger supports */
  capabilities: string[];
}

/**
 * Mesh Peer
 * Represents a connected peer in the mesh network.
 */
export interface MeshPeer {
  /** Unique peer identifier */
  id: string;
  /** Ledger ID of this peer */
  ledgerId: string;
  /** OID of this peer */
  ledgerOid: string;
  /** Public key of this peer */
  publicKey: string;
  /** HTTP endpoint of this peer */
  endpoint: string;
  /** Capabilities this peer supports */
  capabilities: string[];
  /** Trust level (0.0 - 1.0) */
  trustLevel: number;
  /** Last seen timestamp (Unix timestamp in milliseconds) */
  lastSeen: number;
  /** Connection timestamp (Unix timestamp in milliseconds) */
  connectedAt?: number;
}

/**
 * Mesh Connection
 * Represents a connection between two ledgers.
 */
export interface MeshConnection {
  /** Unique connection identifier */
  id: string;
  /** Source ledger ID */
  fromLedgerId: string;
  /** Target ledger ID */
  toLedgerId: string;
  /** Trust level (0.0 - 1.0) */
  trustLevel: number;
  /** Number of successful interactions */
  successfulInteractions: number;
  /** Number of failed interactions */
  failedInteractions: number;
  /** Last interaction timestamp (Unix timestamp in milliseconds) */
  lastInteraction?: number;
  /** Connection status */
  status: "connected" | "disconnected";
}

/**
 * Cross-Ledger Query
 * Request to query entries from a remote ledger.
 */
export interface CrossLedgerQuery {
  /** Unique query identifier (UUID) */
  queryId: string;
  /** Source ledger ID */
  fromLedgerId: string;
  /** Target ledger ID */
  toLedgerId: string;
  /** Query filters */
  filters: {
    /** Filter by subject OID */
    subjectOid?: string;
    /** Filter by issuer OID */
    issuerOid?: string;
    /** Filter by entry type */
    entryType?: string;
    /** Maximum number of entries to return (max 100) */
    limit?: number;
  };
  /** OID of the requester */
  requesterOid: string;
  /** Ed25519 signature of the query */
  signature: string;
}

/**
 * Cross-Ledger Query Response
 * Response from a cross-ledger query.
 */
export interface CrossLedgerQueryResponse {
  /** Query identifier */
  queryId: string;
  /** Matching entries */
  entries: Array<{
    /** Entry ID */
    id: string;
    /** Entry hash */
    hash: string;
    /** Entry timestamp */
    timestamp: number;
    /** Entry payload */
    payload: unknown;
    /** Previous entry hash */
    prevHash?: string;
    /** Entry signature */
    signature?: string;
    /** Entry status */
    status?: string;
  }>;
  /** Whether there are more entries */
  hasMore: boolean;
  /** Proof of response authenticity */
  proof: {
    /** Ed25519 signature */
    signature: string;
    /** Timestamp of response */
    timestamp: number;
  };
}

/**
 * Entry Sync Request
 * Request to synchronize entries from a remote ledger.
 */
export interface EntrySync {
  /** Unique sync identifier (UUID) */
  syncId: string;
  /** Source ledger ID */
  fromLedgerId: string;
  /** Target ledger ID */
  toLedgerId: string;
  /** Sync filters */
  filters: {
    /** Optional stream filter */
    stream?: string;
    /** Sync entries since this timestamp (Unix timestamp in milliseconds) */
    since?: number;
  };
}

/**
 * Entry Sync Response
 * Response from an entry synchronization request.
 */
export interface EntrySyncResponse {
  /** Sync identifier */
  syncId: string;
  /** Synchronized entries */
  entries: Array<{
    /** Entry ID */
    id: string;
    /** Entry hash */
    hash: string;
    /** Entry timestamp */
    timestamp: number;
    /** Entry payload */
    payload: unknown;
    /** Previous entry hash */
    prevHash?: string;
    /** Entry signature */
    signature?: string;
    /** Entry status */
    status?: string;
  }>;
  /** Whether there are more entries */
  hasMore: boolean;
  /** Last synced timestamp (Unix timestamp in milliseconds) */
  lastSyncedTimestamp: number;
}

/**
 * Mesh Message Type
 * Types of messages in the mesh network.
 */
export type MeshMessageType =
  | "peer_announce" // Announce presence
  | "peer_discover" // Discover peers (via bootstrap)
  | "query_request" // Cross-ledger query
  | "query_response" // Query response
  | "sync_request" // Request sync
  | "sync_response" // Sync response
  | "heartbeat"; // Keep-alive

/**
 * Mesh Message
 * Base structure for all mesh network messages.
 */
export interface MeshMessage {
  /** Unique message identifier (UUID) */
  id: string;
  /** Message type */
  type: MeshMessageType;
  /** Message timestamp (Unix timestamp in milliseconds) */
  timestamp: number;
  /** Source ledger information */
  from: {
    /** Source ledger ID */
    ledgerId: string;
    /** Source ledger OID */
    ledgerOid: string;
  };
  /** Target ledger information */
  to: {
    /** Target ledger ID */
    ledgerId: string;
  };
  /** Message payload (type-specific) */
  payload: unknown;
  /** Ed25519 signature of the message */
  signature: string;
}

/**
 * Mesh Protocol Module Options
 * Configuration options for the mesh protocol module.
 */
export interface MeshProtocolModuleOptions {
  /** This ledger's unique identifier */
  ledgerId: string;
  /** This ledger's OID */
  ledgerOid: string;
  /** This ledger's Ed25519 public key (hex-encoded) */
  publicKey: string;
  /** This ledger's HTTP endpoint */
  endpoint: string;

  /** Bootstrap nodes for peer discovery (required) */
  bootstrapNodes: Array<{
    /** Bootstrap node ledger ID */
    ledgerId: string;
    /** Bootstrap node HTTP endpoint */
    endpoint: string;
  }>;

  /** Optional: Auto-sync configuration */
  autoSync?: {
    /** Enable automatic synchronization */
    enabled: boolean;
    /** Sync interval in milliseconds (default: 60000 = 1 minute) */
    interval?: number;
  };
}

