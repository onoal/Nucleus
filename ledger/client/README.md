# @onoal/ledger-sdk

**Client SDK for Onoal Ledger API**

Type-safe client for interacting with Onoal Ledger APIs.

## 📦 Installation

```bash
pnpm add @onoal/ledger-sdk
```

## 🚀 Usage

```typescript
import { OnoalLedgerClient } from "@onoal/ledger-sdk";

const client = new OnoalLedgerClient({
  url: "https://ledger.example.com",
  oid: "oid:onoal:org:festival",
});

// Issue entry
const entry = await client.issue({
  type: "ticket",
  issuer_oid: "oid:onoal:org:festival",
  payload: { event: "Tomorrowland", seat: "A12" },
});

// Get entry
const retrieved = await client.get(entry.id);

// Query entries
const results = await client.query({
  subject_oid: "oid:onoal:user:abc123",
});
```

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
