# Nucleus

> Minimal, TypeScript-first ledger system for OID-based verifiable records

[![npm version](https://badge.fury.io/js/@onoal%2Fnucleus.svg)](https://www.npmjs.com/package/@onoal/nucleus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-73%2F73%20tests-brightgreen)](./packages/nucleus/src)
[![Security: Beta](https://img.shields.io/badge/security-beta%20%E2%9A%A0%EF%B8%8F-orange)](./SECURITY.md)

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

### ⚠️ Beta Security Notice

**This is a BETA release - NOT production-ready!**

Nucleus v0.1.x provides foundational cryptographic integrity but lacks several critical security features. **Do not use for production systems or sensitive data.**

### ✅ Implemented (v0.1.x)

| Feature                        | Status         | Details                                                                |
| ------------------------------ | -------------- | ---------------------------------------------------------------------- |
| **OID Signature Verification** | ✅ Implemented | Full cryptographic validation via `@onoal/oid-core` (Ed25519-JCS-2025) |
| **Chain Integrity**            | ✅ Implemented | SHA-256 hashing with `prevHash` linkage                                |
| **Deterministic Hashing**      | ✅ Implemented | JCS canonicalization via Rust/WASM                                     |
| **Timestamp Validation**       | ✅ Implemented | ISO-8601 format + monotonic ordering checks                            |
| **Sequential Indices**         | ✅ Implemented | Database constraints enforce uniqueness                                |
| **Type Safety**                | ✅ Implemented | Strict TypeScript with runtime validation                              |

### ❌ Known Limitations (v0.1.x)

| Limitation                       | Impact    | Planned                                                             |
| -------------------------------- | --------- | ------------------------------------------------------------------- | ------ |
| **Proof Signature Verification** | ⚠️ HIGH   | Proof records validate structure only, NOT cryptographic signatures | v0.2.0 |
| **Access Control**               | ⚠️ HIGH   | Any caller can append records (no authentication/authorization)     | v0.2.0 |
| **Rate Limiting**                | ⚠️ MEDIUM | No protection against spam/abuse                                    | v0.2.0 |
| **Audit Logging**                | ⚠️ MEDIUM | No built-in audit trail for security events                         | v0.3.0 |
| **Key Rotation**                 | ⚠️ MEDIUM | No mechanism for rotating compromised keys                          | v0.3.0 |
| **Revocation**                   | ⚠️ LOW    | No built-in support for revoking records                            | v0.4.0 |

### 🛡️ Security Best Practices

If you choose to experiment with Nucleus in beta:

1. **Do NOT store sensitive data** (PII, credentials, secrets)
2. **Use isolated environments** (never share databases across trust boundaries)
3. **Validate all inputs** (never trust user-provided OIDs or chainIds)
4. **Monitor for abuse** (implement external rate limiting)
5. **Plan for data migration** (schema may change before v1.0)
6. **Report security issues** via [security@onoal.org](mailto:security@onoal.org) (not public issues)

### 📋 Security Roadmap

- **v0.2.0** - Proof signatures, access control, rate limiting
- **v0.3.0** - Audit logging, key rotation
- **v0.4.0** - Revocation support, compliance tools
- **v1.0.0** - Third-party security audit before stable release

### 🔐 Cryptographic Dependencies

Nucleus relies on battle-tested cryptographic primitives:

- **SHA-256**: Rust `sha2` crate (WASM) - [FIPS 180-4](https://doi.org/10.6028/NIST.FIPS.180-4)
- **Ed25519**: `@onoal/oid-core` via `@noble/curves` - [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)
- **JCS Canonicalization**: Custom Rust implementation - [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)

### 📢 Vulnerability Disclosure

We take security seriously. If you discover a vulnerability:

1. **DO NOT** open a public GitHub issue
2. **Email** [security@onoal.org](mailto:security@onoal.org) with details
3. **Include** steps to reproduce, impact assessment, and suggested fixes
4. **Allow** 90 days for coordinated disclosure

We will acknowledge receipt within 48 hours and provide status updates.

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
