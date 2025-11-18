# @onoal/ledger-module-mesh

Onoal Network Mesh Protocol - Cross-ledger connectivity and synchronization.

## Installation

```bash
npm install @onoal/ledger-module-mesh
```

## Quick Start

```typescript
import { meshProtocolModule } from "@onoal/ledger-module-mesh";
import { createLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";

const ledger = await createLedger({
  name: "my-ledger",
  signingKey: new Uint8Array(32), // Your Ed25519 private key
  database: sqliteAdapter({
    url: "file:./ledger.db",
  }),
  modules: [
    meshProtocolModule({
      ledgerId: "my-ledger-id",
      ledgerOid: "oid:onoal:org:myorg",
      publicKey: "a1b2c3...", // Your Ed25519 public key (hex)
      endpoint: "https://ledger.example.com",
      bootstrapNodes: [
        { ledgerId: "hub-1", endpoint: "https://hub1.onoal.network" },
      ],
    }),
  ],
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

### Get Connected Peers

```typescript
const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
const peers = await meshNetwork.getPeers();
console.log("Connected peers:", peers);
```

## API Endpoints

The module provides the following REST API endpoints:

- `GET /mesh/peers` - List connected peers
- `POST /mesh/connect` - Connect to a peer
- `POST /mesh/query` - Cross-ledger query
- `POST /mesh/sync` - Entry synchronization

## Features

- ✅ **Peer Discovery** - Discover peers via bootstrap nodes
- ✅ **Cross-Ledger Queries** - Query entries from remote ledgers
- ✅ **Entry Synchronization** - Sync entries between ledgers
- ✅ **Trust Management** - Track trust levels for peers
- ✅ **Signature Verification** - All messages are cryptographically signed

## License

MIT
