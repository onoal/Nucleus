# 🎉 Nucleus v0.1.0-beta - Initial TypeScript Beta Release

**First beta release of the TypeScript-based Nucleus ledger system!**

---

## What is Nucleus?

Nucleus is a minimal, TypeScript-first ledger system for OID-based verifiable records. It provides cryptographic integrity guarantees for append-only chains of identity and attestation records.

---

## ✨ Features

### Core Engine

- ✅ **Append-Only Chains**: Sequential indices with deterministic hashing
- ✅ **Cryptographic Integrity**: SHA-256 via Rust/WASM
- ✅ **Module Architecture**: Pluggable validation for different record types
- ✅ **Type-Safe**: Strict TypeScript with comprehensive type definitions
- ✅ **Storage Adapters**: Pluggable backends (SQLite in beta)

### OID Module

- ✅ **Full Signature Verification**: Cryptographic validation via `@onoal/oid-core`
- ✅ **OID Record Anchoring**: Per-namespace chain storage
- ✅ **Chain Consistency**: Monotonic timestamps, OID immutability
- ✅ **Caller Authorization**: Enforced identity checks

### Proof Module

- ✅ **OID-Native Attestations**: Subject + Issuer + Kind + Data
- ✅ **Structural Validation**: Timestamp and expiration checks
- ✅ **Optional Signatures**: `issuerProof` field (verification in v0.2.0)
- ✅ **Flexible Claims**: Extensible data model

---

## 📦 Installation

```bash
npm install @onoal/nucleus@beta
```

---

## 🚀 Quick Start

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

// Append an OID record
const result = await nucleus.append({
  module: "oid",
  chainId: "oid:onoal:user:alice",
  body: { oidRecord: /* OID Core Record */ },
});
```

See [examples/basic-usage.ts](./examples/basic-usage.ts) for complete examples.

---

## 🏗️ Architecture

- **Monorepo**: pnpm workspaces + Turbo
- **Type Safety**: Strict TypeScript with comprehensive types
- **WASM Core**: Rust-based canonical JSON + SHA-256 hashing
- **Module Registry**: Singleton pattern for runtime registration
- **7 Core Invariants**: Append-only, unique hashes, sequential indices, chain linkage

---

## 📊 Test Coverage

- **73/73 core tests passing** ✅ (modules, engine, registry)
- **36 storage tests** (optional, requires better-sqlite3 native build)

---

## 🔒 Security

### ✅ Implemented

- OID signature verification (via @onoal/oid-core)
- Chain integrity validation
- Deterministic hashing
- Timestamp validation
- Sequential index enforcement

### ⚠️ NOT Implemented (Deferred to v0.2.0)

- Proof signature verification (structure validated, not cryptographically verified)
- Access control (any caller can append)
- Rate limiting

**⚠️ This is a BETA release - NOT production-ready!**

---

## 📚 Documentation

- [README.md](./packages/nucleus/README.md) - Quick start & installation
- [CHANGELOG.md](./packages/nucleus/CHANGELOG.md) - Release notes
- [CONTEXT.md](./CONTEXT.md) - Full architecture overview
- [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md) - Design rationales

---

## 🐛 Known Issues

1. **better-sqlite3**: Native binding issues on some platforms (optional dependency)
2. **ESM Only**: CommonJS support planned for v0.1.1

---

## 🛣️ Roadmap

### v0.1.1 (Patch)

- CommonJS compatibility fix

### v0.2.0 (Next)

- Proof signature verification
- Access control policies
- PostgreSQL storage adapter

### v1.0.0 (Stable)

- Production-ready with security audit
- Performance optimization
- Comprehensive documentation site

---

## 📦 Package Details

- **Package:** [@onoal/nucleus](https://www.npmjs.com/package/@onoal/nucleus)
- **Version:** 0.1.0-beta
- **License:** MIT
- **Author:** ONOAL

---

## 🙏 Feedback

We'd love your feedback!

- **Issues:** [Report bugs](https://github.com/onoal/nucleus/issues)
- **Discussions:** [Ask questions](https://github.com/onoal/nucleus/discussions)
- **Discord:** Join the ONOAL community

---

## ⚡ Breaking Changes

None (initial release)

---

**Installation:**

```bash
npm install @onoal/nucleus@beta
```

**Try it out and let us know what you think!** 🚀
