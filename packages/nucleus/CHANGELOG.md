# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-beta] - 2025-11-20

### Added

#### Core Features

- **Nucleus SDK**: Main ledger engine with `append()`, `getHead()`, `getByHash()`, `getChain()` methods
- **Module System**: Pluggable validation runtime with singleton registry
- **Storage Adapters**: `RecordStore` interface for pluggable storage backends
- **SQLite Storage**: `SQLiteRecordStore` with atomic writes, unique constraints, and indexed queries
- **WASM Core**: Rust-based deterministic JSON canonicalization (JCS) and SHA-256 hashing
- **Chain Integrity**: Automatic `prevHash` linking and sequential index enforcement

#### Modules

- **OID Module**: Anchoring of OID Core Records per namespace
  - Integration with `@onoal/oid-core` v0.1.1 for official validation
  - Support for OID key structure (usage, alg, publicKey)
  - Chain consistency validation (same OID, monotonic updatedAt)
  - Caller authorization checks
- **Proof Module**: OID-native attestations/proofs
  - Subject and issuer OID validation
  - Claim structure validation
  - Timestamp validation with context support

#### Developer Experience

- **TypeScript-first**: Full type definitions with strict mode
- **Monorepo Structure**: pnpm workspaces + Turbo for build orchestration
- **Comprehensive Tests**: 73 passing tests for core functionality
- **Examples**: `basic-usage.ts` demonstrating OID and proof workflows
- **Documentation**: README with installation, usage, and development guides

### Technical Details

#### Architecture

- **Record Schema**: `nucleus-core/v0.1.0-beta` with deterministic hashing
- **Module Registry**: Singleton pattern for runtime registration
- **Factory Pattern**: Dynamic WASM import with `createNucleus()`
- **Error Handling**: Typed error classes (`ValidationError`, `StorageConstraintError`, `HashMismatchError`)

#### Dependencies

- `@onoal/oid-core`: ^0.1.0 (peer dependency)
- `better-sqlite3`: ^9.2.2 (optional, for storage adapter)

#### Build Output

- ES Modules only
- Dual exports: main package + `./storage-sqlite` subpath
- Source maps included
- TypeScript declarations

### Known Limitations

- SQLite storage requires native compilation (better-sqlite3)
- OID record signature verification not implemented (structural validation only)
- Proof signature verification not implemented (structural validation only)
- No network/HTTP resolution features
- In-memory mode only for testing (`:memory:`)

### Breaking Changes

None (initial beta release)

### Migration Guide

N/A (initial release)

### Credits

Built with:

- Rust + wasm-bindgen for WASM core
- TypeScript 5.3+ for SDK
- Vitest for testing
- pnpm + Turbo for monorepo management

---

## [Unreleased]

### Planned for v0.2.0

- Signature verification for OID records
- Signature verification for proofs
- Additional storage adapters (PostgreSQL, Redis)
- Network resolution support
- Performance optimizations
- Additional module types

---

[0.1.0-beta]: https://github.com/onoal/nucleus/releases/tag/v0.1.0-beta
