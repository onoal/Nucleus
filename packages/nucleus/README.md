# @onoal/nucleus

Minimal ledger system for OID-based verifiable records.

## Installation

```bash
npm install @onoal/nucleus
# or
pnpm add @onoal/nucleus
```

### SQLite Native Dependencies

The SQLite storage adapter uses `better-sqlite3`, which requires native compilation. If you encounter build issues:

**Option 1: Pre-built binaries (recommended)**

```bash
pnpm install --ignore-scripts=false
```

**Option 2: Build from source**
Requires:

- Node.js build tools (`node-gyp`)
- Python 3.x with `setuptools`
- C++ compiler (XCode on macOS, build-essential on Linux)

```bash
# macOS
python3 -m pip install --break-system-packages setuptools

# Linux
sudo apt-get install build-essential python3-setuptools
```

**Option 3: Skip SQLite tests**
All core functionality works without building better-sqlite3. Only storage tests require native builds:

```bash
pnpm test src/modules src/core  # Skip storage tests
```

## Quick Start

```typescript
import {
  createNucleus,
  registerModule,
  oidModule,
  proofModule,
  SQLiteRecordStore,
} from "@onoal/nucleus";

// Initialize storage
const store = new SQLiteRecordStore(":memory:");

// Register modules
registerModule("oid", oidModule);
registerModule("proof", proofModule);

// Create nucleus instance
const nucleus = await createNucleus({ store });

// Append a record
const result = await nucleus.append({
  module: "oid",
  chainId: "oid:onoal:user:alice",
  body: {
    /* your data */
  },
});
```

## Documentation

See [examples/basic-usage.ts](../../examples/basic-usage.ts) for complete examples.

## Development

```bash
# Build
pnpm build

# Test (core only, no SQLite)
pnpm test src/modules src/core

# Test (all, requires better-sqlite3 build)
pnpm test

# Lint
pnpm lint
```

## License

MIT
