# Mesh Protocol: Module vs Plugin Analyse

## 📋 Overzicht

Deze analyse vergelijkt of het **Onoal Network Mesh Protocol** beter geïmplementeerd moet worden als **Module** of als **Plugin** in het Ledger Framework.

## 🔍 Verschillen tussen Modules en Plugins

### Modules (`OnoalLedgerModule`)

**Wat modules KUNNEN:**

✅ **Services**: Registreren services in service container

```typescript
services: {
  meshNetworkService: MeshNetworkService,
  meshRoutingService: MeshRoutingService,
}
```

✅ **Routes**: Toevoegen API endpoints

```typescript
routes: [
  { method: "GET", path: "/mesh/peers", handler: ... },
  { method: "POST", path: "/mesh/connect", handler: ... },
]
```

✅ **Database Schema**: Extend database met nieuwe tabellen

```typescript
drizzleSchema: {
  meshPeers: pgTable("mesh_peers", { ... }),
  meshConnections: pgTable("mesh_connections", { ... }),
}
```

✅ **Hooks**: Alle ledger operation hooks

```typescript
hooks: {
  beforeAppend: ...,
  afterAppend: ...,
  beforeQuery: ...,
  // etc.
}
```

✅ **Lifecycle Hooks**: `load`, `start`, `stop`

```typescript
load: async (ledger) => { /* initialize */ },
start: async (ledger) => { /* join mesh */ },
stop: async (ledger) => { /* leave mesh */ },
```

✅ **Dependencies**: Declareer dependencies op andere modules

```typescript
dependencies: ["sync"]; // Optioneel: mesh kan sync plugin gebruiken
```

### Plugins (`OnoalLedgerPlugin`)

**Wat plugins KUNNEN:**

✅ **Hooks**: Alleen ledger operation hooks

```typescript
hooks: {
  beforeAppend: ...,
  afterAppend: ...,
  beforeQuery: ...,
  // etc.
}
```

**Wat plugins NIET kunnen:**

❌ **Geen Services**: Plugins kunnen geen services registreren
❌ **Geen Routes**: Plugins kunnen geen API endpoints toevoegen
❌ **Geen Database Schema**: Plugins kunnen geen database tabellen toevoegen
❌ **Geen Lifecycle Hooks**: Plugins hebben geen `load`, `start`, `stop`

## 🎯 Mesh Protocol Requirements

### Wat Mesh Protocol nodig heeft:

1. **Services** (✅ Modules kunnen dit, ❌ Plugins niet)
   - `MeshNetworkService` - Beheer mesh network
   - `MeshRoutingService` - Mesh routing logic
   - `MeshDiscoveryService` - Peer discovery
   - `MeshTrustService` - Trust management

2. **Routes** (✅ Modules kunnen dit, ❌ Plugins niet)
   - `GET /mesh/peers` - List connected peers
   - `GET /mesh/topology` - Get mesh topology
   - `POST /mesh/connect` - Connect to peer
   - `POST /mesh/query` - Cross-ledger query
   - `GET /mesh/status` - Mesh status

3. **Database Schema** (✅ Modules kunnen dit, ❌ Plugins niet)
   - `mesh_peers` - Connected ledgers
   - `mesh_connections` - Network edges
   - `mesh_routing` - Routing table
   - `mesh_trust` - Trust relationships
   - `mesh_messages` - Message cache

4. **Lifecycle Hooks** (✅ Modules kunnen dit, ❌ Plugins niet)
   - `load` - Initialize mesh services
   - `start` - Join mesh network
   - `stop` - Leave mesh network

5. **Operation Hooks** (✅ Beide kunnen dit)
   - `afterAppend` - Check cross-ledger references
   - `beforeQuery` - Extend query to mesh

## 📊 Vergelijking

| Requirement         | Module | Plugin | Mesh Protocol Nodig?                           |
| ------------------- | ------ | ------ | ---------------------------------------------- |
| **Services**        | ✅ Ja  | ❌ Nee | ✅ **Ja** - MeshNetworkService, etc.           |
| **Routes**          | ✅ Ja  | ❌ Nee | ✅ **Ja** - /mesh/peers, /mesh/connect, etc.   |
| **Database Schema** | ✅ Ja  | ❌ Nee | ✅ **Ja** - mesh_peers, mesh_connections, etc. |
| **Lifecycle Hooks** | ✅ Ja  | ❌ Nee | ✅ **Ja** - start/stop mesh network            |
| **Operation Hooks** | ✅ Ja  | ✅ Ja  | ✅ **Ja** - afterAppend, beforeQuery           |
| **Dependencies**    | ✅ Ja  | ❌ Nee | ⚠️ Optioneel - sync plugin                     |

## 🎯 Conclusie: **MODULE is de juiste keuze**

### Waarom Module?

1. **Services zijn essentieel**
   - Mesh Protocol heeft meerdere services nodig
   - Services moeten beschikbaar zijn via `ledger.getService()`
   - Plugins kunnen geen services registreren

2. **Routes zijn essentieel**
   - Mesh Protocol heeft API endpoints nodig
   - `/mesh/peers`, `/mesh/connect`, `/mesh/query`, etc.
   - Plugins kunnen geen routes toevoegen

3. **Database Schema is essentieel**
   - Mesh Protocol heeft nieuwe tabellen nodig
   - `mesh_peers`, `mesh_connections`, `mesh_routing`, etc.
   - Plugins kunnen geen database schema toevoegen

4. **Lifecycle Hooks zijn essentieel**
   - Mesh network moet starten/stoppen
   - `start` hook om mesh te joinen
   - `stop` hook om mesh te verlaten
   - Plugins hebben geen lifecycle hooks

5. **Operation Hooks zijn ook nodig**
   - Maar modules kunnen dit ook
   - Modules hebben alle functionaliteit van plugins + meer

### Waarom NIET Plugin?

❌ **Plugins zijn te beperkt**:

- Geen services → Mesh services kunnen niet worden geregistreerd
- Geen routes → Mesh API endpoints kunnen niet worden toegevoegd
- Geen database schema → Mesh tabellen kunnen niet worden toegevoegd
- Geen lifecycle hooks → Mesh network kan niet starten/stoppen

## 📐 Aanbevolen Architectuur

### Mesh Protocol als Module

```typescript
export function meshProtocolModule(
  options: MeshProtocolModuleOptions
): OnoalLedgerModule {
  return createCustomModule({
    id: "mesh-protocol",
    label: "Onoal Network Mesh Protocol",
    version: "1.0.0",

    // 1. Services (essentieel)
    services: {
      meshNetworkService: MeshNetworkService,
      meshRoutingService: MeshRoutingService,
      meshDiscoveryService: MeshDiscoveryService,
      meshTrustService: MeshTrustService,
    },

    // 2. Routes (essentieel)
    routes: [
      { method: "GET", path: "/mesh/peers", handler: ... },
      { method: "GET", path: "/mesh/topology", handler: ... },
      { method: "POST", path: "/mesh/connect", handler: ... },
      { method: "POST", path: "/mesh/query", handler: ... },
    ],

    // 3. Database Schema (essentieel)
    drizzleSchema: {
      meshPeers: pgTable("mesh_peers", { ... }),
      meshConnections: pgTable("mesh_connections", { ... }),
      meshRouting: pgTable("mesh_routing", { ... }),
      meshTrust: pgTable("mesh_trust", { ... }),
      meshMessages: pgTable("mesh_messages", { ... }),
    },

    // 4. Lifecycle Hooks (essentieel)
    lifecycle: {
      load: async (ledger) => {
        // Initialize mesh services
        const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.initialize();
      },
      start: async (ledger) => {
        // Join mesh network
        const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.join(options.mesh);
      },
      stop: async (ledger) => {
        // Leave mesh network
        const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.leave();
      },
    },

    // 5. Operation Hooks (essentieel)
    hooks: {
      afterAppend: async (entry, ledger) => {
        // Check for cross-ledger references
        const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.handleNewEntry(entry);
      },
      beforeQuery: async (filters, ledger) => {
        // Optionally extend query to mesh
        if (filters._meshQuery) {
          const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
          return await meshNetwork.queryMesh(filters);
        }
      },
    },
  });
}
```

### Sync Plugin blijft Plugin

**Waarom Sync Plugin als Plugin?**

✅ **Sync Plugin heeft alleen hooks nodig**:

- `afterAppend` - Mark entry for sync
- `beforeGet` - Try pull from remote
- Geen services nodig (gebruikt Mesh services)
- Geen routes nodig (gebruikt Mesh routes)
- Geen database schema nodig (gebruikt Mesh schema)

```typescript
export function syncPlugin(options: SyncPluginOptions): OnoalLedgerPlugin {
  return {
    id: "sync",
    version: "1.0.0",
    hooks: {
      afterAppend: async (entry, ledger) => {
        // Use Mesh Network Service (from module)
        const meshNetwork =
          ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.syncEntry(entry);
      },
    },
  };
}
```

## 🔄 Integratie

### Gebruik beide samen:

```typescript
const ledger = await createLedger({
  // ...
  modules: [
    meshProtocolModule({
      mesh: {
        ledgerId: "my-ledger",
        ledgerOid: "oid:onoal:org:myorg",
        discovery: { method: "registry" },
      },
    }),
  ],
  plugins: [
    syncPlugin({
      // Sync plugin gebruikt Mesh services
      autoSync: true,
    }),
  ],
});
```

**Flow:**

1. **Mesh Protocol Module** registreert services, routes, schema
2. **Sync Plugin** gebruikt Mesh services via `ledger.getService()`
3. Beide werken samen naadloos

## 📊 Vergelijking met Bestaande Modules

### Token Module (voorbeeld)

Token Module heeft:

- ✅ Services: `TokenService`
- ✅ Routes: `/token`, `/token/:id/mint`, etc.
- ✅ Database Schema: `tokens`, `token_accounts`, `token_ledger`
- ✅ Hooks: `beforeAppend` voor validatie
- ✅ Lifecycle: `load` voor initialisatie

**Mesh Protocol heeft hetzelfde nodig!**

### Proof Module (voorbeeld)

Proof Module heeft:

- ✅ Services: `ProofService`
- ✅ Routes: `/ledger/submit`, `/ledger/proof/:id`, etc.
- ✅ Hooks: (geen custom hooks, gebruikt core hooks)

**Mesh Protocol heeft meer nodig dan Proof Module!**

## 🎯 Finale Aanbeveling

### **Mesh Protocol = MODULE** ✅

**Redenen:**

1. ✅ **Services zijn essentieel** - Mesh heeft 4+ services nodig
2. ✅ **Routes zijn essentieel** - Mesh heeft 5+ API endpoints nodig
3. ✅ **Database Schema is essentieel** - Mesh heeft 5+ tabellen nodig
4. ✅ **Lifecycle Hooks zijn essentieel** - Mesh moet starten/stoppen
5. ✅ **Consistentie** - Andere "core" features zijn ook modules (Token, Proof, Asset)

### **Sync = PLUGIN** ✅

**Redenen:**

1. ✅ **Alleen hooks nodig** - Sync heeft alleen operation hooks nodig
2. ✅ **Gebruikt Mesh services** - Sync gebruikt Mesh Network Service
3. ✅ **Geen eigen schema** - Sync gebruikt Mesh schema
4. ✅ **Geen eigen routes** - Sync gebruikt Mesh routes
5. ✅ **Consistentie** - Andere "optional" features zijn plugins (Audit, Rate Limit, Encryption)

## 📝 Implementatie Structuur

```
ledger/
├── modules/
│   └── mesh/                    # NEW: Mesh Protocol Module
│       ├── src/
│       │   ├── index.ts         # meshProtocolModule()
│       │   ├── services/
│       │   │   ├── mesh-network-service.ts
│       │   │   ├── mesh-routing-service.ts
│       │   │   ├── mesh-discovery-service.ts
│       │   │   └── mesh-trust-service.ts
│       │   ├── schema/
│       │   │   └── mesh-tables.ts
│       │   └── routes/
│       │       └── mesh-routes.ts
│       └── package.json
│
└── plugins/
    └── src/
        └── sync/
            ├── index.ts         # syncPlugin() - gebruikt Mesh services
            └── service.ts       # SyncService - gebruikt MeshNetworkService
```

## 🎯 Conclusie

**Mesh Protocol moet een MODULE zijn** omdat:

1. ✅ Modules hebben alle functionaliteit die Mesh nodig heeft
2. ✅ Plugins zijn te beperkt (geen services, routes, schema, lifecycle)
3. ✅ Consistent met andere "core" features (Token, Proof, Asset zijn modules)
4. ✅ Sync Plugin kan Mesh services gebruiken via service container

**Sync Plugin blijft een PLUGIN** omdat:

1. ✅ Sync heeft alleen hooks nodig
2. ✅ Sync gebruikt Mesh services (geen eigen services)
3. ✅ Consistent met andere "optional" features (Audit, Rate Limit zijn plugins)
