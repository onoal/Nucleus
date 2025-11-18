# Ledger Sync & Interoperability Analysis

## 📋 Overzicht

Deze analyse beschrijft hoe we twee krachtige plugins kunnen bouwen voor het Ledger Framework:

1. **Sync Plugin** - Synchroniseer entries tussen meerdere ledgers
2. **Interoperability Plugin** - Bind ledgers aan elkaar om een netwerk te vormen

## 🔍 Huidige Framework Architectuur

### Core Componenten

1. **Hash Chain**: Elke entry heeft een `hash` en `prev_hash` voor immutable linking
2. **Signatures**: Ed25519 signatures op alle entries
3. **Database Schema**:
   - `ledger_entries` met `id`, `hash`, `prev_hash`, `signature`, `timestamp`
   - OID columns voor snelle queries (`issuer_oid`, `subject_oid`, `entry_type`)
4. **Plugin System**: Hooks voor `beforeAppend`, `afterAppend`, `beforeQuery`, `afterQuery`, etc.
5. **Verification**: `verifyChain()` en `verifyEntry()` voor integrity checks

### Beschikbare Hooks

```typescript
interface OnoalLedgerPlugin {
  hooks?: {
    beforeAppend?: (entry, ledger) => Promise<void>;
    afterAppend?: (entry, ledger) => Promise<void>;
    beforeQuery?: (filters, ledger) => Promise<...>;
    afterQuery?: (result, filters, ledger) => Promise<...>;
    beforeGet?: (id, ledger) => Promise<LedgerEntry | void>;
    afterGet?: (entry, id, ledger) => Promise<LedgerEntry | null>;
    beforeVerifyChain?: (startId, limit, ledger) => Promise<void>;
    afterVerifyChain?: (result, ledger) => Promise<ChainVerificationResult>;
  };
}
```

## 🔄 Sync Plugin

### Doel

Synchroniseer entries tussen meerdere ledgers zodat:

- Entries van Ledger A beschikbaar zijn in Ledger B
- Conflict resolution voor gelijktijdige wijzigingen
- Incremental sync (alleen nieuwe entries)
- Bidirectionele sync mogelijk

### Architectuur

#### 1. Sync State Tracking

**Database Schema Extensie:**

```typescript
// Nieuwe tabel voor sync state
const syncStateTable = {
  id: text("id").primaryKey(), // "ledger-id:entry-id"
  remoteLedgerId: text("remote_ledger_id").notNull(),
  entryId: text("entry_id").notNull(),
  entryHash: text("entry_hash").notNull(),
  syncDirection: text("sync_direction").notNull(), // "inbound" | "outbound"
  syncStatus: text("sync_status").notNull(), // "pending" | "synced" | "conflict" | "failed"
  lastSyncAttempt: integer("last_sync_attempt"),
  syncError: text("sync_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
};

// Indexes
- idx_sync_remote_ledger: (remoteLedgerId, syncStatus)
- idx_sync_entry: (entryId, entryHash)
- idx_sync_pending: (syncStatus, lastSyncAttempt)
```

#### 2. Sync Service

```typescript
class SyncService {
  /**
   * Sync entries from remote ledger
   */
  async pullEntries(
    remoteLedger: RemoteLedgerConnection,
    options: {
      since?: number; // Timestamp
      limit?: number;
      stream?: LedgerStream;
    }
  ): Promise<SyncResult>;

  /**
   * Push entries to remote ledger
   */
  async pushEntries(
    remoteLedger: RemoteLedgerConnection,
    entries: LedgerEntry[],
    options?: { verify?: boolean }
  ): Promise<SyncResult>;

  /**
   * Bidirectional sync
   */
  async syncBidirectional(
    remoteLedger: RemoteLedgerConnection,
    options?: SyncOptions
  ): Promise<BidirectionalSyncResult>;
}
```

#### 3. Remote Ledger Connection

```typescript
interface RemoteLedgerConnection {
  id: string; // Unique ledger identifier
  name: string;
  endpoint: string; // API endpoint
  publicKey: string; // Ed25519 public key for verification
  authToken?: string; // Authentication token
  syncDirection: "pull" | "push" | "bidirectional";
  filters?: {
    streams?: LedgerStream[];
    issuerOids?: string[];
    subjectOids?: string[];
  };
}
```

#### 4. Conflict Resolution

**Strategies:**

1. **Last Write Wins**: Nieuwste timestamp wint
2. **Source Priority**: Bepaalde ledger heeft voorrang
3. **Manual Resolution**: Conflicts worden opgeslagen voor handmatige resolutie
4. **Merge**: Combineer entries (complex, vereist custom logic)

```typescript
interface ConflictResolution {
  strategy: "last-write-wins" | "source-priority" | "manual" | "merge";
  sourcePriority?: string[]; // Ledger IDs in priority order
  mergeHandler?: (local: LedgerEntry, remote: LedgerEntry) => LedgerEntry;
}
```

#### 5. Sync Protocol

**Pull Flow:**

```
1. Local ledger vraagt remote ledger om entries sinds laatste sync
   GET /ledger/sync/pull?since={timestamp}&limit=100

2. Remote ledger retourneert entries met verificatie data
   {
     entries: LedgerEntry[],
     hasMore: boolean,
     checkpoint: { hash, timestamp }
   }

3. Local ledger verifieert entries:
   - Hash verification
   - Signature verification
   - Chain integrity

4. Local ledger append entries (met speciale meta flag)
   - Entry krijgt meta.sync = { source: "remote-ledger-id", originalId: "..." }
   - Entry wordt toegevoegd met nieuwe hash (om chain intact te houden)

5. Sync state wordt bijgewerkt
```

**Push Flow:**

```
1. Local ledger identificeert nieuwe entries (niet gesynced)
   - Query sync state voor "outbound" entries met status "pending"

2. Local ledger push entries naar remote
   POST /ledger/sync/push
   {
     entries: LedgerEntry[],
     sourceLedgerId: "...",
     sourcePublicKey: "..."
   }

3. Remote ledger verifieert en accepteert entries
   - Verificatie van signatures
   - Conflict check
   - Append entries

4. Remote ledger retourneert sync result
   {
     accepted: string[], // Entry IDs
     rejected: string[], // Entry IDs met reden
     conflicts: Conflict[]
   }

5. Local ledger update sync state
```

#### 6. Plugin Implementation

```typescript
export function syncPlugin(options: SyncPluginOptions): OnoalLedgerPlugin {
  const service = new SyncService(options);

  return {
    id: "sync",
    version: "1.0.0",
    hooks: {
      afterAppend: async (entry, ledger) => {
        // Mark entry for sync
        await service.markForSync(entry, "outbound");

        // Trigger sync if auto-sync enabled
        if (options.autoSync) {
          await service.syncOutbound(ledger);
        }
      },

      beforeGet: async (id, ledger) => {
        // Check if entry exists locally, otherwise try to pull from remote
        if (options.autoPull) {
          const entry = await service.tryPullEntry(id, ledger);
          if (entry) return entry;
        }
      },
    },
  };
}
```

#### 7. API Routes

```typescript
// Sync endpoints toegevoegd via module routes
{
  method: "GET",
  path: "/ledger/sync/pull",
  handler: async (req, ledger) => {
    // Return entries for sync
  }
},
{
  method: "POST",
  path: "/ledger/sync/push",
  handler: async (req, ledger) => {
    // Accept entries from remote ledger
  }
},
{
  method: "GET",
  path: "/ledger/sync/status",
  handler: async (req, ledger) => {
    // Return sync status for all connected ledgers
  }
}
```

### Sync Features

✅ **Incremental Sync**: Alleen nieuwe entries sinds laatste sync  
✅ **Conflict Detection**: Detecteert conflicterende entries  
✅ **Verification**: Verifieert alle entries voor sync  
✅ **Filtering**: Sync alleen specifieke streams/OIDs  
✅ **Retry Logic**: Automatische retry bij failures  
✅ **State Tracking**: Volledige sync state tracking  
✅ **Bidirectional**: Push en pull in beide richtingen

## 🌐 Interoperability Plugin

### Doel

Bind meerdere ledgers aan elkaar om een **ledger network** te vormen:

- Cross-ledger entry references
- Network discovery
- Trust relationships
- Distributed queries
- Cross-ledger transactions

### Architectuur

#### 1. Network Topology

```typescript
interface LedgerNetwork {
  nodes: LedgerNode[];
  edges: NetworkEdge[];
  trustGraph: TrustGraph;
}

interface LedgerNode {
  id: string; // Unique ledger identifier
  name: string;
  endpoint: string;
  publicKey: string;
  capabilities: string[]; // ["sync", "query", "cross-ref"]
  metadata: {
    version: string;
    streams: LedgerStream[];
    region?: string;
  };
}

interface NetworkEdge {
  from: string; // Ledger ID
  to: string; // Ledger ID
  type: "sync" | "reference" | "trust";
  config: {
    bidirectional?: boolean;
    filters?: SyncFilters;
    trustLevel?: number; // 0-1
  };
}
```

#### 2. Cross-Ledger References

**Entry Meta Extensie:**

```typescript
// Entry kan verwijzen naar entry in andere ledger
interface CrossLedgerReference {
  ledgerId: string;
  entryId: string;
  entryHash: string; // Voor verificatie
  referenceType: "source" | "derived" | "related" | "transaction";
}

// Entry payload kan cross-ledger references bevatten
{
  type: "proof",
  issuer_oid: "oid:onoal:org:ledger-a",
  payload: {
    // ... normal payload
  },
  meta: {
    crossLedgerRefs: [
      {
        ledgerId: "ledger-b",
        entryId: "entry-123",
        entryHash: "abc...",
        referenceType: "source"
      }
    ]
  }
}
```

#### 3. Network Discovery

```typescript
class NetworkDiscovery {
  /**
   * Discover ledgers in network
   */
  async discover(options: {
    method: "dns" | "registry" | "peer-to-peer" | "manual";
    registryUrl?: string;
    bootstrapNodes?: string[];
  }): Promise<LedgerNode[]>;

  /**
   * Register this ledger in network
   */
  async register(registry: NetworkRegistry): Promise<void>;

  /**
   * Find ledgers by capability
   */
  async findLedgers(capability: string): Promise<LedgerNode[]>;
}
```

#### 4. Trust Relationships

```typescript
interface TrustRelationship {
  fromLedgerId: string;
  toLedgerId: string;
  trustLevel: number; // 0-1
  trustType: "full" | "partial" | "query-only" | "sync-only";
  verifiedBy: string[]; // Public keys of verifiers
  expiresAt?: number;
}

class TrustManager {
  /**
   * Establish trust relationship
   */
  async establishTrust(
    targetLedger: LedgerNode,
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
   * Get trust level between ledgers
   */
  async getTrustLevel(from: string, to: string): Promise<number>;
}
```

#### 5. Cross-Ledger Queries

```typescript
class CrossLedgerQuery {
  /**
   * Query across multiple ledgers
   */
  async query(query: {
    filters: QueryFilters;
    ledgers?: string[]; // Specific ledgers, or all if not specified
    trustLevel?: number; // Minimum trust level
  }): Promise<{
    results: Array<{
      ledgerId: string;
      entries: LedgerEntry[];
    }>;
    aggregated: LedgerEntry[];
  }>;

  /**
   * Follow cross-ledger references
   */
  async followReferences(
    entry: LedgerEntry,
    maxDepth?: number
  ): Promise<LedgerEntry[]>;
}
```

#### 6. Network Registry

```typescript
interface NetworkRegistry {
  /**
   * Register ledger in network
   */
  register(node: LedgerNode): Promise<void>;

  /**
   * Discover ledgers
   */
  discover(filters?: {
    capabilities?: string[];
    region?: string;
    trustLevel?: number;
  }): Promise<LedgerNode[]>;

  /**
   * Get ledger info
   */
  getLedger(ledgerId: string): Promise<LedgerNode | null>;

  /**
   * Update ledger status
   */
  updateStatus(ledgerId: string, status: "online" | "offline"): Promise<void>;
}
```

#### 7. Plugin Implementation

```typescript
export function interoperabilityPlugin(
  options: InteroperabilityPluginOptions
): OnoalLedgerPlugin {
  const network = new LedgerNetwork(options);
  const discovery = new NetworkDiscovery(options.discovery);
  const trustManager = new TrustManager(options.trust);
  const crossLedgerQuery = new CrossLedgerQuery(network, trustManager);

  return {
    id: "interoperability",
    version: "1.0.0",
    hooks: {
      afterAppend: async (entry, ledger) => {
        // Check for cross-ledger references
        const refs = extractCrossLedgerRefs(entry);
        if (refs.length > 0) {
          // Verify references exist and are valid
          await verifyCrossLedgerRefs(refs, network, trustManager);
        }
      },

      beforeQuery: async (filters, ledger) => {
        // Optionally extend query to cross-ledger
        if (options.enableCrossLedgerQuery && filters._crossLedger) {
          const crossLedgerResults = await crossLedgerQuery.query({
            filters,
            ledgers: filters._ledgers,
            trustLevel: options.minTrustLevel,
          });
          // Merge results
          return {
            shortCircuit: {
              entries: crossLedgerResults.aggregated,
              nextCursor: null,
              hasMore: false,
            },
          };
        }
      },
    },
  };
}
```

#### 8. API Routes

```typescript
// Network endpoints
{
  method: "GET",
  path: "/network/discover",
  handler: async (req, ledger) => {
    // Discover ledgers in network
  }
},
{
  method: "POST",
  path: "/network/connect",
  handler: async (req, ledger) => {
    // Connect to another ledger
  }
},
{
  method: "GET",
  path: "/network/ledgers",
  handler: async (req, ledger) => {
    // List connected ledgers
  }
},
{
  method: "POST",
  path: "/network/trust",
  handler: async (req, ledger) => {
    // Establish trust relationship
  }
},
{
  method: "GET",
  path: "/network/query",
  handler: async (req, ledger) => {
    // Cross-ledger query
  }
}
```

### Interoperability Features

✅ **Network Discovery**: Automatische discovery van ledgers  
✅ **Trust Management**: Trust relationships tussen ledgers  
✅ **Cross-Ledger References**: Entries kunnen verwijzen naar andere ledgers  
✅ **Distributed Queries**: Query over meerdere ledgers  
✅ **Reference Verification**: Verifieert cross-ledger references  
✅ **Network Registry**: Centraal of gedistribueerd registry  
✅ **Topology Management**: Beheer van network topology

## 🔗 Integratie tussen Plugins

### Synergy

De twee plugins werken samen:

1. **Sync Plugin** synchroniseert entries tussen ledgers
2. **Interoperability Plugin** beheert network topology en trust
3. **Combined**: Sync gebeurt alleen tussen trusted ledgers in network

```typescript
// Gebruik beide plugins samen
const ledger = await createLedger({
  // ...
  plugins: [
    interoperabilityPlugin({
      discovery: { method: "registry", registryUrl: "..." },
      trust: { minTrustLevel: 0.7 },
    }),
    syncPlugin({
      autoSync: true,
      // Sync alleen met trusted ledgers
      filterByTrust: true,
      minTrustLevel: 0.7,
    }),
  ],
});
```

## 📊 Database Schema Extensies

### Sync Plugin Tables

```sql
-- Sync state tracking
CREATE TABLE sync_state (
  id TEXT PRIMARY KEY,
  remote_ledger_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  entry_hash TEXT NOT NULL,
  sync_direction TEXT NOT NULL, -- 'inbound' | 'outbound'
  sync_status TEXT NOT NULL, -- 'pending' | 'synced' | 'conflict' | 'failed'
  last_sync_attempt INTEGER,
  sync_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_sync_remote_ledger ON sync_state(remote_ledger_id, sync_status);
CREATE INDEX idx_sync_entry ON sync_state(entry_id, entry_hash);
CREATE INDEX idx_sync_pending ON sync_state(sync_status, last_sync_attempt);

-- Remote ledger connections
CREATE TABLE remote_ledgers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  public_key TEXT NOT NULL,
  auth_token TEXT,
  sync_direction TEXT NOT NULL, -- 'pull' | 'push' | 'bidirectional'
  filters JSON, -- Stream/OID filters
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Interoperability Plugin Tables

```sql
-- Network nodes
CREATE TABLE network_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  public_key TEXT NOT NULL,
  capabilities JSON NOT NULL,
  metadata JSON,
  status TEXT NOT NULL, -- 'online' | 'offline' | 'unknown'
  last_seen INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Network edges (connections)
CREATE TABLE network_edges (
  id TEXT PRIMARY KEY,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT NOT NULL,
  edge_type TEXT NOT NULL, -- 'sync' | 'reference' | 'trust'
  config JSON,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (from_ledger_id) REFERENCES network_nodes(id),
  FOREIGN KEY (to_ledger_id) REFERENCES network_nodes(id)
);

CREATE INDEX idx_network_edges_from ON network_edges(from_ledger_id);
CREATE INDEX idx_network_edges_to ON network_edges(to_ledger_id);

-- Trust relationships
CREATE TABLE trust_relationships (
  id TEXT PRIMARY KEY,
  from_ledger_id TEXT NOT NULL,
  to_ledger_id TEXT NOT NULL,
  trust_level REAL NOT NULL, -- 0.0 - 1.0
  trust_type TEXT NOT NULL, -- 'full' | 'partial' | 'query-only' | 'sync-only'
  verified_by JSON, -- Array of public keys
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (from_ledger_id) REFERENCES network_nodes(id),
  FOREIGN KEY (to_ledger_id) REFERENCES network_nodes(id)
);

CREATE INDEX idx_trust_from ON trust_relationships(from_ledger_id);
CREATE INDEX idx_trust_to ON trust_relationships(to_ledger_id);
CREATE INDEX idx_trust_level ON trust_relationships(trust_level);
```

## 🚀 Implementatie Stappenplan

### Phase 1: Sync Plugin (Basis)

1. ✅ Database schema voor sync state
2. ✅ SyncService implementatie
3. ✅ RemoteLedgerConnection interface
4. ✅ Pull/Push mechanisme
5. ✅ Conflict detection
6. ✅ Plugin hooks integratie
7. ✅ API routes voor sync endpoints

### Phase 2: Sync Plugin (Advanced)

1. ✅ Bidirectional sync
2. ✅ Incremental sync optimization
3. ✅ Retry logic en error handling
4. ✅ Sync filtering (streams, OIDs)
5. ✅ Sync scheduling (periodic sync)
6. ✅ Sync monitoring en metrics

### Phase 3: Interoperability Plugin (Basis)

1. ✅ Network node management
2. ✅ Network discovery (manual first)
3. ✅ Cross-ledger reference support
4. ✅ Basic trust relationships
5. ✅ Plugin hooks integratie
6. ✅ API routes voor network endpoints

### Phase 4: Interoperability Plugin (Advanced)

1. ✅ Network registry (centralized)
2. ✅ Distributed network discovery
3. ✅ Trust chain verification
4. ✅ Cross-ledger queries
5. ✅ Network topology visualization
6. ✅ Network health monitoring

### Phase 5: Integration

1. ✅ Sync + Interoperability integratie
2. ✅ Trust-based sync filtering
3. ✅ Network-aware sync
4. ✅ End-to-end testing
5. ✅ Performance optimization
6. ✅ Documentation

## 🔒 Security Considerations

### Sync Plugin

- **Authentication**: Mutual TLS of API keys tussen ledgers
- **Verification**: Alle entries worden geverifieerd (hash + signature)
- **Encryption**: Optionele end-to-end encryptie voor sensitive data
- **Rate Limiting**: Prevent sync abuse
- **Access Control**: Alleen authorized ledgers kunnen syncen

### Interoperability Plugin

- **Trust Verification**: Trust relationships worden cryptographically verified
- **Public Key Infrastructure**: Ledgers identificeren zich met public keys
- **Network Isolation**: Optionele network segmentation
- **Reference Validation**: Cross-ledger references worden geverifieerd
- **Discovery Security**: Secure discovery protocol (niet iedereen kan joinen)

## 📈 Performance Considerations

### Sync Plugin

- **Batch Sync**: Sync meerdere entries in één request
- **Incremental Sync**: Alleen nieuwe entries sinds laatste sync
- **Parallel Sync**: Sync met meerdere ledgers parallel
- **Compression**: Compress entries tijdens sync
- **Caching**: Cache remote ledger state

### Interoperability Plugin

- **Query Optimization**: Efficient cross-ledger queries
- **Caching**: Cache network topology en trust relationships
- **Lazy Loading**: Load network nodes on-demand
- **Connection Pooling**: Reuse connections naar remote ledgers

## 🎯 Use Cases

### Sync Plugin

1. **Multi-Region Deployment**: Sync tussen regionale ledgers
2. **Backup & Disaster Recovery**: Sync naar backup ledger
3. **Federation**: Federated ledgers die data delen
4. **Offline Sync**: Sync wanneer connection hersteld wordt

### Interoperability Plugin

1. **Ledger Network**: Netwerk van interconnected ledgers
2. **Cross-Ledger Transactions**: Transacties tussen ledgers
3. **Distributed Queries**: Query over meerdere ledgers
4. **Trust Networks**: Trust-based ledger networks
5. **Federation**: Federated ledger systems

## 📝 Conclusie

Beide plugins zijn haalbaar en passen goed in de huidige Ledger Framework architectuur:

- **Sync Plugin**: Gebruikt `afterAppend` hooks en voegt sync state tracking toe
- **Interoperability Plugin**: Gebruikt hooks voor cross-ledger references en network management
- **Database Extensions**: Nieuwe tabellen voor sync state en network topology
- **API Routes**: Nieuwe endpoints voor sync en network operations
- **Security**: Cryptographic verification en trust management

De plugins kunnen onafhankelijk gebruikt worden, maar werken het beste samen voor een volledig distributed ledger network.
