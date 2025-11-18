# Onoal Mesh Network - Gedetailleerde Analyse

**Versie**: 1.0.0  
**Laatste update**: 2025-01-27  
**Doel**: Volledige architectuur en specificatie van het Onoal Network Mesh Protocol

---

## 📋 Inhoudsopgave

1. [Visie en Principes](#visie-en-principes)
2. [Netwerk Topologie](#netwerk-topologie)
3. [Protocol Architectuur](#protocol-architectuur)
4. [Ledger Identiteit](#ledger-identiteit)
5. [Peer Discovery](#peer-discovery)
6. [Mesh Routing](#mesh-routing)
7. [Trust Management](#trust-management)
8. [Cross-Ledger Operaties](#cross-ledger-operaties)
9. [Synchronisatie](#synchronisatie)
10. [Security & Privacy](#security--privacy)
11. [Message Types & Flows](#message-types--flows)
12. [Database Schema](#database-schema)
13. [Implementatie Details](#implementatie-details)
14. [Use Cases](#use-cases)

---

## 🎯 Visie en Principes

### Core Visie

> **Het Onoal Mesh Network is een cryptografisch netwerk van soevereine private ledgers** die peer-to-peer verbinden zonder centrale autoriteit, waarbij privacy, integriteit en soevereiniteit worden gewaarborgd.

### Fundamentele Principes

#### 1. **Soevereiniteit (Sovereignty)**
- Elke ledger controleert volledig eigen data en connecties
- Geen externe autoriteit kan data wijzigen of verwijderen
- Ledgers beslissen zelf met wie ze verbinden

#### 2. **Privacy (Privacy)**
- Data blijft privé in private ledgers
- Alleen cryptografische proofs worden gedeeld
- Geen centrale data aggregatie

#### 3. **Cryptografische Integriteit (Cryptographic Integrity)**
- Alle entries zijn cryptografisch geverifieerd
- Hash chain garandeert onveranderlijkheid
- Ed25519 signatures voor authenticatie

#### 4. **Mesh Topologie (Mesh Topology)**
- Geen centrale hub of broker
- Directe peer-to-peer connecties
- Self-organizing network

#### 5. **OID-based Routing (OID-based Routing)**
- Entiteiten geïdentificeerd via OID (Object Identifier)
- OID bepaalt routing pad
- Hiërarchische OID structuur ondersteunt routing

---

## 🌐 Netwerk Topologie

### Mesh Topologie Overzicht

```
                    ┌─────────────────┐
                    │   Ledger A      │
                    │   oid:org:a     │
                    │   (Hub Node)    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │ Ledger B│          │ Ledger C│          │ Ledger D│
   │oid:org:b│          │oid:org:c│          │oid:org:d│
   └────┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
        │              ┌──────┴──────┐            │
        │              │             │            │
   ┌────▼────┐    ┌────▼────┐   ┌────▼────┐  ┌────▼────┐
   │ Ledger E│    │ Ledger F│   │ Ledger G│  │ Ledger H│
   │oid:org:e│    │oid:org:f│   │oid:org:g│  │oid:org:h│
   └─────────┘    └─────────┘   └─────────┘  └─────────┘
```

### Topologie Kenmerken

#### 1. **Geen Centrale Hub**
- Geen single point of failure
- Geen centrale autoriteit
- Gedistribueerde controle

#### 2. **Multiple Paths**
- Meerdere routes tussen ledgers
- Redundantie voor betrouwbaarheid
- Load balancing mogelijk

#### 3. **Dynamic Topology**
- Ledgers kunnen joinen/verlaten
- Netwerk reorganiseert automatisch
- Self-healing network

#### 4. **OID-based Clustering**
- Ledgers met gerelateerde OIDs clusteren vaak
- `oid:org:a` en `oid:org:b` zijn waarschijnlijk verbonden
- Hiërarchische routing mogelijk

### Netwerk Lagen

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  - Cross-ledger queries                                     │
│  - Cross-ledger references                                   │
│  - Proof verification                                        │
│  - Business logic                                            │
├─────────────────────────────────────────────────────────────┤
│                    Mesh Protocol Layer                       │
│  - OID-based routing                                         │
│  - Message routing & forwarding                              │
│  - Topology management                                       │
│  - Path discovery                                            │
├─────────────────────────────────────────────────────────────┤
│                    Sync Layer                                │
│  - Entry synchronization                                    │
│  - Conflict resolution                                       │
│  - State reconciliation                                      │
│  - Checkpoint sync                                           │
├─────────────────────────────────────────────────────────────┤
│                    Transport Layer                           │
│  - Peer-to-peer connections                                 │
│  - Authentication & authorization                            │
│  - Message encryption                                        │
│  - Connection management                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Protocol Architectuur

### Protocol Stack

```
┌─────────────────────────────────────────────────────────────┐
│              Onoal Network Mesh Protocol                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 4: Application Protocol                               │
│  ├─ Cross-Ledger Query Protocol (CLQP)                      │
│  ├─ Cross-Ledger Reference Protocol (CLRP)                   │
│  ├─ Proof Verification Protocol (PVP)                        │
│  └─ State Synchronization Protocol (SSP)                     │
│                                                              │
│  Layer 3: Mesh Routing Protocol (MRP)                         │
│  ├─ OID-based Routing                                       │
│  ├─ Path Discovery (DHT/Gossip/Flooding)                    │
│  ├─ Topology Management                                     │
│  └─ Message Forwarding                                       │
│                                                              │
│  Layer 2: Mesh Transport Protocol (MTP)                       │
│  ├─ Peer Authentication                                      │
│  ├─ Message Encryption (TLS/Noise Protocol)                 │
│  ├─ Connection Management                                    │
│  └─ Heartbeat & Keep-Alive                                   │
│                                                              │
│  Layer 1: Network Layer                                      │
│  ├─ HTTP/HTTPS (REST API)                                    │
│  ├─ WebSocket (Real-time)                                    │
│  └─ gRPC (High-performance)                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Protocol Versies

```typescript
interface MeshProtocolVersion {
  major: number; // Breaking changes
  minor: number; // New features
  patch: number; // Bug fixes
  // Example: "1.0.0"
}
```

**Versie 1.0.0** (Huidige):
- Basis mesh connectivity
- OID-based routing
- Cross-ledger queries
- Entry synchronization

---

## 🆔 Ledger Identiteit

### Ledger Identificatie

Elke ledger in het mesh network heeft een unieke identiteit:

```typescript
interface LedgerIdentity {
  // Unique identifier
  ledgerId: string; // UUID of custom ID
  // Example: "550e8400-e29b-41d4-a716-446655440000"
  
  // OID for this ledger
  ledgerOid: string; // Hierarchical OID
  // Example: "oid:onoal:org:myorg"
  
  // Public key (Ed25519)
  publicKey: string; // Hex-encoded public key
  // Example: "a1b2c3d4e5f6..."
  
  // Network endpoint
  endpoint: {
    http?: string;  // REST API endpoint
    ws?: string;    // WebSocket endpoint
    grpc?: string;  // gRPC endpoint
  };
  // Example: { http: "https://ledger.example.com" }
  
  // Capabilities
  capabilities: string[];
  // Example: ["query", "sync", "proof-verify"]
  
  // Metadata
  metadata: {
    name?: string;
    version?: string;
    description?: string;
    region?: string;
    // ...
  };
}
```

### OID Structuur voor Mesh

```
oid:onoal:org:myorg
│   │      │   │
│   │      │   └─ Organization identifier
│   │      └───── Domain (org, gov, edu, etc.)
│   └──────────── Onoal namespace
└───────────────── OID prefix
```

**OID Routing Rules:**
- `oid:onoal:org:a` en `oid:onoal:org:b` → Zelfde domain, directe connectie waarschijnlijk
- `oid:onoal:org:a` en `oid:onoal:gov:b` → Verschillende domains, via hub routing
- `oid:onoal:org:a:dept:finance` → Sub-organization, routing via parent

### Ledger Certificate

Elke ledger heeft een zelf-ondertekend certificaat:

```typescript
interface LedgerCertificate {
  // Certificate metadata
  version: string;
  ledgerId: string;
  ledgerOid: string;
  publicKey: string;
  
  // Validity
  issuedAt: number; // Unix timestamp
  expiresAt?: number; // Optional expiration
  
  // Signature
  signature: string; // Ed25519 signature over certificate data
  
  // Issuer (self-signed)
  issuer: {
    ledgerId: string;
    ledgerOid: string;
  };
}
```

---

## 🔍 Peer Discovery

### Discovery Methoden

#### 1. **Registry-based Discovery**

```typescript
interface RegistryDiscovery {
  method: "registry";
  registryUrl: string; // Central registry endpoint
  // Example: "https://registry.onoal.network"
  
  // Registry authentication
  auth?: {
    apiKey?: string;
    jwt?: string;
  };
  
  // Refresh interval
  refreshInterval?: number; // milliseconds
}
```

**Flow:**
```
Ledger A                    Registry                    Ledger B
   │                            │                            │
   │─── Register ──────────────>│                            │
   │                            │                            │
   │                            │<─── Register ──────────────│
   │                            │                            │
   │<─── Peer List ─────────────│                            │
   │                            │                            │
   │─── Connect ────────────────────────────────────────────>│
```

#### 2. **DNS-based Discovery**

```typescript
interface DNSDiscovery {
  method: "dns";
  domain: string; // DNS domain for SRV records
  // Example: "_mesh._tcp.onoal.network"
  
  // DNS record format
  // _mesh._tcp.onoal.network. 3600 IN SRV 10 5 443 ledger1.onoal.network.
}
```

**DNS SRV Record:**
```
_mesh._tcp.onoal.network. 3600 IN SRV 10 5 443 ledger1.onoal.network.
│     │    │                │    │   │  │  │    │
│     │    │                │    │   │  │  │    └─ Target hostname
│     │    │                │    │   │  │  └────── Port
│     │    │                │    │   │  └───────── Weight
│     │    │                │    │   └──────────── Priority
│     │    │                │    └──────────────── TTL
│     │    │                └───────────────────── Record type
│     │    └─────────────────────────────────────── Protocol
│     └───────────────────────────────────────────── Service
```

#### 3. **Bootstrap Nodes**

```typescript
interface BootstrapDiscovery {
  method: "bootstrap";
  bootstrapNodes: Array<{
    ledgerId: string;
    endpoint: string;
  }>;
  // Example: [
  //   { ledgerId: "hub-1", endpoint: "https://hub1.onoal.network" },
  //   { ledgerId: "hub-2", endpoint: "https://hub2.onoal.network" }
  // ]
}
```

**Flow:**
```
Ledger A              Bootstrap Node              Ledger B
   │                         │                         │
   │─── Connect ────────────>│                         │
   │                         │                         │
   │<─── Peer List ──────────│                         │
   │                         │                         │
   │─── Connect ──────────────────────────────────────>│
```

#### 4. **Peer-to-Peer Discovery (Gossip)**

```typescript
interface GossipDiscovery {
  method: "gossip";
  // Gossip protocol parameters
  gossipInterval?: number; // milliseconds
  maxPeers?: number; // Max peers to gossip with
}
```

**Gossip Protocol:**
```
Ledger A              Ledger B              Ledger C
   │                      │                      │
   │─── Peer List ───────>│                      │
   │                      │                      │
   │                      │─── Peer List ───────>│
   │                      │                      │
   │<─── Peer List ───────│                      │
```

#### 5. **DHT-based Discovery**

```typescript
interface DHTDiscovery {
  method: "dht";
  // DHT parameters
  k?: number; // Kademlia K parameter
  alpha?: number; // Concurrency parameter
}
```

**DHT Lookup:**
```
Ledger A              DHT Network
   │                      │
   │─── Lookup(OID) ──────>│
   │                      │
   │<─── Peer List ───────│
```

### Discovery Priority

1. **Manual** (hoogste prioriteit)
2. **Bootstrap Nodes**
3. **Registry**
4. **DNS**
5. **Gossip/DHT** (laagste prioriteit)

---

## 🗺️ Mesh Routing

### Routing Algoritmes

#### 1. **OID-based Routing**

**Principe:**
- OID bepaalt routing pad
- Hiërarchische OID structuur → hiërarchische routing
- `oid:onoal:org:a` → route naar `oid:onoal:org:*` peers

**Routing Table:**
```typescript
interface RoutingTable {
  // OID prefix → Peer list
  routes: Map<string, Array<{
    peerId: string;
    ledgerOid: string;
    distance: number; // OID distance metric
    trustLevel: number; // 0.0 - 1.0
  }>>;
  
  // Example:
  // "oid:onoal:org" → [
  //   { peerId: "ledger-b", ledgerOid: "oid:onoal:org:b", distance: 1, trustLevel: 0.9 },
  //   { peerId: "ledger-c", ledgerOid: "oid:onoal:org:c", distance: 1, trustLevel: 0.8 }
  // ]
}
```

**OID Distance Metric:**
```typescript
function calculateOidDistance(oid1: string, oid2: string): number {
  // Split OIDs into components
  const parts1 = oid1.split(":");
  const parts2 = oid2.split(":");
  
  // Find common prefix length
  let commonLength = 0;
  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] === parts2[i]) {
      commonLength++;
    } else {
      break;
    }
  }
  
  // Distance = total parts - common prefix
  return (parts1.length + parts2.length) - (2 * commonLength);
}

// Example:
// calculateOidDistance("oid:onoal:org:a", "oid:onoal:org:b") → 2
// calculateOidDistance("oid:onoal:org:a", "oid:onoal:gov:b") → 4
```

#### 2. **Flooding Routing**

**Principe:**
- Broadcast message naar alle peers
- Elke peer forward naar eigen peers
- TTL (Time-To-Live) voorkomt infinite loops

```typescript
interface FloodingRoute {
  algorithm: "flooding";
  ttl: number; // Max hops
  // Example: ttl: 5
}
```

**Flow:**
```
Ledger A              Ledger B              Ledger C              Ledger D
   │                      │                      │                      │
   │─── Message (TTL=5) ─>│                      │                      │
   │                      │                      │                      │
   │                      │─── Message (TTL=4) ─>│                      │
   │                      │                      │                      │
   │                      │                      │─── Message (TTL=3) ─>│
```

#### 3. **Gossip Protocol**

**Principe:**
- Periodiek peer lists uitwisselen
- Random peer selectie voor gossip
- Eventual consistency

```typescript
interface GossipRoute {
  algorithm: "gossip";
  gossipInterval: number; // milliseconds
  fanout: number; // Number of peers to gossip with
  // Example: { gossipInterval: 5000, fanout: 3 }
}
```

**Gossip Flow:**
```
Time T0:
Ledger A → [B, C, D] (gossip peer list)

Time T1:
Ledger B → [A, E, F] (gossip peer list)

Time T2:
Ledger C → [A, G, H] (gossip peer list)
```

#### 4. **DHT Routing (Kademlia)**

**Principe:**
- Distributed Hash Table voor peer lookup
- OID → Peer mapping
- Logarithmic lookup complexity

```typescript
interface DHTRoute {
  algorithm: "dht";
  k: number; // Kademlia K parameter (bucket size)
  alpha: number; // Concurrency parameter
  // Example: { k: 20, alpha: 3 }
}
```

**DHT Lookup:**
```
Query: Find peer for "oid:onoal:org:b"

Ledger A              DHT Network
   │                      │
   │─── Find(OID) ───────>│
   │                      │
   │<─── Peer Info ───────│
```

#### 5. **Hybrid Routing**

**Principe:**
- Combineer meerdere algoritmes
- OID-based voor directe matches
- Flooding voor broadcast
- DHT voor discovery

```typescript
interface HybridRoute {
  algorithm: "hybrid";
  strategies: {
    oidBased: { enabled: boolean; maxDistance?: number };
    flooding: { enabled: boolean; ttl?: number };
    gossip: { enabled: boolean; interval?: number };
    dht: { enabled: boolean; k?: number };
  };
}
```

### Routing Table Management

```typescript
interface RoutingTableEntry {
  // Target OID prefix
  oidPrefix: string;
  // Example: "oid:onoal:org"
  
  // Next hop peers
  nextHops: Array<{
    peerId: string;
    ledgerOid: string;
    endpoint: string;
    distance: number;
    trustLevel: number;
    lastSeen: number; // Unix timestamp
    latency?: number; // milliseconds
  }>;
  
  // Routing metrics
  metrics: {
    successRate: number; // 0.0 - 1.0
    avgLatency: number; // milliseconds
    lastUpdated: number; // Unix timestamp
  };
}
```

### Path Discovery

**Shortest Path Algorithm:**
```typescript
async function findPath(
  fromOid: string,
  toOid: string,
  routingTable: RoutingTable
): Promise<MeshPath | null> {
  // 1. Check direct connection
  const directPeer = routingTable.findDirectPeer(toOid);
  if (directPeer) {
    return { hops: [directPeer], distance: 1 };
  }
  
  // 2. Check OID-based routing
  const oidPath = routingTable.findOidPath(fromOid, toOid);
  if (oidPath) {
    return oidPath;
  }
  
  // 3. Use DHT lookup
  const dhtPath = await dhtLookup(toOid);
  if (dhtPath) {
    return dhtPath;
  }
  
  // 4. Fallback to flooding
  return await floodDiscovery(toOid);
}
```

---

## 🤝 Trust Management

### Trust Model

#### 1. **Direct Trust**

```typescript
interface DirectTrust {
  type: "direct";
  fromLedgerId: string;
  toLedgerId: string;
  trustLevel: number; // 0.0 - 1.0
  // Example: 0.9 (high trust)
  
  // Trust factors
  factors: {
    verifiedIdentity: boolean;
    successfulInteractions: number;
    failedInteractions: number;
    lastInteraction: number; // Unix timestamp
  };
}
```

#### 2. **Chain Trust**

```typescript
interface ChainTrust {
  type: "chain";
  trustChain: Array<{
    fromLedgerId: string;
    toLedgerId: string;
    trustLevel: number;
  }>;
  
  // Calculated trust
  calculatedTrust: number; // Product of chain trust levels
  // Example: 0.9 * 0.8 * 0.7 = 0.504
}
```

**Trust Chain Example:**
```
Ledger A ──0.9──> Ledger B ──0.8──> Ledger C ──0.7──> Ledger D
         (direct)          (direct)          (direct)

A → D trust = 0.9 * 0.8 * 0.7 = 0.504
```

#### 3. **Web of Trust**

```typescript
interface WebOfTrust {
  type: "web-of-trust";
  trustGraph: Map<string, Map<string, number>>;
  // Ledger ID → { Peer ID → Trust Level }
  
  // Trust calculation
  calculateTrust(from: string, to: string): number {
    // Use graph algorithms (Dijkstra, etc.)
    // Find shortest path with highest trust
  }
}
```

**Web of Trust Example:**
```
        Ledger B (0.8)
       /              \
      /                \
Ledger A (0.9)    Ledger C (0.7)
      \                /
       \              /
        Ledger D (0.6)

A → D: Multiple paths
Path 1: A → B → D = 0.9 * 0.8 = 0.72
Path 2: A → C → D = 0.9 * 0.7 = 0.63
Max trust = 0.72
```

### Trust Anchors

```typescript
interface TrustAnchor {
  ledgerId: string;
  ledgerOid: string;
  publicKey: string;
  trustLevel: number; // Always 1.0 for anchors
  isAnchor: true;
}
```

**Trust Anchor Usage:**
- Start trust chain from anchor
- Verify ledger identity via anchor
- Bootstrap trust in new network

### Trust Verification

```typescript
interface TrustVerification {
  // Verify ledger identity
  verifyIdentity(ledgerId: string, certificate: LedgerCertificate): boolean;
  
  // Verify trust relationship
  verifyTrust(from: string, to: string, minTrust: number): boolean;
  
  // Update trust level
  updateTrust(peerId: string, newTrustLevel: number, reason: string): void;
}
```

---

## 🔄 Cross-Ledger Operaties

### 1. Cross-Ledger Queries

**Query Protocol:**
```typescript
interface CrossLedgerQuery {
  // Query metadata
  queryId: string; // UUID
  fromLedgerId: string;
  toLedgerId: string;
  
  // Query parameters
  filters: {
    subjectOid?: string;
    issuerOid?: string;
    entryType?: string;
    stream?: string;
    limit?: number;
    cursor?: number;
  };
  
  // Routing
  path?: MeshPath; // Pre-computed path
  ttl?: number; // Time-to-live
  
  // Authentication
  auth: {
    requesterOid: string;
    signature: string; // Ed25519 signature
  };
}
```

**Query Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── Query Request ─────────────────────────────────────────>│
   │                                                             │
   │                                                             │─── Execute Query
   │                                                             │
   │<─── Query Response ────────────────────────────────────────│
```

**Query Response:**
```typescript
interface CrossLedgerQueryResponse {
  queryId: string;
  entries: LedgerEntry[];
  hasMore: boolean;
  nextCursor?: number;
  
  // Proof
  proof: {
    merkleRoot: string;
    merkleProof: string[];
    signature: string; // Ledger B signature
  };
}
```

### 2. Cross-Ledger References

**Reference Protocol:**
```typescript
interface CrossLedgerReference {
  // Reference metadata
  refId: string; // UUID
  fromLedgerId: string;
  fromEntryId: string;
  toLedgerId: string;
  toEntryId: string;
  
  // Reference type
  refType: "proof" | "token" | "asset" | "custom";
  
  // Verification
  verified: boolean;
  verificationProof?: {
    merkleRoot: string;
    merkleProof: string[];
    signature: string;
  };
}
```

**Reference Flow:**
```
Entry in Ledger A references Entry in Ledger B

Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── Verify Reference ───────────────────────────────────────>│
   │                                                             │
   │                                                             │─── Check Entry
   │                                                             │
   │<─── Verification Result ───────────────────────────────────│
```

### 3. Proof Verification

**Proof Verification Protocol:**
```typescript
interface ProofVerification {
  // Proof metadata
  proofId: string;
  fromLedgerId: string;
  toLedgerId: string;
  
  // Proof data
  proof: {
    entryId: string;
    merkleRoot: string;
    merkleProof: string[];
    signature: string;
    timestamp: number;
  };
  
  // Verification request
  verify: {
    subjectOid: string;
    issuerOid: string;
    entryType: string;
  };
}
```

**Proof Verification Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── Verify Proof ───────────────────────────────────────────>│
   │                                                             │
   │                                                             │─── Check Entry
   │                                                             │─── Verify Hash
   │                                                             │─── Verify Signature
   │                                                             │
   │<─── Verification Result ────────────────────────────────────│
```

---

## 🔄 Synchronisatie

### Sync Strategieën

#### 1. **Entry Sync**

```typescript
interface EntrySync {
  // Sync metadata
  syncId: string;
  fromLedgerId: string;
  toLedgerId: string;
  
  // Sync parameters
  filters: {
    stream?: string;
    subjectOid?: string;
    issuerOid?: string;
    entryType?: string;
    since?: number; // Unix timestamp
    until?: number; // Unix timestamp
  };
  
  // Sync mode
  mode: "full" | "incremental" | "checkpoint";
}
```

**Entry Sync Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── Sync Request ──────────────────────────────────────────>│
   │                                                             │
   │                                                             │─── Get Entries
   │                                                             │
   │<─── Sync Response (Entries) ───────────────────────────────│
   │                                                             │
   │─── Verify Entries ────────────────────────────────────────>│
   │                                                             │
   │<─── Verification Result ────────────────────────────────────│
```

#### 2. **Checkpoint Sync**

```typescript
interface CheckpointSync {
  // Checkpoint metadata
  checkpointId: string;
  ledgerId: string;
  
  // Checkpoint data
  checkpoint: {
    merkleRoot: string;
    entryCount: number;
    timestamp: number;
    signature: string;
  };
  
  // Sync request
  sync: {
    fromCheckpoint: string; // Previous checkpoint
    toCheckpoint: string; // Target checkpoint
  };
}
```

**Checkpoint Sync Flow:**
```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── Get Checkpoint ─────────────────────────────────────────>│
   │                                                             │
   │<─── Checkpoint Info ───────────────────────────────────────│
   │                                                             │
   │─── Sync Since Checkpoint ──────────────────────────────────>│
   │                                                             │
   │<─── Entries Since Checkpoint ───────────────────────────────│
```

#### 3. **State Sync**

```typescript
interface StateSync {
  // State metadata
  stateId: string;
  ledgerId: string;
  
  // State data
  state: {
    latestEntryId: string;
    latestEntryHash: string;
    entryCount: number;
    merkleRoot: string;
    timestamp: number;
  };
  
  // Sync request
  sync: {
    targetState: string; // Target state hash
  };
}
```

### Conflict Resolution

```typescript
interface ConflictResolution {
  // Conflict detection
  detectConflict(entry1: LedgerEntry, entry2: LedgerEntry): boolean;
  
  // Resolution strategies
  strategies: {
    "last-write-wins": (entry1: LedgerEntry, entry2: LedgerEntry) => LedgerEntry;
    "first-write-wins": (entry1: LedgerEntry, entry2: LedgerEntry) => LedgerEntry;
    "merge": (entry1: LedgerEntry, entry2: LedgerEntry) => LedgerEntry;
    "manual": (entry1: LedgerEntry, entry2: LedgerEntry) => Promise<LedgerEntry>;
  };
}
```

---

## 🔒 Security & Privacy

### Authentication

#### 1. **Ledger Authentication**

```typescript
interface LedgerAuth {
  // Authentication method
  method: "certificate" | "jwt" | "mutual-tls";
  
  // Certificate-based
  certificate?: LedgerCertificate;
  
  // JWT-based
  jwt?: {
    token: string;
    claims: {
      ledgerId: string;
      ledgerOid: string;
      publicKey: string;
      exp: number;
    };
  };
  
  // Mutual TLS
  mtls?: {
    clientCert: string;
    serverCert: string;
  };
}
```

#### 2. **Message Authentication**

```typescript
interface MessageAuth {
  // Message signature
  signature: string; // Ed25519 signature
  
  // Signer info
  signer: {
    ledgerId: string;
    publicKey: string;
  };
  
  // Signature verification
  verify(message: MeshMessage, signature: string, publicKey: string): boolean;
}
```

### Encryption

#### 1. **Transport Encryption**

```typescript
interface TransportEncryption {
  // TLS/HTTPS
  tls: {
    version: "1.2" | "1.3";
    cipherSuites: string[];
  };
  
  // Noise Protocol (P2P)
  noise: {
    handshake: "XX" | "IK" | "IK1" | "N";
    cipher: "ChaChaPoly" | "AESGCM";
  };
}
```

#### 2. **Message Encryption**

```typescript
interface MessageEncryption {
  // Encryption method
  method: "aes-256-gcm" | "chacha20-poly1305";
  
  // Encryption key
  key: {
    derivation: "pbkdf2" | "scrypt" | "hkdf";
    sharedSecret: string; // Derived from ECDH
  };
  
  // Encrypted payload
  encrypted: {
    ciphertext: string;
    nonce: string;
    tag: string; // Authentication tag
  };
}
```

### Privacy

#### 1. **Data Privacy**

- **Private Data**: Blijft in private ledger
- **Public Proofs**: Alleen cryptografische proofs worden gedeeld
- **No Data Aggregation**: Geen centrale data verzameling

#### 2. **Query Privacy**

```typescript
interface QueryPrivacy {
  // Obfuscation
  obfuscateQuery(query: CrossLedgerQuery): CrossLedgerQuery;
  
  // Differential privacy
  addNoise(results: LedgerEntry[]): LedgerEntry[];
  
  // Zero-knowledge proofs
  zkProof: {
    generate(query: CrossLedgerQuery): string;
    verify(proof: string, query: CrossLedgerQuery): boolean;
  };
}
```

#### 3. **Routing Privacy**

- **Onion Routing**: Messages worden encrypted in layers
- **Mix Networks**: Messages worden gemixed voor privacy
- **Dummy Traffic**: Dummy messages voor traffic analysis resistance

---

## 📨 Message Types & Flows

### Message Types

```typescript
type MeshMessageType =
  | "peer_announce"      // Announce presence
  | "peer_discover"      // Discover peers
  | "sync_request"       // Request sync
  | "sync_response"      // Sync response
  | "query_request"      // Cross-ledger query
  | "query_response"     // Query response
  | "proof_verify"       // Verify proof
  | "proof_response"     // Proof verification result
  | "reference_check"    // Check cross-ledger reference
  | "reference_response" // Reference check result
  | "trust_request"      // Request trust establishment
  | "trust_response"     // Trust response
  | "heartbeat"          // Keep-alive
  | "topology_update";   // Topology change
```

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
    ledgerId?: string; // Optional for broadcast
    ledgerOid?: string; // Optional for broadcast
  };
  path?: MeshPath; // Routing path
  
  // Payload
  payload: unknown; // Type-specific payload
  
  // Authentication
  signature: string; // Ed25519 signature
  
  // Encryption (optional)
  encrypted?: {
    ciphertext: string;
    nonce: string;
    tag: string;
  };
  
  // TTL
  ttl?: number; // Time-to-live (hops)
}
```

### Message Flows

#### 1. **Peer Announce Flow**

```
Ledger A                    Mesh Network
   │                             │
   │─── Peer Announce ───────────>│
   │   (ledgerId, ledgerOid,      │
   │    endpoint, capabilities)   │
   │                             │
   │<─── Acknowledge ─────────────│
```

#### 2. **Query Flow**

```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── Query Request ─────────────────────────────────────────>│
   │   (queryId, filters, auth)                                 │
   │                                                             │
   │                                                             │─── Execute Query
   │                                                             │
   │<─── Query Response ────────────────────────────────────────│
   │   (queryId, entries, proof)                                 │
```

#### 3. **Sync Flow**

```
Ledger A                    Mesh Network                    Ledger B
   │                                                             │
   │─── Sync Request ──────────────────────────────────────────>│
   │   (syncId, filters, mode)                                   │
   │                                                             │
   │                                                             │─── Get Entries
   │                                                             │
   │<─── Sync Response ──────────────────────────────────────────│
   │   (syncId, entries, checkpoint)                             │
```

---

## 💾 Database Schema

### Mesh Tables

#### 1. **mesh_peers**

```sql
CREATE TABLE mesh_peers (
  id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL UNIQUE,
  ledger_oid TEXT NOT NULL,
  public_key TEXT NOT NULL,
  endpoint_http TEXT,
  endpoint_ws TEXT,
  endpoint_grpc TEXT,
  capabilities TEXT[], -- Array of capability strings
  trust_level REAL DEFAULT 0.5, -- 0.0 - 1.0
  last_seen BIGINT NOT NULL, -- Unix timestamp
  connected_at BIGINT, -- Unix timestamp
  disconnected_at BIGINT, -- Unix timestamp
  metadata JSONB, -- Additional metadata
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_mesh_peers_ledger_oid ON mesh_peers(ledger_oid);
CREATE INDEX idx_mesh_peers_trust_level ON mesh_peers(trust_level);
CREATE INDEX idx_mesh_peers_last_seen ON mesh_peers(last_seen);
```

#### 2. **mesh_connections**

```sql
CREATE TABLE mesh_connections (
  id TEXT PRIMARY KEY,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT NOT NULL,
  connection_type TEXT NOT NULL, -- 'direct', 'routed', 'trusted'
  trust_level REAL DEFAULT 0.5,
  latency_ms INTEGER, -- milliseconds
  last_message_at BIGINT, -- Unix timestamp
  message_count BIGINT DEFAULT 0,
  error_count BIGINT DEFAULT 0,
  status TEXT NOT NULL, -- 'connected', 'disconnected', 'error'
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(from_ledger_id, to_ledger_id)
);

CREATE INDEX idx_mesh_connections_from ON mesh_connections(from_ledger_id);
CREATE INDEX idx_mesh_connections_to ON mesh_connections(to_ledger_id);
CREATE INDEX idx_mesh_connections_status ON mesh_connections(status);
```

#### 3. **mesh_routing**

```sql
CREATE TABLE mesh_routing (
  id TEXT PRIMARY KEY,
  oid_prefix TEXT NOT NULL, -- OID prefix for routing
  target_ledger_id TEXT NOT NULL,
  next_hop_ledger_id TEXT NOT NULL,
  distance INTEGER NOT NULL, -- OID distance
  trust_level REAL DEFAULT 0.5,
  success_rate REAL DEFAULT 0.0, -- 0.0 - 1.0
  avg_latency_ms INTEGER,
  last_used_at BIGINT, -- Unix timestamp
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_mesh_routing_oid_prefix ON mesh_routing(oid_prefix);
CREATE INDEX idx_mesh_routing_target ON mesh_routing(target_ledger_id);
CREATE INDEX idx_mesh_routing_next_hop ON mesh_routing(next_hop_ledger_id);
```

#### 4. **mesh_trust**

```sql
CREATE TABLE mesh_trust (
  id TEXT PRIMARY KEY,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT NOT NULL,
  trust_type TEXT NOT NULL, -- 'direct', 'chain', 'web-of-trust'
  trust_level REAL NOT NULL, -- 0.0 - 1.0
  trust_chain TEXT[], -- Array of ledger IDs in trust chain
  factors JSONB, -- Trust factors (interactions, etc.)
  verified BOOLEAN DEFAULT FALSE,
  expires_at BIGINT, -- Unix timestamp (optional)
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(from_ledger_id, to_ledger_id)
);

CREATE INDEX idx_mesh_trust_from ON mesh_trust(from_ledger_id);
CREATE INDEX idx_mesh_trust_to ON mesh_trust(to_ledger_id);
CREATE INDEX idx_mesh_trust_level ON mesh_trust(trust_level);
```

#### 5. **mesh_messages**

```sql
CREATE TABLE mesh_messages (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE, -- UUID from message
  message_type TEXT NOT NULL,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT, -- NULL for broadcast
  payload JSONB NOT NULL,
  signature TEXT NOT NULL,
  ttl INTEGER,
  status TEXT NOT NULL, -- 'pending', 'sent', 'delivered', 'failed'
  retry_count INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL,
  sent_at BIGINT,
  delivered_at BIGINT,
  expires_at BIGINT
);

CREATE INDEX idx_mesh_messages_from ON mesh_messages(from_ledger_id);
CREATE INDEX idx_mesh_messages_to ON mesh_messages(to_ledger_id);
CREATE INDEX idx_mesh_messages_status ON mesh_messages(status);
CREATE INDEX idx_mesh_messages_type ON mesh_messages(message_type);
```

#### 6. **mesh_sync_state**

```sql
CREATE TABLE mesh_sync_state (
  id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL,
  stream TEXT, -- Optional stream filter
  last_synced_entry_id TEXT,
  last_synced_timestamp BIGINT,
  last_synced_hash TEXT,
  checkpoint_merkle_root TEXT,
  checkpoint_entry_count BIGINT,
  sync_status TEXT NOT NULL, -- 'synced', 'syncing', 'error'
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(ledger_id, stream)
);

CREATE INDEX idx_mesh_sync_state_ledger ON mesh_sync_state(ledger_id);
CREATE INDEX idx_mesh_sync_state_status ON mesh_sync_state(sync_status);
```

---

## 🛠️ Implementatie Details

### Service Architecture

```typescript
// Mesh Network Service
class MeshNetworkService {
  // Join mesh network
  async join(options: MeshJoinOptions): Promise<void>;
  
  // Leave mesh network
  async leave(): Promise<void>;
  
  // Get connected peers
  async getPeers(): Promise<MeshPeer[]>;
  
  // Connect to peer
  async connectPeer(peer: MeshPeer): Promise<void>;
  
  // Disconnect from peer
  async disconnectPeer(peerId: string): Promise<void>;
  
  // Broadcast message
  async broadcast(message: MeshMessage): Promise<void>;
}

// Mesh Routing Service
class MeshRoutingService {
  // Route message
  async route(message: MeshMessage): Promise<MeshResponse>;
  
  // Find path
  async findPath(fromOid: string, toOid: string): Promise<MeshPath | null>;
  
  // Update routing table
  async updateRoutingTable(updates: RoutingTableUpdate[]): Promise<void>;
  
  // Get routing table
  async getRoutingTable(): Promise<RoutingTable>;
}

// Mesh Discovery Service
class MeshDiscoveryService {
  // Start discovery
  async start(): Promise<void>;
  
  // Stop discovery
  async stop(): Promise<void>;
  
  // Discover peers
  async discoverPeers(filters?: DiscoveryFilters): Promise<MeshPeer[]>;
  
  // Register this ledger
  async register(capabilities: string[]): Promise<void>;
}

// Mesh Trust Service
class MeshTrustService {
  // Establish trust
  async establishTrust(
    peerId: string,
    trustLevel: number,
    verifiers?: string[]
  ): Promise<TrustRelationship>;
  
  // Verify trust chain
  async verifyTrustChain(
    fromLedgerId: string,
    toLedgerId: string
  ): Promise<boolean>;
  
  // Get trust level
  async getTrustLevel(from: string, to: string): Promise<number>;
  
  // Update trust level
  async updateTrust(peerId: string, newTrustLevel: number): Promise<void>;
}
```

### Module Structure

```typescript
export function meshProtocolModule(
  options: MeshProtocolModuleOptions
): OnoalLedgerModule {
  return createCustomModule({
    id: "mesh-protocol",
    label: "Onoal Network Mesh Protocol",
    version: "1.0.0",
    
    // Services
    services: {
      meshNetworkService: MeshNetworkService,
      meshRoutingService: MeshRoutingService,
      meshDiscoveryService: MeshDiscoveryService,
      meshTrustService: MeshTrustService,
    },
    
    // Routes
    routes: [
      // Peer management
      { method: "GET", path: "/mesh/peers", handler: getPeersHandler },
      { method: "POST", path: "/mesh/connect", handler: connectPeerHandler },
      { method: "POST", path: "/mesh/disconnect", handler: disconnectPeerHandler },
      
      // Mesh operations
      { method: "GET", path: "/mesh/topology", handler: getTopologyHandler },
      { method: "POST", path: "/mesh/query", handler: crossLedgerQueryHandler },
      { method: "POST", path: "/mesh/sync", handler: syncHandler },
      
      // Trust management
      { method: "GET", path: "/mesh/trust", handler: getTrustHandler },
      { method: "POST", path: "/mesh/trust", handler: establishTrustHandler },
    ],
    
    // Database schema
    drizzleSchema: {
      meshPeers: meshPeersTable,
      meshConnections: meshConnectionsTable,
      meshRouting: meshRoutingTable,
      meshTrust: meshTrustTable,
      meshMessages: meshMessagesTable,
      meshSyncState: meshSyncStateTable,
    },
    
    // Lifecycle
    lifecycle: {
      load: async (ledger) => {
        // Initialize services
      },
      start: async (ledger) => {
        // Join mesh network
      },
      stop: async (ledger) => {
        // Leave mesh network
      },
    },
    
    // Hooks
    hooks: {
      afterAppend: async (entry, ledger) => {
        // Handle cross-ledger references
        // Auto-sync if enabled
      },
    },
  });
}
```

---

## 📚 Use Cases

### 1. **Cross-Organization Proof Verification**

**Scenario:**
- Organization A issues proof for employee
- Organization B needs to verify proof
- Both organizations have private ledgers

**Flow:**
```
Org A Ledger              Mesh Network              Org B Ledger
   │                                                      │
   │─── Issue Proof ────────────────────────────────────>│
   │                                                      │
   │                                                      │─── Verify Proof
   │                                                      │
   │<─── Verification Result ────────────────────────────│
```

### 2. **Multi-Ledger Token Transfer**

**Scenario:**
- Token exists in Ledger A
- Transfer to account in Ledger B
- Cross-ledger atomic transfer

**Flow:**
```
Ledger A              Mesh Network              Ledger B
   │                                              │
   │─── Lock Token ────────────────────────────>│
   │                                              │
   │                                              │─── Reserve Account
   │                                              │
   │<─── Reserved ───────────────────────────────│
   │                                              │
   │─── Transfer Token ────────────────────────>│
   │                                              │
   │                                              │─── Credit Account
   │                                              │
   │<─── Confirmed ──────────────────────────────│
```

### 3. **Distributed Asset Registry**

**Scenario:**
- Multiple organizations manage assets
- Assets can be referenced across ledgers
- Central registry for discovery

**Flow:**
```
Org A Ledger          Registry          Org B Ledger          Org C Ledger
   │                    │                    │                    │
   │─── Register Asset ─>│                    │                    │
   │                    │                    │                    │
   │                    │<─── Query Asset ───│                    │
   │                    │                    │                    │
   │                    │─── Asset Info ────>│                    │
   │                    │                    │                    │
   │                    │                    │─── Verify Asset ──>│
```

---

## 🎯 Conclusie

Het **Onoal Mesh Network** is een volledig gedecentraliseerd, privacy-preserving netwerk van soevereine private ledgers die peer-to-peer verbinden zonder centrale autoriteit. Het combineert:

- ✅ **Soevereiniteit**: Elke ledger controleert eigen data
- ✅ **Privacy**: Data blijft privé, alleen proofs worden gedeeld
- ✅ **Integriteit**: Cryptografische verificatie van alle operaties
- ✅ **Schaalbaarheid**: Mesh topologie ondersteunt groei
- ✅ **Flexibiliteit**: Meerdere routing en discovery methoden
- ✅ **Trust**: Flexibel trust management systeem

Het protocol is ontworpen om de visie van "Cryptografisch Netwerk van Soevereine Ledgers" te realiseren, waarbij privacy, integriteit en soevereiniteit worden gewaarborgd in een gedecentraliseerd netwerk.

