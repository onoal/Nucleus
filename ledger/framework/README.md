# @onoal/ledger-core

**Core ledger engine for building custom Onoal ledgers**

This package provides the core functionality for creating and managing immutable ledgers with hash chain integrity.

## 🎯 Overview

`@onoal/ledger-core` is the foundation of the Onoal Ledger SDK. It provides:

- **Ledger Engine** - Core ledger functionality
- **Hash Chain** - Immutable chain of entries
- **Proof Generation** - JWT proof generation for entries
- **Schema Validation** - Type-safe schema validation
- **UAL Integration** - Unified Access Layer support

## 📦 Installation

```bash
pnpm add @onoal/ledger-core
```

## 🚀 Quick Start

```typescript
import { createLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";

const ledger = createLedger({
  name: "my-ledger",
  signingKey: ed25519Key,
  adapter: sqliteAdapter("ledger.db"),
  customSchemas: {
    ticket: {
      type: "object",
      required: ["event", "seat"],
      properties: {
        event: { type: "string" },
        seat: { type: "string" },
      },
    },
  },
});

// Append entry
const entry = await ledger.append({
  type: "ticket",
  issuer_oid: "oid:onoal:org:festival",
  payload: {
    event: "Tomorrowland",
    seat: "A12",
  },
});
```

## 📚 Documentation

See [Ledger SDK Analysis](../../docs/ONOAL_LEDGER_SDK_ANALYSIS.md) for complete context.

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
