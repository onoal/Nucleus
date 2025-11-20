# Commit Message for v0.1.0-beta

```
chore: release v0.1.0-beta - initial beta release

## 🎉 Initial Beta Release

Nucleus v0.1.0-beta provides a minimal, TypeScript-first ledger system for OID-based verifiable records with cryptographic integrity guarantees.

### ✨ Features

**Core Engine:**
- Append-only ledger with sequential chain indices
- Deterministic hash computation via Rust/WASM
- Canonical JSON (JCS-style) for consistent serialization
- Module-based validation architecture
- Pluggable storage adapters

**OID Module:**
- Full OID signature verification via @onoal/oid-core
- OID record anchoring per namespace
- Chain consistency validation (monotonic timestamps, OID immutability)
- Caller authorization enforcement

**Proof Module:**
- OID-native attestations (subject + issuer + kind + data)
- Structural validation for proof records
- Optional issuerProof field (verified in v0.2.0)
- Timestamp validation and expiration support

**Storage:**
- SQLite adapter with ACID guarantees
- Unique constraints (hash, chainId+index)
- In-memory and file-based modes

### 🏗️ Architecture

- **Monorepo:** pnpm workspaces + Turbo
- **Type Safety:** Strict TypeScript with comprehensive types
- **WASM Core:** Rust-based canonical JSON + SHA-256 hashing
- **Module Registry:** Singleton pattern for runtime registration
- **7 Core Invariants:** Append-only, unique hashes, sequential indices, chain linkage

### 📊 Test Coverage

- **73/73 core tests passing** (modules, engine, registry)
- **36 storage tests** (optional, requires better-sqlite3 native build)

### 📚 Documentation

- Complete CONTEXT.md with architecture overview
- DESIGN-DECISIONS.md with explicit design rationales
- CHANGELOG.md with release notes
- PUBLISHING.md with deployment guide

### 🔒 Security

- ✅ OID signature verification (via @onoal/oid-core)
- ✅ Chain integrity validation
- ✅ Deterministic hashing
- ⚠️ Proof signature verification deferred to v0.2.0

### 🚀 Next Steps

See DESIGN-DECISIONS.md for future roadmap (v0.2.0: proof signature verification, v1.0.0: production-ready)

---

**Breaking Changes:** None (initial release)
**Migration Guide:** N/A (initial release)

```

## Git Command

```bash
git add .
git commit -F COMMIT_MESSAGE.md
git tag -a v0.1.0-beta -m "Release v0.1.0-beta: Initial beta release"
```
