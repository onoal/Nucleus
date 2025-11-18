# Onoal Network Mesh Protocol Plugin - Analyse

## 📋 Overzicht

Deze analyse beschrijft waarom een **dedicated Mesh Protocol Plugin** de beste aanpak is voor Interoperability in plaats van een generieke "Interoperability Plugin". Het Onoal Network Mesh Protocol is een specifiek protocol voor het verbinden van private ledgers in een cryptografisch netwerk.

## 🎯 Waarom een Dedicated Mesh Protocol Plugin?

### 1. **Specifiek Protocol vs Generieke Interoperability**

**Probleem met generieke Interoperability Plugin:**

- Te abstract en generiek
- Geen specifieke protocol definitie
- Moeilijk te standaardiseren
- Geen duidelijk mesh concept

**Voordeel van Mesh Protocol Plugin:**

- ✅ **Specifiek Protocol**: Duidelijk gedefinieerd mesh protocol
- ✅ **Standardisatie**: Eén protocol voor alle ledgers
- ✅ **Mesh Topology**: Native mesh networking concepten
- ✅ **Onoal-Specific**: Gebouwd voor Onoal's visie van "Cryptografisch Netwerk van Soevereine Ledgers"

### 2. **Alignment met Onoal Visie**

Uit `ONOAL_LEDGER_FRAMEWORK_KERNCONCEPT.md`:

> **Het Onoal Ledger Framework is een cryptografisch netwerk van private ledgers** dat soevereiniteit waarborgt voor privacy en data ownership, terwijl het cryptografische integriteit biedt.

**Mesh Protocol Plugin ondersteunt dit door:**

- Mesh topology (niet hiërarchisch)
- Soevereine ledgers (geen centrale autoriteit)
- Cryptografische verificatie tussen nodes
- Privacy-preserving (data blijft privé)

### 3. **Hybrid Ledger Mesh Concept**

Uit `ONOAL_HYBRID_LEDGER_MESH_ANALYSE.md`:

Het concept combineert:

- **Private Ledgers**: Privacy en soevereiniteit
- **Public Ledger Mesh**: Decentralisatie en trustless verificatie

**Mesh Protocol Plugin implementeert:**

- Private ledger mesh (directe peer-to-peer connecties)
- Optionele public mesh anchoring (voor verificatie)
- Hybrid approach (best of both worlds)

## 🌐 Onoal Network Mesh Protocol

### Protocol Definitie

Het **Onoal Network Mesh Protocol** is een peer-to-peer protocol voor het verbinden van private ledgers in een mesh network.

#### Core Principes

1. **Mesh Topology**: Geen centrale hub, ledgers verbinden direct met elkaar
2. **OID-based Routing**: Entiteiten geïdentificeerd via OID
3. **Cryptographic Verification**: Alle communicatie geverifieerd
4. **Privacy-Preserving**: Data blijft privé, alleen proofs worden gedeeld
5. **Soevereiniteit**: Elke ledger controleert eigen data en connecties

#### Protocol Layers

```
┌─────────────────────────────────────────────────────────┐
│              Onoal Network Mesh Protocol                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 4: Application Layer                              │
│  - Cross-ledger queries                                 │
│  - Cross-ledger references                              │
│  - Proof verification                                   │
│                                                          │
│  Layer 3: Mesh Routing Layer                            │
│  - OID-based routing                                    │
│  - Mesh topology management                             │
│  - Path discovery                                       │
│                                                          │
│  Layer 2: Sync Layer                                    │
│  - Entry synchronization                                │
│  - Conflict resolution                                  │
│  - State synchronization                                │
│                                                          │
│  Layer 1: Transport Layer                               │
│  - Peer-to-peer connections                             │
│  - Authentication & authorization                       │
│  - Message encryption                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Mesh Topology

```
        ┌─────────────┐
        │  Ledger A   │
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

- Geen centrale hub
- Directe peer-to-peer connecties
- Multiple paths tussen nodes
- Self-organizing network

## 🔧 Mesh Protocol Plugin Architectuur

### Plugin Structuur

```typescript
export interface MeshProtocolPluginOptions {
  /**
   * Mesh network configuration
   */
  mesh: {
    /**
     * This ledger's identity in the mesh
     */
    ledgerId: string; // Unique identifier
    ledgerOid: string; // OID for this ledger

    /**
     * Mesh discovery method
     */
    discovery: {
      method: "dns" | "registry" | "peer-to-peer" | "manual";
      registryUrl?: string;
      bootstrapNodes?: string[]; // Initial peers
    };

    /**
     * Mesh connection settings
     */
    connections: {
      maxConnections?: number; // Max peers
      minConnections?: number; // Min peers for health
      connectionTimeout?: number;
      keepAliveInterval?: number;
    };

    /**
     * Mesh routing
     */
    routing: {
      algorithm: "flooding" | "gossip" | "dht" | "hybrid";
      maxHops?: number; // Max hops for routing
      ttl?: number; // Time-to-live for messages
    };
  };

  /**
   * Trust management
   */
  trust: {
    /**
     * Minimum trust level for connections
     */
    minTrustLevel?: number; // 0.0 - 1.0

    /**
     * Trust verification method
     */
    verification: "direct" | "chain" | "web-of-trust";

    /**
     * Trust anchors (trusted ledgers)
     */
    anchors?: string[]; // Ledger IDs of trust anchors
  };

  /**
   * Sync configuration (integrated with sync plugin)
   */
  sync?: {
    enabled: boolean;
    autoSync: boolean;
    syncInterval?: number;
    filters?: SyncFilters;
  };

  /**
   * Public mesh anchoring (optional)
   */
  publicMesh?: {
    enabled: boolean;
    endpoint?: string;
    anchorInterval?: number; // How often to anchor checkpoints
  };
}
```

### Core Services

#### 1. Mesh Network Service

```typescript
class MeshNetworkService {
  /**
   * Join mesh network
   */
  async join(options: {
    bootstrapNodes?: string[];
    discoveryMethod?: string;
  }): Promise<void>;

  /**
   * Leave mesh network
   */
  async leave(): Promise<void>;

  /**
   * Get mesh topology
   */
  async getTopology(): Promise<MeshTopology>;

  /**
   * Get connected peers
   */
  async getPeers(): Promise<MeshPeer[]>;

  /**
   * Connect to peer
   */
  async connectPeer(peer: MeshPeer): Promise<void>;

  /**
   * Disconnect from peer
   */
  async disconnectPeer(peerId: string): Promise<void>;

  /**
   * Broadcast message to mesh
   */
  async broadcast(message: MeshMessage): Promise<void>;

  /**
   * Route message to specific ledger
   */
  async route(
    targetLedgerId: string,
    message: MeshMessage
  ): Promise<MeshResponse>;
}
```

#### 2. Mesh Routing Service

```typescript
class MeshRoutingService {
  /**
   * Find path to target ledger
   */
  async findPath(
    targetLedgerId: string,
    options?: {
      maxHops?: number;
      avoidLedgers?: string[];
    }
  ): Promise<MeshPath | null>;

  /**
   * Route message via mesh
   */
  async routeMessage(
    targetLedgerId: string,
    message: MeshMessage
  ): Promise<MeshResponse>;

  /**
   * Update routing table
   */
  async updateRoutingTable(updates: RoutingTableUpdate[]): Promise<void>;

  /**
   * Get routing table
   */
  async getRoutingTable(): Promise<RoutingTable>;
}
```

#### 3. Mesh Discovery Service

```typescript
class MeshDiscoveryService {
  /**
   * Discover ledgers in mesh
   */
  async discover(options: {
    filters?: {
      capabilities?: string[];
      region?: string;
      trustLevel?: number;
    };
  }): Promise<MeshPeer[]>;

  /**
   * Register this ledger in mesh
   */
  async register(capabilities: string[]): Promise<void>;

  /**
   * Announce presence to mesh
   */
  async announce(): Promise<void>;

  /**
   * Handle peer announcements
   */
  async handleAnnouncement(announcement: PeerAnnouncement): Promise<void>;
}
```

#### 4. Mesh Trust Service

```typescript
class MeshTrustService {
  /**
   * Establish trust with peer
   */
  async establishTrust(
    peerId: string,
    trustLevel: number,
    verifiers?: string[]
  ): Promise<TrustRelationship>;

  /**
   * Verify trust chain
   */
  async verifyTrustChain(
    sourceLedgerId: string,
    targetLedgerId: string
  ): Promise<boolean>;

  /**
   * Get trust level
   */
  async getTrustLevel(from: string, to: string): Promise<number>;

  /**
   * Update trust level
   */
  async updateTrust(peerId: string, newTrustLevel: number): Promise<void>;
}
```

### Protocol Messages

#### Message Types

```typescript
type MeshMessageType =
  | "peer_announce" // Announce presence
  | "peer_discover" // Discover peers
  | "sync_request" // Request sync
  | "sync_response" // Sync response
  | "query_request" // Cross-ledger query
  | "query_response" // Query response
  | "proof_verify" // Verify proof
  | "proof_response" // Proof verification result
  | "reference_check" // Check cross-ledger reference
  | "reference_response" // Reference check result
  | "trust_request" // Request trust establishment
  | "trust_response" // Trust response
  | "heartbeat" // Keep-alive
  | "topology_update"; // Topology change
```

#### Message Format

```typescript
interface MeshMessage {
  id: string; // Unique message ID
  type: MeshMessageType;
  from: string; // Source ledger ID
  to?: string; // Target ledger ID (optional for broadcast)
  timestamp: number;
  payload: unknown;
  signature: string; // Ed25519 signature
  hops: number; // Number of hops (for routing)
  ttl: number; // Time-to-live
  nonce: string; // Anti-replay
}
```

### Database Schema

```sql
-- Mesh peers (connected ledgers)
CREATE TABLE mesh_peers (
  id TEXT PRIMARY KEY, -- Ledger ID
  ledger_oid TEXT NOT NULL,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  public_key TEXT NOT NULL,
  capabilities JSON NOT NULL,
  trust_level REAL NOT NULL DEFAULT 0.5, -- 0.0 - 1.0
  connection_status TEXT NOT NULL, -- 'connected' | 'disconnected' | 'connecting'
  last_seen INTEGER,
  first_seen INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_mesh_peers_status ON mesh_peers(connection_status);
CREATE INDEX idx_mesh_peers_trust ON mesh_peers(trust_level);

-- Mesh connections (edges in topology)
CREATE TABLE mesh_connections (
  id TEXT PRIMARY KEY,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT NOT NULL,
  connection_type TEXT NOT NULL, -- 'direct' | 'routed'
  latency_ms INTEGER,
  last_message INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (from_ledger_id) REFERENCES mesh_peers(id),
  FOREIGN KEY (to_ledger_id) REFERENCES mesh_peers(id)
);

CREATE INDEX idx_mesh_connections_from ON mesh_connections(from_ledger_id);
CREATE INDEX idx_mesh_connections_to ON mesh_connections(to_ledger_id);

-- Mesh routing table
CREATE TABLE mesh_routing (
  id TEXT PRIMARY KEY,
  target_ledger_id TEXT NOT NULL,
  next_hop_ledger_id TEXT NOT NULL,
  path_length INTEGER NOT NULL,
  path_cost REAL NOT NULL, -- Based on trust, latency, etc.
  last_updated INTEGER NOT NULL,
  FOREIGN KEY (target_ledger_id) REFERENCES mesh_peers(id),
  FOREIGN KEY (next_hop_ledger_id) REFERENCES mesh_peers(id)
);

CREATE INDEX idx_mesh_routing_target ON mesh_routing(target_ledger_id);

-- Mesh trust relationships
CREATE TABLE mesh_trust (
  id TEXT PRIMARY KEY,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT NOT NULL,
  trust_level REAL NOT NULL, -- 0.0 - 1.0
  trust_type TEXT NOT NULL, -- 'direct' | 'derived' | 'anchor'
  verified_by JSON, -- Array of verifier ledger IDs
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (from_ledger_id) REFERENCES mesh_peers(id),
  FOREIGN KEY (to_ledger_id) REFERENCES mesh_peers(id)
);

CREATE INDEX idx_mesh_trust_from ON mesh_trust(from_ledger_id);
CREATE INDEX idx_mesh_trust_to ON mesh_trust(to_ledger_id);

-- Mesh message cache (for deduplication)
CREATE TABLE mesh_messages (
  id TEXT PRIMARY KEY, -- Message ID
  message_type TEXT NOT NULL,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT,
  payload_hash TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_mesh_messages_expires ON mesh_messages(expires_at);
```

### Plugin Implementation

```typescript
export function meshProtocolPlugin(
  options: MeshProtocolPluginOptions
): OnoalLedgerPlugin {
  const meshNetwork = new MeshNetworkService(options.mesh);
  const meshRouting = new MeshRoutingService(meshNetwork);
  const meshDiscovery = new MeshDiscoveryService(options.mesh.discovery);
  const meshTrust = new MeshTrustService(options.trust);

  // Optional: Integrate with sync plugin
  const syncService = options.sync?.enabled
    ? new SyncService(options.sync)
    : null;

  // Optional: Integrate with public mesh
  const publicMesh = options.publicMesh?.enabled
    ? new PublicMeshClient(options.publicMesh)
    : null;

  return {
    id: "mesh-protocol",
    version: "1.0.0",

    // Lifecycle hooks
    load: async (ledger) => {
      // Initialize mesh services
      await meshNetwork.initialize(ledger);
      await meshDiscovery.initialize(ledger);
      await meshTrust.initialize(ledger);
    },

    start: async (ledger) => {
      // Join mesh network
      await meshNetwork.join({
        bootstrapNodes: options.mesh.discovery.bootstrapNodes,
      });

      // Start discovery
      await meshDiscovery.start();

      // Start sync if enabled
      if (syncService) {
        await syncService.start();
      }
    },

    stop: async (ledger) => {
      // Leave mesh network
      await meshNetwork.leave();
      await meshDiscovery.stop();
    },

    hooks: {
      afterAppend: async (entry, ledger) => {
        // Check for cross-ledger references
        const refs = extractCrossLedgerRefs(entry);
        if (refs.length > 0) {
          // Verify references via mesh
          await verifyCrossLedgerRefsViaMesh(refs, meshNetwork, meshTrust);
        }

        // Auto-sync if enabled
        if (syncService && options.sync?.autoSync) {
          await syncService.syncToMesh(entry, meshNetwork);
        }

        // Anchor to public mesh if enabled
        if (publicMesh && shouldAnchor(entry)) {
          await publicMesh.anchor(entry);
        }
      },

      beforeQuery: async (filters, ledger) => {
        // Optionally extend query to mesh
        if (filters._meshQuery) {
          const meshResults = await queryMesh(
            filters,
            meshNetwork,
            meshRouting,
            meshTrust
          );
          return {
            shortCircuit: {
              entries: meshResults.aggregated,
              nextCursor: null,
              hasMore: false,
            },
          };
        }
      },
    },

    // Add mesh-specific routes
    routes: [
      {
        method: "GET",
        path: "/mesh/peers",
        handler: async (req, ledger) => {
          const peers = await meshNetwork.getPeers();
          return Response.json({ peers });
        },
      },
      {
        method: "GET",
        path: "/mesh/topology",
        handler: async (req, ledger) => {
          const topology = await meshNetwork.getTopology();
          return Response.json({ topology });
        },
      },
      {
        method: "POST",
        path: "/mesh/connect",
        handler: async (req, ledger) => {
          const body = await req.json();
          await meshNetwork.connectPeer(body.peer);
          return Response.json({ success: true });
        },
      },
      {
        method: "POST",
        path: "/mesh/query",
        handler: async (req, ledger) => {
          const body = await req.json();
          const results = await queryMesh(
            body.filters,
            meshNetwork,
            meshRouting,
            meshTrust
          );
          return Response.json({ results });
        },
      },
    ],
  };
}
```

## 🔄 Integratie met Sync Plugin

### Synergy

De **Mesh Protocol Plugin** en **Sync Plugin** werken samen:

1. **Mesh Protocol Plugin**: Beheert network topology en routing
2. **Sync Plugin**: Synchroniseert entries tussen peers
3. **Combined**: Sync gebeurt via mesh routing, alleen met trusted peers

```typescript
// Gebruik beide plugins samen
const ledger = await createLedger({
  // ...
  plugins: [
    meshProtocolPlugin({
      mesh: {
        ledgerId: "my-ledger",
        ledgerOid: "oid:onoal:org:myorg",
        discovery: { method: "registry", registryUrl: "..." },
        connections: { maxConnections: 10, minConnections: 3 },
      },
      trust: {
        minTrustLevel: 0.7,
        verification: "web-of-trust",
      },
      sync: {
        enabled: true,
        autoSync: true,
        syncInterval: 60000, // 1 minute
      },
    }),
    syncPlugin({
      // Sync plugin gebruikt mesh voor routing
      meshAware: true,
      filterByTrust: true,
      minTrustLevel: 0.7,
    }),
  ],
});
```

## 🆚 Mesh Protocol vs Generieke Interoperability

| Aspect              | Generieke Interoperability  | Mesh Protocol Plugin                 |
| ------------------- | --------------------------- | ------------------------------------ |
| **Protocol**        | Geen specifiek protocol     | Gedefinieerd mesh protocol           |
| **Topology**        | Ad-hoc, onduidelijk         | Mesh topology (peer-to-peer)         |
| **Routing**         | Basis routing               | Mesh routing (flooding, gossip, DHT) |
| **Discovery**       | Basis discovery             | Mesh discovery (peer-to-peer)        |
| **Standardisatie**  | Moeilijk te standaardiseren | Eén protocol voor alle ledgers       |
| **Onoal Alignment** | Generiek concept            | Specifiek voor Onoal visie           |
| **Extensibility**   | Moeilijk uit te breiden     | Protocol kan uitgebreid worden       |
| **Documentation**   | Abstract                    | Concrete protocol specificatie       |

## 🎯 Voordelen van Mesh Protocol Plugin

### 1. **Standardisatie**

- ✅ Eén protocol voor alle ledgers
- ✅ Interoperabiliteit tussen verschillende implementaties
- ✅ Protocol specificatie kan gepubliceerd worden
- ✅ Makkelijker te documenteren en te leren

### 2. **Mesh-Specific Features**

- ✅ Native mesh topology support
- ✅ Mesh routing algorithms (flooding, gossip, DHT)
- ✅ Peer-to-peer discovery
- ✅ Self-organizing network

### 3. **Onoal-Specific**

- ✅ Gebouwd voor Onoal's visie
- ✅ Ondersteunt "Cryptografisch Netwerk van Soevereine Ledgers"
- ✅ Privacy-preserving mesh
- ✅ OID-based routing

### 4. **Extensibility**

- ✅ Protocol kan uitgebreid worden met nieuwe message types
- ✅ Routing algorithms kunnen worden toegevoegd
- ✅ Mesh features kunnen worden toegevoegd zonder breaking changes

### 5. **Integration**

- ✅ Werkt naadloos met Sync Plugin
- ✅ Ondersteunt public mesh anchoring
- ✅ Cross-ledger queries via mesh
- ✅ Trust management via mesh

## 📊 Implementatie Stappenplan

### Phase 1: Core Mesh Protocol

1. ✅ Mesh message format
2. ✅ Peer-to-peer connections
3. ✅ Basic mesh routing (flooding)
4. ✅ Peer discovery (manual first)
5. ✅ Database schema
6. ✅ Plugin structure

### Phase 2: Mesh Routing

1. ✅ Advanced routing (gossip, DHT)
2. ✅ Path discovery
3. ✅ Routing table management
4. ✅ Message routing
5. ✅ Topology updates

### Phase 3: Mesh Discovery

1. ✅ Peer-to-peer discovery
2. ✅ Registry-based discovery
3. ✅ DNS-based discovery
4. ✅ Bootstrap nodes
5. ✅ Peer announcements

### Phase 4: Trust & Security

1. ✅ Trust relationships
2. ✅ Trust chain verification
3. ✅ Web-of-trust
4. ✅ Message authentication
5. ✅ Encryption

### Phase 5: Integration

1. ✅ Sync Plugin integratie
2. ✅ Public mesh anchoring
3. ✅ Cross-ledger queries
4. ✅ Cross-ledger references
5. ✅ End-to-end testing

## 🔒 Security Considerations

### Mesh-Specific Security

- **Peer Authentication**: Alle peers worden geverifieerd met public keys
- **Message Signing**: Alle messages zijn cryptographically signed
- **Trust Verification**: Trust relationships worden geverifieerd
- **Routing Security**: Routing updates worden geverifieerd
- **DDoS Protection**: Rate limiting en message deduplication

### Privacy

- **Selective Disclosure**: Alleen relevante data wordt gedeeld
- **OID-based Routing**: Entiteiten geïdentificeerd via OID (niet IP)
- **Encrypted Messages**: Optionele end-to-end encryptie
- **No Data Leakage**: Mesh routing lekt geen data

## 📈 Performance Considerations

### Mesh Optimization

- **Connection Pooling**: Reuse connections naar peers
- **Message Caching**: Cache messages voor deduplication
- **Routing Caching**: Cache routing table
- **Parallel Routing**: Route naar meerdere peers parallel
- **Lazy Discovery**: Discover peers on-demand

## 🎯 Conclusie

Een **dedicated Mesh Protocol Plugin** is de beste aanpak voor Interoperability omdat:

1. ✅ **Specifiek Protocol**: Duidelijk gedefinieerd mesh protocol
2. ✅ **Onoal Alignment**: Gebouwd voor Onoal's visie
3. ✅ **Standardisatie**: Eén protocol voor alle ledgers
4. ✅ **Mesh Features**: Native mesh topology en routing
5. ✅ **Extensibility**: Protocol kan uitgebreid worden
6. ✅ **Integration**: Werkt naadloos met Sync Plugin

**Aanbeveling**: Implementeer **Mesh Protocol Plugin** in plaats van generieke Interoperability Plugin.
