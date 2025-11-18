# Onoal Mesh Network - Implementatie Stappenplan

**Versie**: 1.0.0  
**Laatste update**: 2025-01-27  
**Focus**: Developer Experience (DX) - Eenvoudig, type-safe, goed gedocumenteerd

---

## 📋 Overzicht

Dit stappenplan beschrijft hoe we het **Onoal Mesh Network V1** implementeren in het Ledger Framework, met speciale aandacht voor **Developer Experience**:

- ✅ **Eenvoudige API** - Intuïtieve, consistente interface
- ✅ **Type Safety** - Volledige TypeScript ondersteuning
- ✅ **Goede Documentatie** - Duidelijke voorbeelden en uitleg
- ✅ **Testbaar** - Unit tests en integration tests
- ✅ **Consistent** - Volgt bestaande module patterns

---

## 🎯 Implementatie Fases

### **Phase 1: Foundation** (Week 1-2)

- Project setup & structuur
- Database schema
- Type definitions
- Basis services skeleton

### **Phase 2: Core Connectivity** (Week 3-4)

- Mesh Network Service
- Peer discovery & connection
- Basis routing

### **Phase 3: Cross-Ledger Operations** (Week 5-6)

- Query Service
- Sync Service
- API routes

### **Phase 4: DX & Polish** (Week 7-8)

- Documentatie
- Examples
- Tests
- Error handling

---

## 📁 Project Structuur

```
ledger/modules/mesh/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # Module export
│   ├── types.ts                    # Type definitions
│   ├── services/
│   │   ├── mesh-network-service.ts # Peer connectivity
│   │   ├── mesh-query-service.ts   # Cross-ledger queries
│   │   └── mesh-sync-service.ts    # Entry synchronization
│   ├── schema/
│   │   ├── index.ts                # Schema exports
│   │   ├── mesh-peers.ts           # Peers table
│   │   ├── mesh-connections.ts     # Connections table
│   │   └── mesh-sync-state.ts      # Sync state table
│   ├── routes/
│   │   ├── peers.ts                # GET /mesh/peers
│   │   ├── connect.ts              # POST /mesh/connect
│   │   ├── query.ts                # POST /mesh/query
│   │   └── sync.ts                 # POST /mesh/sync
│   ├── utils/
│   │   ├── signature.ts            # Message signing/verification
│   │   ├── routing.ts              # Simple routing logic
│   │   └── validation.ts           # Input validation
│   └── errors.ts                   # Custom error types
└── tests/
    ├── mesh-network-service.test.ts
    ├── mesh-query-service.test.ts
    ├── mesh-sync-service.test.ts
    └── integration.test.ts
```

---

## 📝 Stap 1: Project Setup (Day 1-2)

### 1.1 Create Module Structure

```bash
cd ledger/modules
mkdir -p mesh/src/{services,schema,routes,utils}
mkdir -p mesh/tests
```

### 1.2 Initialize Package

**`ledger/modules/mesh/package.json`:**

```json
{
  "name": "@onoal/ledger-module-mesh",
  "version": "1.0.0",
  "description": "Onoal Network Mesh Protocol - Cross-ledger connectivity and synchronization",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./schema": {
      "import": "./dist/schema/index.js",
      "types": "./dist/schema/index.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "onoal",
    "ledger",
    "mesh",
    "network",
    "cross-ledger",
    "interoperability"
  ],
  "author": "Onoal",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/onoal/onoal-os.git",
    "directory": "ledger/modules/mesh"
  },
  "dependencies": {
    "@onoal/ledger-core": "workspace:*",
    "drizzle-orm": "^0.29.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.9.2",
    "vitest": "^1.0.0"
  }
}
```

### 1.3 TypeScript Config

**`ledger/modules/mesh/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 1.4 Type Definitions

**`ledger/modules/mesh/src/types.ts`:**

```typescript
/**
 * Onoal Mesh Network V1 - Type Definitions
 */

// Ledger Identity
export interface LedgerIdentity {
  ledgerId: string;
  ledgerOid: string;
  publicKey: string; // Ed25519 hex-encoded
  endpoint: string; // HTTP endpoint
  capabilities: string[];
}

// Mesh Peer
export interface MeshPeer {
  id: string;
  ledgerId: string;
  ledgerOid: string;
  publicKey: string;
  endpoint: string;
  capabilities: string[];
  trustLevel: number; // 0.0 - 1.0
  lastSeen: number; // Unix timestamp
  connectedAt?: number;
}

// Mesh Connection
export interface MeshConnection {
  id: string;
  fromLedgerId: string;
  toLedgerId: string;
  trustLevel: number;
  successfulInteractions: number;
  failedInteractions: number;
  lastInteraction?: number;
  status: "connected" | "disconnected";
}

// Cross-Ledger Query
export interface CrossLedgerQuery {
  queryId: string; // UUID
  fromLedgerId: string;
  toLedgerId: string;
  filters: {
    subjectOid?: string;
    issuerOid?: string;
    entryType?: string;
    limit?: number; // Max 100
  };
  requesterOid: string;
  signature: string; // Ed25519 signature
}

export interface CrossLedgerQueryResponse {
  queryId: string;
  entries: Array<{
    id: string;
    hash: string;
    timestamp: number;
    payload: unknown;
    // ... other LedgerEntry fields
  }>;
  hasMore: boolean;
  proof: {
    signature: string;
    timestamp: number;
  };
}

// Entry Sync
export interface EntrySync {
  syncId: string; // UUID
  fromLedgerId: string;
  toLedgerId: string;
  filters: {
    stream?: string;
    since?: number; // Unix timestamp
  };
}

export interface EntrySyncResponse {
  syncId: string;
  entries: Array<{
    id: string;
    hash: string;
    timestamp: number;
    payload: unknown;
    // ... other LedgerEntry fields
  }>;
  hasMore: boolean;
  lastSyncedTimestamp: number;
}

// Mesh Message
export type MeshMessageType =
  | "peer_announce"
  | "peer_discover"
  | "query_request"
  | "query_response"
  | "sync_request"
  | "sync_response"
  | "heartbeat";

export interface MeshMessage {
  id: string; // UUID
  type: MeshMessageType;
  timestamp: number;
  from: {
    ledgerId: string;
    ledgerOid: string;
  };
  to: {
    ledgerId: string;
  };
  payload: unknown;
  signature: string; // Ed25519 signature
}

// Module Options
export interface MeshProtocolModuleOptions {
  // This ledger's identity
  ledgerId: string;
  ledgerOid: string;
  publicKey: string; // Ed25519 public key (hex)
  endpoint: string; // HTTP endpoint

  // Bootstrap nodes (required)
  bootstrapNodes: Array<{
    ledgerId: string;
    endpoint: string;
  }>;

  // Optional: Auto-sync
  autoSync?: {
    enabled: boolean;
    interval?: number; // milliseconds, default: 60000 (1 minute)
  };
}
```

**Deliverable:**

- ✅ Module structuur aangemaakt
- ✅ Package.json geconfigureerd
- ✅ TypeScript configuratie
- ✅ Type definitions compleet

---

## 📝 Stap 2: Database Schema (Day 3-4)

### 2.1 Schema Tables

**`ledger/modules/mesh/src/schema/mesh-peers.ts`:**

```typescript
import { pgTable, text, real, bigint, index } from "drizzle-orm/pg-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

// PostgreSQL
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
    lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
    connectedAt: bigint("connected_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    ledgerIdIdx: index("idx_mesh_peers_ledger_id").on(table.ledgerId),
    ledgerOidIdx: index("idx_mesh_peers_ledger_oid").on(table.ledgerOid),
  })
);

// SQLite
export const meshPeersSqlite = sqliteTable("mesh_peers", {
  id: text("id").primaryKey(),
  ledgerId: text("ledger_id").notNull().unique(),
  ledgerOid: text("ledger_oid").notNull(),
  publicKey: text("public_key").notNull(),
  endpoint: text("endpoint").notNull(),
  capabilities: text("capabilities"), // JSON string for SQLite
  trustLevel: real("trust_level").default(0.5).notNull(),
  lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
  connectedAt: bigint("connected_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
```

**`ledger/modules/mesh/src/schema/mesh-connections.ts`:**

```typescript
import {
  pgTable,
  text,
  real,
  bigint,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

// PostgreSQL
export const meshConnectionsPg = pgTable(
  "mesh_connections",
  {
    id: text("id").primaryKey(),
    fromLedgerId: text("from_ledger_id").notNull(),
    toLedgerId: text("to_ledger_id").notNull(),
    trustLevel: real("trust_level").default(0.5).notNull(),
    successfulInteractions: bigint("successful_interactions", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    failedInteractions: bigint("failed_interactions", { mode: "number" })
      .default(0)
      .notNull(),
    lastInteraction: bigint("last_interaction", { mode: "number" }),
    status: text("status").notNull().$type<"connected" | "disconnected">(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    fromIdx: index("idx_mesh_connections_from").on(table.fromLedgerId),
    toIdx: index("idx_mesh_connections_to").on(table.toLedgerId),
    uniqueConnection: unique("unique_mesh_connection").on(
      table.fromLedgerId,
      table.toLedgerId
    ),
  })
);

// SQLite (similar structure)
export const meshConnectionsSqlite = sqliteTable("mesh_connections", {
  id: text("id").primaryKey(),
  fromLedgerId: text("from_ledger_id").notNull(),
  toLedgerId: text("to_ledger_id").notNull(),
  trustLevel: real("trust_level").default(0.5).notNull(),
  successfulInteractions: bigint("successful_interactions", { mode: "number" })
    .default(0)
    .notNull(),
  failedInteractions: bigint("failed_interactions", { mode: "number" })
    .default(0)
    .notNull(),
  lastInteraction: bigint("last_interaction", { mode: "number" }),
  status: text("status").notNull().$type<"connected" | "disconnected">(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
```

**`ledger/modules/mesh/src/schema/mesh-sync-state.ts`:**

```typescript
import { pgTable, text, bigint, index, unique } from "drizzle-orm/pg-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

// PostgreSQL
export const meshSyncStatePg = pgTable(
  "mesh_sync_state",
  {
    id: text("id").primaryKey(),
    ledgerId: text("ledger_id").notNull(),
    stream: text("stream"), // Optional stream filter
    lastSyncedTimestamp: bigint("last_synced_timestamp", { mode: "number" }),
    syncStatus: text("sync_status")
      .notNull()
      .$type<"synced" | "syncing" | "error">(),
    errorMessage: text("error_message"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    ledgerIdIdx: index("idx_mesh_sync_state_ledger").on(table.ledgerId),
    uniqueSyncState: unique("unique_mesh_sync_state").on(
      table.ledgerId,
      table.stream
    ),
  })
);

// SQLite (similar structure)
export const meshSyncStateSqlite = sqliteTable("mesh_sync_state", {
  id: text("id").primaryKey(),
  ledgerId: text("ledger_id").notNull(),
  stream: text("stream"),
  lastSyncedTimestamp: bigint("last_synced_timestamp", { mode: "number" }),
  syncStatus: text("sync_status")
    .notNull()
    .$type<"synced" | "syncing" | "error">(),
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
```

**`ledger/modules/mesh/src/schema/index.ts`:**

```typescript
import { meshPeersPg, meshPeersSqlite } from "./mesh-peers.js";
import {
  meshConnectionsPg,
  meshConnectionsSqlite,
} from "./mesh-connections.js";
import { meshSyncStatePg, meshSyncStateSqlite } from "./mesh-sync-state.js";

// Unified schema export (for database adapter)
export const meshSchema = {
  meshPeers: {
    postgres: meshPeersPg,
    sqlite: meshPeersSqlite,
  },
  meshConnections: {
    postgres: meshConnectionsPg,
    sqlite: meshConnectionsSqlite,
  },
  meshSyncState: {
    postgres: meshSyncStatePg,
    sqlite: meshSyncStateSqlite,
  },
};

// Drizzle schema for module registration
export const meshDrizzleSchema = {
  meshPeers: meshPeersPg, // Will be adapted by database adapter
  meshConnections: meshConnectionsPg,
  meshSyncState: meshSyncStatePg,
};
```

**Deliverable:**

- ✅ Database schema voor alle 3 tabellen
- ✅ PostgreSQL en SQLite support
- ✅ Indexes en constraints
- ✅ Schema exports

---

## 📝 Stap 3: Utility Functions (Day 5-6)

### 3.1 Signature Utilities

**`ledger/modules/mesh/src/utils/signature.ts`:**

```typescript
import { LedgerSigner } from "@onoal/ledger-core";

/**
 * Sign a mesh message
 */
export function signMessage(
  message: Omit<MeshMessage, "signature">,
  signer: LedgerSigner
): string {
  // Create message payload for signing
  const payload = JSON.stringify({
    id: message.id,
    type: message.type,
    timestamp: message.timestamp,
    from: message.from,
    to: message.to,
    payload: message.payload,
  });

  // Sign with Ed25519
  return signer.sign(payload);
}

/**
 * Verify a mesh message signature
 */
export function verifyMessage(
  message: MeshMessage,
  publicKey: string // Hex-encoded Ed25519 public key
): boolean {
  // Create message payload for verification
  const payload = JSON.stringify({
    id: message.id,
    type: message.type,
    timestamp: message.timestamp,
    from: message.from,
    to: message.to,
    payload: message.payload,
  });

  // Verify signature (using LedgerSigner or crypto library)
  // Implementation depends on available crypto utilities
  return verifyEd25519Signature(payload, message.signature, publicKey);
}

// Helper: Verify Ed25519 signature
function verifyEd25519Signature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  // Use Web Crypto API or Node.js crypto
  // This is a placeholder - actual implementation needed
  // See: @onoal/ledger-core for existing signature verification
  return true; // TODO: Implement
}
```

### 3.2 Routing Utilities

**`ledger/modules/mesh/src/utils/routing.ts`:**

```typescript
import type { MeshPeer, MeshConnection } from "../types.js";

/**
 * Find direct peer connection
 */
export function findDirectPeer(
  ledgerId: string,
  peers: MeshPeer[]
): MeshPeer | null {
  return peers.find((p) => p.ledgerId === ledgerId && p.connectedAt) || null;
}

/**
 * Find peer that might know target (for 1-hop forwarding)
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
 * Simple routing: Direct or 1-hop
 */
export interface RoutingResult {
  type: "direct" | "via_peer" | "not_found";
  peer?: MeshPeer;
  viaPeer?: MeshPeer;
}

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
```

### 3.3 Validation Utilities

**`ledger/modules/mesh/src/utils/validation.ts`:**

```typescript
import type { CrossLedgerQuery, EntrySync } from "../types.js";

/**
 * Validate cross-ledger query
 */
export function validateQuery(query: CrossLedgerQuery): {
  valid: boolean;
  error?: string;
} {
  // Validate query ID
  if (!query.queryId || !isValidUUID(query.queryId)) {
    return { valid: false, error: "Invalid queryId" };
  }

  // Validate ledger IDs
  if (!query.fromLedgerId || !query.toLedgerId) {
    return { valid: false, error: "Missing ledger IDs" };
  }

  // Validate filters
  if (query.filters.limit && query.filters.limit > 100) {
    return { valid: false, error: "Limit cannot exceed 100" };
  }

  // Validate signature
  if (!query.signature) {
    return { valid: false, error: "Missing signature" };
  }

  return { valid: true };
}

/**
 * Validate entry sync
 */
export function validateSync(sync: EntrySync): {
  valid: boolean;
  error?: string;
} {
  // Validate sync ID
  if (!sync.syncId || !isValidUUID(sync.syncId)) {
    return { valid: false, error: "Invalid syncId" };
  }

  // Validate ledger IDs
  if (!sync.fromLedgerId || !sync.toLedgerId) {
    return { valid: false, error: "Missing ledger IDs" };
  }

  // Validate timestamp
  if (sync.filters.since && sync.filters.since < 0) {
    return { valid: false, error: "Invalid since timestamp" };
  }

  return { valid: true };
}

// Helper: Validate UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

**Deliverable:**

- ✅ Signature signing/verification utilities
- ✅ Simple routing logic
- ✅ Input validation functions

---

## 📝 Stap 4: Mesh Network Service (Day 7-10)

### 4.1 Service Implementation

**`ledger/modules/mesh/src/services/mesh-network-service.ts`:**

````typescript
import type { OnoalLedger } from "@onoal/ledger-core";
import type {
  MeshPeer,
  MeshConnection,
  MeshProtocolModuleOptions,
} from "../types.js";
import { findDirectPeer, routeMessage } from "../utils/routing.js";

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
  private peers: Map<string, MeshPeer> = new Map();
  private connections: Map<string, MeshConnection> = new Map();
  private isJoined: boolean = false;

  constructor(ledger: OnoalLedger, options: MeshProtocolModuleOptions) {
    this.ledger = ledger;
    this.options = options;
  }

  /**
   * Join mesh network
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
   */
  async leave(): Promise<void> {
    if (!this.isJoined) {
      return;
    }

    // Disconnect from all peers
    for (const peer of this.peers.values()) {
      if (peer.connectedAt) {
        await this.disconnectPeer(peer.ledgerId);
      }
    }

    this.peers.clear();
    this.connections.clear();
    this.isJoined = false;
  }

  /**
   * Get connected peers
   */
  async getPeers(): Promise<MeshPeer[]> {
    // Load from database
    const db = this.ledger.getService("database");
    // TODO: Query database for peers
    // For now, return in-memory peers
    return Array.from(this.peers.values());
  }

  /**
   * Connect to peer
   */
  async connectPeer(peer: MeshPeer): Promise<void> {
    // Verify peer identity
    // TODO: Implement peer verification

    // Add to peers map
    this.peers.set(peer.ledgerId, {
      ...peer,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
    });

    // Create connection
    const connection: MeshConnection = {
      id: `${this.options.ledgerId}-${peer.ledgerId}`,
      fromLedgerId: this.options.ledgerId,
      toLedgerId: peer.ledgerId,
      trustLevel: 0.5,
      successfulInteractions: 0,
      failedInteractions: 0,
      status: "connected",
    };

    this.connections.set(connection.id, connection);

    // Save to database
    // TODO: Persist to database
  }

  /**
   * Disconnect from peer
   */
  async disconnectPeer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return;
    }

    // Update peer
    this.peers.set(peerId, {
      ...peer,
      connectedAt: undefined,
    });

    // Update connection status
    const connectionId = `${this.options.ledgerId}-${peerId}`;
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.set(connectionId, {
        ...connection,
        status: "disconnected",
      });
    }

    // Update database
    // TODO: Persist to database
  }

  /**
   * Discover peers from bootstrap node
   */
  private async discoverPeers(endpoint: string): Promise<MeshPeer[]> {
    const response = await fetch(`${endpoint}/mesh/peers`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to discover peers: ${response.statusText}`);
    }

    const data = await response.json();
    return data.peers || [];
  }

  /**
   * Announce presence to peers
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
    for (const peer of this.peers.values()) {
      try {
        await fetch(`${peer.endpoint}/mesh/peers`, {
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
   */
  private async addPeer(peer: MeshPeer): Promise<void> {
    // Check if already exists
    if (this.peers.has(peer.ledgerId)) {
      // Update last seen
      const existing = this.peers.get(peer.ledgerId)!;
      this.peers.set(peer.ledgerId, {
        ...existing,
        lastSeen: Date.now(),
      });
      return;
    }

    // Add new peer
    this.peers.set(peer.ledgerId, {
      ...peer,
      lastSeen: Date.now(),
    });

    // Save to database
    // TODO: Persist to database
  }
}
````

**Deliverable:**

- ✅ Mesh Network Service implementatie
- ✅ Peer discovery via bootstrap
- ✅ Peer connection management
- ✅ Presence announcement

---

## 📝 Stap 5: Query & Sync Services (Day 11-14)

### 5.1 Query Service

**`ledger/modules/mesh/src/services/mesh-query-service.ts`:**

````typescript
import type { OnoalLedger } from "@onoal/ledger-core";
import type {
  CrossLedgerQuery,
  CrossLedgerQueryResponse,
  MeshPeer,
} from "../types.js";
import { MeshNetworkService } from "./mesh-network-service.js";
import { signMessage } from "../utils/signature.js";
import { validateQuery } from "../utils/validation.js";

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
      throw new Error(`Peer not found: ${toLedgerId}`);
    }

    // Create query
    const query: CrossLedgerQuery = {
      queryId: crypto.randomUUID(),
      fromLedgerId: this.ledger.config.name, // TODO: Get from options
      toLedgerId,
      filters: {
        ...filters,
        limit: filters.limit || 100,
      },
      requesterOid,
      signature: "", // Will be signed below
    };

    // Sign query
    const signer = this.ledger.getService("signer");
    query.signature = signMessage(query, signer);

    // Validate query
    const validation = validateQuery(query);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Send query
    const response = await fetch(`${peer.endpoint}/mesh/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const result: CrossLedgerQueryResponse = await response.json();

    // Verify response signature
    // TODO: Implement signature verification

    return result;
  }
}
````

### 5.2 Sync Service

**`ledger/modules/mesh/src/services/mesh-sync-service.ts`:**

````typescript
import type { OnoalLedger } from "@onoal/ledger-core";
import type { EntrySync, EntrySyncResponse, MeshPeer } from "../types.js";
import { MeshNetworkService } from "./mesh-network-service.js";
import { validateSync } from "../utils/validation.js";

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
   * Sync with remote ledger
   */
  async syncWith(
    toLedgerId: string,
    filters: EntrySync["filters"]
  ): Promise<EntrySyncResponse> {
    // Get peer
    const peers = await this.meshNetwork.getPeers();
    const peer = peers.find((p) => p.ledgerId === toLedgerId);
    if (!peer) {
      throw new Error(`Peer not found: ${toLedgerId}`);
    }

    // Get last sync timestamp
    const lastSync = await this.getLastSyncTimestamp(
      toLedgerId,
      filters.stream
    );
    const since = filters.since || lastSync || 0;

    // Create sync request
    const sync: EntrySync = {
      syncId: crypto.randomUUID(),
      fromLedgerId: this.ledger.config.name, // TODO: Get from options
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

    // Send sync request
    const response = await fetch(`${peer.endpoint}/mesh/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sync),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    const result: EntrySyncResponse = await response.json();

    // Update sync state
    await this.updateSyncState(
      toLedgerId,
      filters.stream,
      result.lastSyncedTimestamp
    );

    return result;
  }

  /**
   * Get last sync timestamp
   */
  private async getLastSyncTimestamp(
    ledgerId: string,
    stream?: string
  ): Promise<number | null> {
    // Query database
    // TODO: Implement database query
    return null;
  }

  /**
   * Update sync state
   */
  private async updateSyncState(
    ledgerId: string,
    stream: string | undefined,
    timestamp: number
  ): Promise<void> {
    // Update database
    // TODO: Implement database update
  }
}
````

**Deliverable:**

- ✅ Query Service implementatie
- ✅ Sync Service implementatie
- ✅ Error handling
- ✅ Validation

---

## 📝 Stap 6: API Routes (Day 15-18)

### 6.1 Route Handlers

**`ledger/modules/mesh/src/routes/peers.ts`:**

```typescript
import type { OnoalLedger } from "@onoal/ledger-core";
import { MeshNetworkService } from "../services/mesh-network-service.js";

/**
 * GET /mesh/peers - List connected peers
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
      peers: peers.map((p) => ({
        ledgerId: p.ledgerId,
        ledgerOid: p.ledgerOid,
        endpoint: p.endpoint,
        capabilities: p.capabilities,
        trustLevel: p.trustLevel,
        lastSeen: p.lastSeen,
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
 * POST /mesh/peers - Announce presence or connect
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
      trustLevel: 0.5,
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
```

**`ledger/modules/mesh/src/routes/query.ts`:**

```typescript
import type { OnoalLedger } from "@onoal/ledger-core";
import { MeshQueryService } from "../services/mesh-query-service.js";
import { verifyMessage } from "../utils/signature.js";
import { validateQuery } from "../utils/validation.js";

/**
 * POST /mesh/query - Cross-ledger query
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

    // Verify signature
    // TODO: Get peer public key and verify
    // const isValid = verifyMessage(query, peerPublicKey);
    // if (!isValid) {
    //   return Response.json({ error: "Invalid signature" }, { status: 401 });
    // }

    // Execute query using ledger's query method
    const result = await ledger.queryEntries({
      subjectOid: query.filters.subjectOid,
      issuerOid: query.filters.issuerOid,
      status: "active",
      limit: query.filters.limit || 100,
    });

    // Sign response
    const signer = ledger.getService("signer");
    const response: CrossLedgerQueryResponse = {
      queryId: query.queryId,
      entries: result.entries,
      hasMore: result.hasMore,
      proof: {
        signature: "", // TODO: Sign response
        timestamp: Date.now(),
      },
    };

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
```

**`ledger/modules/mesh/src/routes/sync.ts`:**

```typescript
import type { OnoalLedger } from "@onoal/ledger-core";
import { MeshSyncService } from "../services/mesh-sync-service.js";
import { validateSync } from "../utils/validation.js";

/**
 * POST /mesh/sync - Entry synchronization
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

    // Get entries since timestamp
    const filters: any = {
      status: "active",
      limit: 1000, // Max sync batch size
    };

    if (sync.filters.stream) {
      filters.stream = sync.filters.stream;
    }

    if (sync.filters.since) {
      // Query entries since timestamp
      // TODO: Implement timestamp-based query
      // For now, get all entries and filter
    }

    const result = await ledger.queryEntries(filters);

    const response: EntrySyncResponse = {
      syncId: sync.syncId,
      entries: result.entries,
      hasMore: result.hasMore,
      lastSyncedTimestamp: Date.now(),
    };

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
```

**Deliverable:**

- ✅ All 4 route handlers geïmplementeerd
- ✅ Error handling
- ✅ Input validation
- ✅ Response formatting

---

## 📝 Stap 7: Module Export (Day 19-20)

### 7.1 Module Index

**`ledger/modules/mesh/src/index.ts`:**

````typescript
/**
 * Onoal Network Mesh Protocol Module
 *
 * Provides cross-ledger connectivity, queries, and synchronization.
 *
 * @module @onoal/ledger-module-mesh
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { createCustomModule } from "@onoal/ledger-core";
import { MeshNetworkService } from "./services/mesh-network-service.js";
import { MeshQueryService } from "./services/mesh-query-service.js";
import { MeshSyncService } from "./services/mesh-sync-service.js";
import { meshDrizzleSchema } from "./schema/index.js";
import type { MeshProtocolModuleOptions } from "./types.js";

// Route handlers
import { getPeersHandler, connectPeerHandler } from "./routes/peers.js";
import { queryHandler } from "./routes/query.js";
import { syncHandler } from "./routes/sync.js";

/**
 * Mesh Protocol Module
 *
 * Enables cross-ledger connectivity and operations.
 *
 * @example
 * ```typescript
 * import { meshProtocolModule } from "@onoal/ledger-module-mesh";
 * import { createLedger } from "@onoal/ledger-core";
 *
 * const ledger = await createLedger({
 *   name: "my-ledger",
 *   modules: [
 *     meshProtocolModule({
 *       ledgerId: "my-ledger-id",
 *       ledgerOid: "oid:onoal:org:myorg",
 *       publicKey: "a1b2c3...",
 *       endpoint: "https://ledger.example.com",
 *       bootstrapNodes: [
 *         { ledgerId: "hub-1", endpoint: "https://hub1.onoal.network" }
 *       ],
 *     }),
 *   ],
 *   // ...
 * });
 *
 * // Use mesh services
 * const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
 * await meshNetwork.join();
 *
 * const meshQuery = ledger.getService<MeshQueryService>("meshQueryService");
 * const entries = await meshQuery.queryRemote("other-ledger-id", {
 *   subjectOid: "oid:...",
 * }, "oid:requester");
 * ```
 */
export function meshProtocolModule(
  options: MeshProtocolModuleOptions
): ReturnType<typeof createCustomModule> {
  return createCustomModule({
    id: "mesh-protocol",
    label: "Onoal Network Mesh Protocol",
    version: "1.0.0",

    // Services
    services: {
      meshNetworkService: (ledger: OnoalLedger) =>
        new MeshNetworkService(ledger, options),
      meshQueryService: MeshQueryService,
      meshSyncService: MeshSyncService,
    },

    // Routes
    routes: [
      {
        method: "GET",
        path: "/mesh/peers",
        handler: getPeersHandler,
      },
      {
        method: "POST",
        path: "/mesh/connect",
        handler: connectPeerHandler,
      },
      {
        method: "POST",
        path: "/mesh/query",
        handler: queryHandler,
      },
      {
        method: "POST",
        path: "/mesh/sync",
        handler: syncHandler,
      },
    ],

    // Database schema
    drizzleSchema: meshDrizzleSchema,

    // Lifecycle
    lifecycle: {
      start: async (ledger: OnoalLedger) => {
        const meshNetwork =
          ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.join();
      },
      stop: async (ledger: OnoalLedger) => {
        const meshNetwork =
          ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.leave();
      },
    },
  });
}

// Re-export services and types for convenience
export { MeshNetworkService } from "./services/mesh-network-service.js";
export { MeshQueryService } from "./services/mesh-query-service.js";
export { MeshSyncService } from "./services/mesh-sync-service.js";
export type * from "./types.js";
````

**Deliverable:**

- ✅ Module export compleet
- ✅ Services geregistreerd
- ✅ Routes geregistreerd
- ✅ Schema geregistreerd
- ✅ Lifecycle hooks

---

## 📝 Stap 8: Documentation & Examples (Day 21-24)

### 8.1 README

**`ledger/modules/mesh/README.md`:**

````markdown
# @onoal/ledger-module-mesh

Onoal Network Mesh Protocol - Cross-ledger connectivity and synchronization.

## Installation

```bash
npm install @onoal/ledger-module-mesh
```
````

## Quick Start

```typescript
import { meshProtocolModule } from "@onoal/ledger-module-mesh";
import { createLedger } from "@onoal/ledger-core";

const ledger = await createLedger({
  name: "my-ledger",
  modules: [
    meshProtocolModule({
      ledgerId: "my-ledger-id",
      ledgerOid: "oid:onoal:org:myorg",
      publicKey: "a1b2c3...",
      endpoint: "https://ledger.example.com",
      bootstrapNodes: [
        { ledgerId: "hub-1", endpoint: "https://hub1.onoal.network" },
      ],
    }),
  ],
  // ...
});
```

## Usage

### Query Remote Ledger

```typescript
const meshQuery = ledger.getService<MeshQueryService>("meshQueryService");
const entries = await meshQuery.queryRemote(
  "other-ledger-id",
  { subjectOid: "oid:..." },
  "oid:requester"
);
```

### Sync with Remote Ledger

```typescript
const meshSync = ledger.getService<MeshSyncService>("meshSyncService");
const result = await meshSync.syncWith("other-ledger-id", {
  stream: "main",
  since: Date.now() - 86400000, // Last 24 hours
});
```

## API Reference

See [full documentation](../../docs/onoal-docs/content/docs/ledger/modules/mesh.md).

## License

MIT

````

### 8.2 Example Implementation

**`ledger/modules/mesh/examples/basic-usage.ts`:**

```typescript
import { meshProtocolModule } from "@onoal/ledger-module-mesh";
import { createLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";

async function main() {
  // Create ledger with mesh module
  const ledger = await createLedger({
    name: "example-ledger",
    signingKey: new Uint8Array(32), // Your signing key
    database: sqliteAdapter({
      url: "file:./example.db",
    }),
    modules: [
      meshProtocolModule({
        ledgerId: "example-ledger-id",
        ledgerOid: "oid:onoal:org:example",
        publicKey: "a1b2c3...", // Your public key
        endpoint: "https://example.ledger.com",
        bootstrapNodes: [
          { ledgerId: "hub-1", endpoint: "https://hub1.onoal.network" },
        ],
      }),
    ],
  });

  // Get mesh services
  const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
  const meshQuery = ledger.getService<MeshQueryService>("meshQueryService");

  // Join mesh network (automatically called on start)
  await meshNetwork.join();

  // Get connected peers
  const peers = await meshNetwork.getPeers();
  console.log("Connected peers:", peers);

  // Query remote ledger
  if (peers.length > 0) {
    const entries = await meshQuery.queryRemote(
      peers[0].ledgerId,
      { subjectOid: "oid:..." },
      "oid:requester"
    );
    console.log("Query results:", entries);
  }
}

main().catch(console.error);
````

**Deliverable:**

- ✅ README met voorbeelden
- ✅ Example implementation
- ✅ API reference links

---

## 📝 Stap 9: Testing (Day 25-28)

### 9.1 Unit Tests

**`ledger/modules/mesh/tests/mesh-network-service.test.ts`:**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MeshNetworkService } from "../src/services/mesh-network-service.js";

describe("MeshNetworkService", () => {
  let service: MeshNetworkService;

  beforeEach(() => {
    // Setup
  });

  it("should join mesh network", async () => {
    // Test implementation
  });

  it("should discover peers from bootstrap nodes", async () => {
    // Test implementation
  });

  it("should connect to peer", async () => {
    // Test implementation
  });
});
```

### 9.2 Integration Tests

**`ledger/modules/mesh/tests/integration.test.ts`:**

```typescript
import { describe, it, expect } from "vitest";
import { createLedger } from "@onoal/ledger-core";
import { meshProtocolModule } from "../src/index.js";

describe("Mesh Protocol Integration", () => {
  it("should create ledger with mesh module", async () => {
    // Test implementation
  });

  it("should handle cross-ledger query", async () => {
    // Test implementation
  });
});
```

**Deliverable:**

- ✅ Unit tests voor alle services
- ✅ Integration tests
- ✅ Test coverage > 80%

---

## 📝 Stap 10: Error Handling & Polish (Day 29-32)

### 10.1 Custom Errors

**`ledger/modules/mesh/src/errors.ts`:**

```typescript
export class MeshError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "MeshError";
  }
}

export class PeerNotFoundError extends MeshError {
  constructor(ledgerId: string) {
    super(`Peer not found: ${ledgerId}`, "PEER_NOT_FOUND", 404);
    this.name = "PeerNotFoundError";
  }
}

export class ConnectionFailedError extends MeshError {
  constructor(endpoint: string, reason?: string) {
    super(
      `Failed to connect to ${endpoint}: ${reason || "Unknown error"}`,
      "CONNECTION_FAILED",
      503
    );
    this.name = "ConnectionFailedError";
  }
}
```

### 10.2 Error Handling in Services

Update alle services om custom errors te gebruiken:

```typescript
// In mesh-network-service.ts
if (!peer) {
  throw new PeerNotFoundError(toLedgerId);
}

// In mesh-query-service.ts
if (!response.ok) {
  throw new ConnectionFailedError(peer.endpoint, response.statusText);
}
```

**Deliverable:**

- ✅ Custom error types
- ✅ Consistent error handling
- ✅ Error messages in responses

---

## ✅ Checklist per Fase

### Phase 1: Foundation ✅

- [ ] Project setup
- [ ] Type definitions
- [ ] Database schema
- [ ] Utility functions

### Phase 2: Core Connectivity ✅

- [ ] Mesh Network Service
- [ ] Peer discovery
- [ ] Connection management
- [ ] Routing logic

### Phase 3: Cross-Ledger Operations ✅

- [ ] Query Service
- [ ] Sync Service
- [ ] API routes
- [ ] Request/response handling

### Phase 4: DX & Polish ✅

- [ ] README documentation
- [ ] Code examples
- [ ] Unit tests
- [ ] Integration tests
- [ ] Error handling
- [ ] TypeScript types export

---

## 🎯 Success Criteria

### Functional

- ✅ Ledgers kunnen verbinden via bootstrap nodes
- ✅ Cross-ledger queries werken
- ✅ Entry synchronisatie werkt
- ✅ Peer discovery werkt

### DX (Developer Experience)

- ✅ Eenvoudige API (1-2 lines code voor basis operaties)
- ✅ Volledige TypeScript types
- ✅ Goede error messages
- ✅ Duidelijke documentatie
- ✅ Werkt out-of-the-box met minimale configuratie

### Quality

- ✅ Test coverage > 80%
- ✅ Geen linter errors
- ✅ TypeScript strict mode
- ✅ Consistent met andere modules

---

## 📚 Resources

- [V1 Specification](./ONOAL_MESH_NETWORK_V1_SPEC.md)
- [Module vs Plugin Analysis](./MESH_PROTOCOL_MODULE_VS_PLUGIN_ANALYSIS.md)
- [Token Module Example](../token/src/index.ts)

---

## 🚀 Next Steps

Na V1 implementatie:

- V2: Advanced routing (OID-based, DHT)
- V3: Chain trust & Web of Trust
- V4: Advanced privacy (ZK proofs, onion routing)
