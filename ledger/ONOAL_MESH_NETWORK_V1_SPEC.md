# Onoal Mesh Network - V1 Specification (MVP)

**Versie**: 1.0.0  
**Laatste update**: 2025-01-27  
**Doel**: Minimale viable mesh network voor cross-ledger operaties

---

## 🎯 V1 Scope - MVP Features

### ✅ Wat zit er WEL in (V1)

1. **Basis Mesh Connectivity**
   - Ledgers kunnen verbinden met andere ledgers
   - Direct peer-to-peer connecties
   - Basis peer discovery (bootstrap nodes)

2. **Cross-Ledger Queries**
   - Query entries van andere ledgers
   - Basis verificatie via signatures

3. **Basis Routing**
   - Direct routing (als peer bekend is)
   - Eenvoudige forwarding (via 1 hop)

4. **Basis Trust**
   - Direct trust tussen peers
   - Trust level (0.0 - 1.0)

5. **Basis Synchronisatie**
   - Entry sync tussen peers
   - Incremental sync (sinds laatste sync)

### ❌ Wat zit er NIET in (V1)

- ❌ Complexe routing (DHT, gossip, flooding)
- ❌ Chain trust / Web of trust
- ❌ Geavanceerde privacy (ZK proofs, onion routing)
- ❌ Multiple sync strategieën (checkpoint, state sync)
- ❌ DNS-based discovery
- ❌ Registry-based discovery
- ❌ Public mesh anchoring
- ❌ Advanced message encryption
- ❌ Query privacy features

---

## 🌐 V1 Netwerk Topologie

### Eenvoudige Mesh

```
        ┌─────────────┐
        │  Ledger A   │
        │ (Bootstrap) │
        └──────┬──────┘
               │
        ┌──────┴──────┐
        │             │
   ┌────▼────┐   ┌────▼────┐
   │ Ledger B│   │ Ledger C│
   └────┬────┘   └────┬────┘
        │             │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │  Ledger D   │
        └─────────────┘
```

**Kenmerken:**
- Directe peer-to-peer connecties
- Bootstrap node voor discovery
- Max 1 hop routing (via directe peer)
- Geen complexe routing

---

## 🏗️ V1 Protocol Stack

```
┌─────────────────────────────────────────────────────────────┐
│              Onoal Mesh Network V1                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 3: Application Protocol                               │
│  ├─ Cross-Ledger Query (CLQ)                                │
│  └─ Entry Sync (ES)                                          │
│                                                              │
│  Layer 2: Mesh Transport                                     │
│  ├─ Peer Authentication (Certificate)                        │
│  ├─ Message Encryption (TLS)                                │
│  └─ Connection Management                                    │
│                                                              │
│  Layer 1: Network Layer                                      │
│  └─ HTTP/HTTPS (REST API)                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Vereenvoudigd:**
- Geen complexe routing layer
- Geen sync protocol layer
- Alleen HTTP/HTTPS (geen WebSocket/gRPC)

---

## 🆔 V1 Ledger Identiteit

### Minimale Identiteit

```typescript
interface LedgerIdentity {
  // Unique identifier
  ledgerId: string; // UUID
  // Example: "550e8400-e29b-41d4-a716-446655440000"
  
  // OID for this ledger
  ledgerOid: string; // Hierarchical OID
  // Example: "oid:onoal:org:myorg"
  
  // Public key (Ed25519)
  publicKey: string; // Hex-encoded
  
  // Network endpoint
  endpoint: string; // HTTP endpoint
  // Example: "https://ledger.example.com"
  
  // Capabilities (simple array)
  capabilities: string[];
  // Example: ["query", "sync"]
}
```

**Vereenvoudigd:**
- Geen multiple endpoints (alleen HTTP)
- Geen metadata
- Geen certificate structuur (alleen public key)

---

## 🔍 V1 Peer Discovery

### Alleen Bootstrap Nodes

```typescript
interface BootstrapDiscovery {
  method: "bootstrap";
  bootstrapNodes: Array<{
    ledgerId: string;
    endpoint: string; // HTTP endpoint
  }>;
  // Example: [
  //   { ledgerId: "hub-1", endpoint: "https://hub1.onoal.network" }
  // ]
}
```

**Flow:**
```
Ledger A              Bootstrap Node              Ledger B
   │                         │                         │
   │─── GET /mesh/peers ────>│                         │
   │                         │                         │
   │<─── [Peer List] ────────│                         │
   │                         │                         │
   │─── POST /mesh/connect ──────────────────────────>│
```

**Vereenvoudigd:**
- Geen DNS discovery
- Geen registry
- Geen gossip/DHT
- Alleen bootstrap nodes

---

## 🗺️ V1 Routing

### Direct Routing + Eenvoudige Forwarding

```typescript
interface SimpleRouting {
  // Direct routing (als peer bekend is)
  routeDirect(toLedgerId: string): MeshPeer | null;
  
  // Forward via 1 hop (als peer niet bekend is)
  routeViaPeer(toLedgerId: string): {
    viaPeer: MeshPeer;
    targetPeer: MeshPeer;
  } | null;
}
```

**Routing Logic:**
```typescript
async function route(message: MeshMessage): Promise<MeshResponse> {
  // 1. Check direct connection
  const directPeer = routingTable.findDirectPeer(message.to.ledgerId);
  if (directPeer) {
    return await sendDirect(directPeer, message);
  }
  
  // 2. Check if any peer knows target
  const viaPeer = routingTable.findPeerThatKnows(message.to.ledgerId);
  if (viaPeer) {
    return await forwardViaPeer(viaPeer, message);
  }
  
  // 3. Not found
  return { error: "Peer not found" };
}
```

**Vereenvoudigd:**
- Geen OID-based routing
- Geen flooding
- Geen gossip
- Geen DHT
- Max 1 hop forwarding

---

## 🤝 V1 Trust Management

### Alleen Direct Trust

```typescript
interface DirectTrust {
  fromLedgerId: string;
  toLedgerId: string;
  trustLevel: number; // 0.0 - 1.0
  // Example: 0.9 (high trust)
  
  // Simple metrics
  successfulInteractions: number;
  failedInteractions: number;
  lastInteraction: number; // Unix timestamp
}
```

**Trust Calculation:**
```typescript
function calculateTrustLevel(trust: DirectTrust): number {
  const total = trust.successfulInteractions + trust.failedInteractions;
  if (total === 0) return 0.5; // Default
  
  const successRate = trust.successfulInteractions / total;
  return successRate; // Simple: success rate = trust level
}
```

**Vereenvoudigd:**
- Geen chain trust
- Geen web of trust
- Geen trust anchors
- Alleen direct trust tussen peers

---

## 🔄 V1 Cross-Ledger Operaties

### 1. Cross-Ledger Query

**Query Request:**
```typescript
interface CrossLedgerQuery {
  // Query metadata
  queryId: string; // UUID
  fromLedgerId: string;
  toLedgerId: string;
  
  // Simple filters
  filters: {
    subjectOid?: string;
    issuerOid?: string;
    entryType?: string;
    limit?: number; // Max 100
  };
  
  // Authentication
  requesterOid: string;
  signature: string; // Ed25519 signature
}
```

**Query Response:**
```typescript
interface CrossLedgerQueryResponse {
  queryId: string;
  entries: LedgerEntry[];
  hasMore: boolean;
  
  // Simple proof
  proof: {
    signature: string; // Ledger signature
    timestamp: number;
  };
}
```

**Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── POST /mesh/query ─────────────────────────────────────>│
   │   (queryId, filters, auth)                                 │
   │                                                             │
   │                                                             │─── Execute Query
   │                                                             │
   │<─── Query Response ────────────────────────────────────────│
   │   (queryId, entries, proof)                                 │
```

**Vereenvoudigd:**
- Geen Merkle proofs
- Geen complexe verificatie
- Alleen signature verificatie
- Max 100 entries per query

### 2. Entry Synchronisatie

**Sync Request:**
```typescript
interface EntrySync {
  syncId: string;
  fromLedgerId: string;
  toLedgerId: string;
  
  // Simple filters
  filters: {
    stream?: string;
    since?: number; // Unix timestamp (incremental sync)
  };
}
```

**Sync Response:**
```typescript
interface EntrySyncResponse {
  syncId: string;
  entries: LedgerEntry[];
  hasMore: boolean;
  lastSyncedTimestamp: number;
}
```

**Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── POST /mesh/sync ───────────────────────────────────────>│
   │   (syncId, filters)                                        │
   │                                                             │
   │                                                             │─── Get Entries Since
   │                                                             │
   │<─── Sync Response ──────────────────────────────────────────│
   │   (syncId, entries, lastSyncedTimestamp)                   │
```

**Vereenvoudigd:**
- Geen checkpoint sync
- Geen state sync
- Alleen incremental sync (sinds timestamp)
- Geen conflict resolution

---

## 🔒 V1 Security

### Basis Security

```typescript
interface SecurityConfig {
  // Transport encryption
  tls: {
    enabled: true; // Always HTTPS
    version: "1.3";
  };
  
  // Message authentication
  messageAuth: {
    method: "ed25519"; // Ed25519 signatures
    verifyAll: true; // Verify all messages
  };
  
  // Peer authentication
  peerAuth: {
    method: "public-key"; // Public key verification
    verifyOnConnect: true;
  };
}
```

**Vereenvoudigd:**
- Geen Noise Protocol
- Geen message encryption (alleen TLS)
- Geen advanced authentication
- Alleen Ed25519 signatures

---

## 📨 V1 Message Types

### Minimale Message Types

```typescript
type MeshMessageType =
  | "peer_announce"    // Announce presence
  | "peer_discover"    // Discover peers (via bootstrap)
  | "query_request"    // Cross-ledger query
  | "query_response"   // Query response
  | "sync_request"     // Request sync
  | "sync_response"    // Sync response
  | "heartbeat";       // Keep-alive
```

**Vereenvoudigd:**
- Geen trust messages
- Geen proof verification messages
- Geen reference check messages
- Geen topology update messages

### Message Structure

```typescript
interface MeshMessage {
  // Message metadata
  id: string; // UUID
  type: MeshMessageType;
  timestamp: number; // Unix timestamp
  
  // Routing
  from: {
    ledgerId: string;
    ledgerOid: string;
  };
  to: {
    ledgerId: string;
  };
  
  // Payload
  payload: unknown; // Type-specific payload
  
  // Authentication
  signature: string; // Ed25519 signature
}
```

**Vereenvoudigd:**
- Geen path tracking
- Geen TTL
- Geen encryption
- Alleen basis routing

---

## 💾 V1 Database Schema

### Minimale Schema

#### 1. **mesh_peers**

```sql
CREATE TABLE mesh_peers (
  id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL UNIQUE,
  ledger_oid TEXT NOT NULL,
  public_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  capabilities TEXT[], -- Simple array
  trust_level REAL DEFAULT 0.5,
  last_seen BIGINT NOT NULL,
  connected_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_mesh_peers_ledger_id ON mesh_peers(ledger_id);
CREATE INDEX idx_mesh_peers_ledger_oid ON mesh_peers(ledger_oid);
```

#### 2. **mesh_connections**

```sql
CREATE TABLE mesh_connections (
  id TEXT PRIMARY KEY,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT NOT NULL,
  trust_level REAL DEFAULT 0.5,
  successful_interactions BIGINT DEFAULT 0,
  failed_interactions BIGINT DEFAULT 0,
  last_interaction BIGINT,
  status TEXT NOT NULL, -- 'connected', 'disconnected'
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(from_ledger_id, to_ledger_id)
);

CREATE INDEX idx_mesh_connections_from ON mesh_connections(from_ledger_id);
CREATE INDEX idx_mesh_connections_to ON mesh_connections(to_ledger_id);
```

#### 3. **mesh_sync_state**

```sql
CREATE TABLE mesh_sync_state (
  id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL,
  stream TEXT, -- Optional stream filter
  last_synced_timestamp BIGINT,
  sync_status TEXT NOT NULL, -- 'synced', 'syncing', 'error'
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(ledger_id, stream)
);

CREATE INDEX idx_mesh_sync_state_ledger ON mesh_sync_state(ledger_id);
```

**Vereenvoudigd:**
- Geen routing table
- Geen trust table (trust in connections)
- Geen messages table (stateless)
- Alleen essentiële tabellen

---

## 🛠️ V1 Implementatie

### Service Architecture

```typescript
// Mesh Network Service (simplified)
class MeshNetworkService {
  // Join mesh network
  async join(bootstrapNodes: Array<{ ledgerId: string; endpoint: string }>): Promise<void>;
  
  // Leave mesh network
  async leave(): Promise<void>;
  
  // Get connected peers
  async getPeers(): Promise<MeshPeer[]>;
  
  // Connect to peer
  async connectPeer(peer: MeshPeer): Promise<void>;
  
  // Disconnect from peer
  async disconnectPeer(peerId: string): Promise<void>;
}

// Mesh Query Service (simplified)
class MeshQueryService {
  // Query remote ledger
  async queryRemote(
    toLedgerId: string,
    filters: QueryFilters,
    requesterOid: string
  ): Promise<LedgerEntry[]>;
}

// Mesh Sync Service (simplified)
class MeshSyncService {
  // Sync with remote ledger
  async syncWith(
    toLedgerId: string,
    filters: SyncFilters
  ): Promise<SyncResult>;
}
```

### Module Structure

```typescript
export function meshProtocolModule(
  options: MeshProtocolModuleOptions
): OnoalLedgerModule {
  return createCustomModule({
    id: "mesh-protocol",
    label: "Onoal Network Mesh Protocol V1",
    version: "1.0.0",
    
    // Services
    services: {
      meshNetworkService: MeshNetworkService,
      meshQueryService: MeshQueryService,
      meshSyncService: MeshSyncService,
    },
    
    // Routes (minimal)
    routes: [
      // Peer management
      { method: "GET", path: "/mesh/peers", handler: getPeersHandler },
      { method: "POST", path: "/mesh/connect", handler: connectPeerHandler },
      
      // Mesh operations
      { method: "POST", path: "/mesh/query", handler: queryHandler },
      { method: "POST", path: "/mesh/sync", handler: syncHandler },
    ],
    
    // Database schema (minimal)
    drizzleSchema: {
      meshPeers: meshPeersTable,
      meshConnections: meshConnectionsTable,
      meshSyncState: meshSyncStateTable,
    },
    
    // Lifecycle
    lifecycle: {
      start: async (ledger) => {
        const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.join(options.bootstrapNodes);
      },
      stop: async (ledger) => {
        const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.leave();
      },
    },
  });
}
```

### Options

```typescript
interface MeshProtocolModuleOptions {
  // This ledger's identity
  ledgerId: string;
  ledgerOid: string;
  publicKey: string; // Ed25519 public key
  endpoint: string; // HTTP endpoint
  
  // Bootstrap nodes (required for V1)
  bootstrapNodes: Array<{
    ledgerId: string;
    endpoint: string;
  }>;
  
  // Optional: Auto-sync
  autoSync?: {
    enabled: boolean;
    interval?: number; // milliseconds
  };
}
```

---

## 📚 V1 Use Cases

### 1. **Basis Cross-Ledger Query**

**Scenario:**
- Ledger A wil entries queryen van Ledger B
- Beide ledgers zijn verbonden via mesh

**Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── POST /mesh/query ─────────────────────────────────────>│
   │   {                                                         │
   │     queryId: "uuid",                                        │
   │     filters: { subjectOid: "oid:..." },                    │
   │     requesterOid: "oid:...",                               │
   │     signature: "..."                                       │
   │   }                                                         │
   │                                                             │
   │                                                             │─── Verify Signature
   │                                                             │─── Execute Query
   │                                                             │
   │<─── 200 OK ────────────────────────────────────────────────│
   │   {                                                         │
   │     queryId: "uuid",                                        │
   │     entries: [...],                                          │
   │     hasMore: false,                                         │
   │     proof: { signature: "...", timestamp: ... }            │
   │   }                                                         │
```

### 2. **Basis Entry Sync**

**Scenario:**
- Ledger A wil entries syncen van Ledger B
- Incremental sync (sinds laatste sync)

**Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── POST /mesh/sync ───────────────────────────────────────>│
   │   {                                                         │
   │     syncId: "uuid",                                         │
   │     filters: { since: 1234567890 }                         │
   │   }                                                         │
   │                                                             │
   │                                                             │─── Get Entries Since
   │                                                             │
   │<─── 200 OK ────────────────────────────────────────────────│
   │   {                                                         │
   │     syncId: "uuid",                                         │
   │     entries: [...],                                          │
   │     hasMore: false,                                         │
   │     lastSyncedTimestamp: 1234567890                        │
   │   }                                                         │
```

---

## 🎯 V1 vs V3/V4 Vergelijking

| Feature | V1 (MVP) | V3/V4 (Full) |
|---------|----------|--------------|
| **Discovery** | Bootstrap nodes only | Bootstrap, DNS, Registry, Gossip, DHT |
| **Routing** | Direct + 1 hop | OID-based, Flooding, Gossip, DHT, Hybrid |
| **Trust** | Direct trust only | Direct, Chain, Web of Trust |
| **Sync** | Incremental only | Entry, Checkpoint, State sync |
| **Privacy** | TLS only | TLS, Noise, ZK proofs, Onion routing |
| **Protocols** | HTTP only | HTTP, WebSocket, gRPC |
| **Database** | 3 tables | 6 tables |
| **Message Types** | 7 types | 15+ types |
| **Complexity** | Low | High |

---

## 🚀 V1 Implementatie Roadmap

### Phase 1: Core Connectivity (Week 1-2)
- [ ] Mesh Network Service
- [ ] Peer discovery (bootstrap)
- [ ] Peer connection management
- [ ] Basis routing (direct + 1 hop)

### Phase 2: Cross-Ledger Operations (Week 3-4)
- [ ] Cross-ledger query service
- [ ] Query API endpoints
- [ ] Signature verification

### Phase 3: Synchronisatie (Week 5-6)
- [ ] Entry sync service
- [ ] Sync API endpoints
- [ ] Sync state management

### Phase 4: Testing & Polish (Week 7-8)
- [ ] Integration tests
- [ ] Documentation
- [ ] Example implementations

---

## 🎯 Conclusie

**V1 is een minimale viable mesh network** dat focust op:

✅ **Essentiële functionaliteit:**
- Basis peer connectivity
- Cross-ledger queries
- Entry synchronisatie

✅ **Eenvoudige implementatie:**
- Alleen HTTP/HTTPS
- Direct routing
- Bootstrap discovery

✅ **Schaalbaar naar V2/V3:**
- Architectuur ondersteunt uitbreiding
- Database schema kan uitgebreid worden
- Services kunnen uitgebreid worden

**V1 is klaar voor productie** zodra core functionaliteit werkt, en kan stapsgewijs uitgebreid worden naar V2/V3 met geavanceerde features.

