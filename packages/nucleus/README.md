# @onoal/nucleus

TypeScript DX Layer for Nucleus Engine - A developer-friendly API for building custom ledgers powered by Rust.

## Installation

```bash
npm install @onoal/nucleus @onoal/nucleus-wasm
```

## Quick Start

### Using Factory Pattern

```typescript
import { createLedger, proofModule, assetModule } from "@onoal/nucleus";

// Create a ledger
const ledger = await createLedger({
  id: "my-ledger",
  backend: {
    mode: "wasm",
  },
  modules: [proofModule(), assetModule({ name: "tickets" })],
});

// Append a record
const hash = await ledger.append({
  id: "record-1",
  stream: "proofs",
  timestamp: Date.now(),
  payload: {
    type: "proof",
    subject_oid: "oid:onoal:human:alice",
    issuer_oid: "oid:onoal:org:example",
  },
});

// Query records
const results = await ledger.query({
  stream: "proofs",
  limit: 10,
});

// Verify chain
await ledger.verify();
```

### Using Builder Pattern

```typescript
import { ledgerBuilder, proofModule, assetModule } from "@onoal/nucleus";

// Create a ledger using fluent API
const ledger = await ledgerBuilder("my-ledger")
  .withWasmBackend()
  .withModule(proofModule())
  .withModule(assetModule({ name: "tickets" }))
  .withStrictValidation()
  .withMaxEntries(1000)
  .withMetrics()
  .build();
```

## API Reference

### `createLedger(config: LedgerConfig): Promise<Ledger>`

Creates a new ledger instance.

**Parameters:**

- `config.id` - Unique ledger identifier
- `config.backend` - Backend configuration (WASM or HTTP)
- `config.modules` - Array of module configurations
- `config.options` - Optional ledger options

**Returns:** Promise resolving to a `Ledger` instance

### `ledgerBuilder(id: string): LedgerBuilder`

Creates a new ledger builder for fluent API configuration.

**Methods:**

- `.withWasmBackend(wasmPath?)` - Configure WASM backend
- `.withHttpBackend(url, token?)` - Configure HTTP backend
- `.withModule(module)` - Add a module
- `.withModules(modules[])` - Add multiple modules
- `.withStrictValidation(strict?)` - Enable strict validation
- `.withMaxEntries(max)` - Set maximum entries
- `.withMetrics(enabled?)` - Enable metrics
- `.build()` - Build and create ledger instance

### Module Helpers

#### `proofModule(config?: ProofModuleConfig): ModuleConfig`

Creates a proof module configuration.

```typescript
const module = proofModule({
  strategies: ["ownership", "timestamp"],
});
```

#### `assetModule(config?: AssetModuleConfig): ModuleConfig`

Creates an asset module configuration.

```typescript
const module = assetModule({
  name: "tickets",
  indexBy: ["owner_oid"],
});
```

### Ledger Interface

```typescript
interface Ledger {
  readonly id: string;
  append(record: Record): Promise<string>;
  get(hash: string): Promise<Record | null>;
  getById(id: string): Promise<Record | null>;
  query(filters: QueryFilters): Promise<QueryResult>;
  appendBatch(records: Record[]): Promise<string[]>;
  verify(): Promise<void>;
  length(): Promise<number>;
  isEmpty(): Promise<boolean>;
  latestHash(): Promise<string | null>;
}
```

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.ts` - Basic ledger operations
- `builder-pattern.ts` - Using the builder pattern

## Architecture

The Nucleus Engine follows a layered architecture:

1. **Rust Core** (`nucleus-core`) - Pure ledger engine logic
2. **Rust Engine** (`nucleus-engine`) - Runtime wrapper
3. **WASM Bindings** (`nucleus-wasm`) - WebAssembly bindings
4. **TypeScript DX** (`@onoal/nucleus`) - Developer-friendly API

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck
```

## License

MIT
