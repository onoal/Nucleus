# Nucleus

> Minimal, TypeScript-first ledger system for OID-based verifiable records

[![npm version](https://badge.fury.io/js/@onoal%2Fnucleus.svg)](https://www.npmjs.com/package/@onoal/nucleus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 What is Nucleus?

Nucleus provides cryptographic integrity guarantees for append-only chains of identity and attestation records. It's designed to work seamlessly with the [ONOAL Open Identity (OID) system](https://github.com/onoal/oid).

### Key Features

- ✅ **OID Signature Verification** - Full cryptographic validation via `@onoal/oid-core`
- ✅ **Append-Only Chains** - Sequential indices with deterministic hashing
- ✅ **Module Architecture** - Pluggable validation for different record types
- ✅ **Type-Safe API** - Strict TypeScript with comprehensive type definitions
- ✅ **Storage Adapters** - Pluggable backends (SQLite in v0.1.x)

---

## 📦 Installation

```bash
npm install @onoal/nucleus@beta
```

### Requirements

- Node.js ≥ 18.0.0
- Optional: SQLite native bindings (for storage adapter)

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

// Append a record
const result = await nucleus.append({
  module: "oid",
  chainId: "oid:onoal:user:alice",
  body: { oidRecord: /* OID Core Record */ },
});

console.log("Record appended:", result.hash);
```

See [examples/basic-usage.ts](./examples/basic-usage.ts) for complete examples.

---

## 📚 Documentation

- **[CONTEXT.md](./CONTEXT.md)** - Complete architecture overview
- **[DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)** - Design rationales
- **[PUBLISHING.md](./PUBLISHING.md)** - Publishing guide
- **[CHANGELOG.md](./packages/nucleus/CHANGELOG.md)** - Release notes
- **[Package README](./packages/nucleus/README.md)** - Package-specific docs

---

## 🏗️ Architecture

### Core Components

1. **Nucleus Engine** - Main ledger orchestrator
2. **Module Registry** - Pluggable validation runtimes
3. **Storage Adapters** - Pluggable persistence backends
4. **WASM Core** - Rust-based deterministic primitives

### Modules

- **OID Module** - Anchors OID Core Records with full signature verification
- **Proof Module** - OID-native attestations (subject + issuer + kind + data)

### Storage

- **SQLite Adapter** - Production-ready with ACID guarantees

---

## 🔒 Security

### ✅ Implemented (v0.1.x)

- OID signature verification (cryptographic)
- Chain integrity validation
- Deterministic hashing (SHA-256 via Rust/WASM)
- Timestamp validation
- Sequential index enforcement

### ⚠️ Limitations (Beta)

- Proof signature verification not implemented (planned for v0.2.0)
- No access control (any caller can append)
- No rate limiting

**This is a BETA release - NOT production-ready!**

---

## 🧪 Development

### Prerequisites

```bash
# Install Rust (for WASM core)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
cargo install wasm-pack
```

### Setup

```bash
# Clone repository
git clone https://github.com/onoal/nucleus.git
cd nucleus

# Install dependencies
pnpm install

# Build WASM core
cd packages/nucleus-core-rs
./build.sh
cd ../..

# Build TypeScript
pnpm run build

# Run tests
pnpm test
```

### Testing

```bash
# Core tests only (no SQLite)
pnpm test src/modules src/core

# All tests (requires better-sqlite3 native build)
pnpm test

# Linting
pnpm run lint
```

---

## 📊 Test Coverage

- **73/73 core tests passing** ✅
  - 32 OID module tests
  - 30 Proof module tests
  - 11 Module registry tests

---

## 🛣️ Roadmap

### v0.2.0 (Next)

- Proof signature verification
- Access control policies
- PostgreSQL storage adapter
- Rate limiting

### v1.0.0 (Stable)

- Production-ready with security audit
- Performance optimization
- Comprehensive documentation site

---

## 🤝 Contributing

We welcome contributions! Please see our [contributing guidelines](./CONTRIBUTING.md) (coming soon).

### Areas for Contribution

- Additional storage adapters (PostgreSQL, IndexedDB)
- New module types
- Performance improvements
- Documentation and examples

---

## 📄 License

MIT © ONOAL

---

## 🔗 Links

- **npm Package:** [@onoal/nucleus](https://www.npmjs.com/package/@onoal/nucleus)
- **GitHub:** [onoal/nucleus](https://github.com/onoal/nucleus)
- **Issues:** [Report bugs](https://github.com/onoal/nucleus/issues)
- **Discussions:** [Ask questions](https://github.com/onoal/nucleus/discussions)
- **OID Core:** [@onoal/oid-core](https://github.com/onoal/oid-core)

---

## 💬 Support

- **GitHub Issues:** Bug reports and feature requests
- **GitHub Discussions:** Questions and community support
- **Discord:** ONOAL Community Server (coming soon)

---

**Version:** 0.1.1-beta  
**Status:** Beta - Ready for testing, not for production  
**Last Updated:** November 20, 2025
