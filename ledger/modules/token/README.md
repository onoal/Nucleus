# @onoal/ledger-module-token

Token module for Onoal Ledger Framework - fungible tokens with double-entry accounting.

## Overview

This module provides token creation, minting, burning, transfer, and querying functionality for the Ledger Framework. Unlike Asset and Connect modules which use append-only ledger entries, tokens use **double-entry accounting** with balances.

## Features

- ✅ **Token Creation**: Create new tokens with configurable decimals, supply caps, and metadata
- ✅ **Minting**: Create new token supply and add to accounts
- ✅ **Burning**: Destroy token supply and remove from accounts
- ✅ **Transfer**: Move tokens between accounts with nonce-based anti-replay protection
- ✅ **Balance Management**: Per-account balances with automatic account creation
- ✅ **Double-Entry Accounting**: Complete audit trail in `token_ledger` table
- ✅ **ACL Integration**: Full UAL support for token access control
- ✅ **Idempotency**: Transaction deduplication via `tx_id`
- ✅ **DPoP Required**: Enhanced security for token mutations

## Installation

```bash
pnpm add @onoal/ledger-module-token
```

## Usage

```typescript
import { createLedger } from "@onoal/ledger-core";
import { tokenModule } from "@onoal/ledger-module-token";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";

const ledger = await createLedger({
  name: "my-ledger",
  signingKey: privateKey,
  adapter: sqliteAdapter({ path: "./ledger.db" }),
  modules: [tokenModule()],
});

// Use token service
const tokenService = ledger.getService<TokenService>("tokenService");

// Create token
const token = await tokenService.createToken({
  issuer_oid: "oid:onoal:org:myorg",
  symbol: "POINTS",
  name: "Reward Points",
  decimals: 6,
  supply_cap: BigInt(1_000_000_000), // 1 billion tokens max
});

// Mint tokens
const mintResult = await tokenService.mintToken({
  tokenId: token.token_id,
  to: "oid:onoal:user:alice",
  amount: BigInt(100 * 1_000_000), // 100.0 tokens (6 decimals)
  txId: crypto.randomUUID(),
  actorOid: "oid:onoal:org:myorg",
});

// Transfer tokens
const transferResult = await tokenService.transferToken({
  tokenId: token.token_id,
  from: "oid:onoal:user:alice",
  to: "oid:onoal:user:bob",
  amount: BigInt(50 * 1_000_000), // 50.0 tokens
  nonce: BigInt(0), // Current account nonce
  txId: crypto.randomUUID(),
  actorOid: "oid:onoal:user:alice",
});

// Get balance
const balance = await tokenService.getBalance(
  token.token_id,
  "oid:onoal:user:alice"
);
```

## API Routes

The module provides the following REST endpoints:

- `POST /token` - Create new token
- `POST /token/:id/mint` - Mint tokens (requires DPoP)
- `POST /token/:id/burn` - Burn tokens (requires DPoP)
- `POST /token/:id/transfer` - Transfer tokens (requires DPoP)
- `GET /token/:id` - Get token details
- `GET /token/:id/balance` - Get account balance
- `GET /token/:id/holders` - Get token holders
- `GET /token/:id/ledger` - Get ledger history
- `GET /token/list` - List tokens

## Database Schema

The module uses three tables:

1. **`tokens`** - Token definitions and supply management
2. **`token_accounts`** - Per-account balances and nonces
3. **`token_ledger`** - Append-only double-entry ledger

See [schema documentation](./src/schema/) for details.

### Adapter Integration

To enable full type safety and Drizzle query API support, you can optionally add the token schema to your adapter:

```typescript
import { postgresAdapter } from "@onoal/ledger-database-postgres";
import { tokenSchema } from "@onoal/ledger-module-token/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  ledgerEntriesPg,
  ledgerTipPg,
  ledgerCheckpointsPg,
} from "@onoal/ledger-core/internal";

// Create adapter with token schema
const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client, {
  schema: {
    // Core ledger schema
    ledgerEntries: ledgerEntriesPg,
    ledgerTip: ledgerTipPg,
    ledgerCheckpoints: ledgerCheckpointsPg,
    // Token schema (optional)
    ...tokenSchema,
  },
});

const adapter = {
  id: "postgres",
  db,
  provider: "postgres" as const,
};
```

**Note**: The TokenService works without adding the schema to the adapter (it uses direct database access), but adding it enables:

- Full TypeScript type safety
- Drizzle query API (`db.query.tokens`, `db.query.tokenAccounts`, etc.)
- Better IDE autocomplete

### Migrations

Run migrations manually using Drizzle Kit or the provided SQL files:

**PostgreSQL**:

```bash
# Using Drizzle Kit
pnpm drizzle-kit push

# Or manually
psql $DATABASE_URL < migrations/postgres/0001_token_primitives.sql
```

**SQLite**:

```bash
sqlite3 ledger.db < migrations/sqlite/0001_token_primitives.sql
```

**D1** (Cloudflare):

```bash
wrangler d1 execute DB --file=migrations/d1/0001_token_primitives.sql
```

## Differences from Assets/Connect

| Aspect          | Assets/Connect               | Tokens                                                |
| --------------- | ---------------------------- | ----------------------------------------------------- |
| **Storage**     | `ledger_entries` table       | 3 tables (`tokens`, `token_accounts`, `token_ledger`) |
| **Operations**  | Append-only entries          | Double-entry accounting                               |
| **Balance**     | N/A (single asset per entry) | Per-account balances                                  |
| **Nonce**       | N/A                          | Required for mutations                                |
| **DPoP**        | Optional                     | Required for mutations                                |
| **Idempotency** | By entry ID                  | By tx_id (UUID)                                       |
| **Supply**      | N/A                          | Total supply + per-account balances                   |

## Security

- **Nonce Management**: Anti-replay protection via account nonces
- **DPoP Required**: All token mutations require DPoP proof
- **Idempotency**: Transaction deduplication via `tx_id`
- **ACL Integration**: Full UAL support for access control
- **Transaction Safety**: Atomic operations with optimistic locking

## License

MIT
