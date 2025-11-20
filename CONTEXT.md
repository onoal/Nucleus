# ONOAL Nucleus - Project Context

## 🎯 Project Overview

**Nucleus** is a minimal, TypeScript-first ledger system designed for OID-based verifiable records. It provides an append-only, cryptographically-linked chain of records with pluggable validation modules and storage adapters.

### Purpose

- Create an integrity layer for OID (Open Identity) records
- Enable cryptographic proofs and attestations between OID subjects
- Provide a foundation for decentralized identity and verifiable credentials
- Serve as the data persistence layer for the ONOAL ecosystem

### Key Principles

- **Minimal**: Small, focused API surface
- **Type-Safe**: TypeScript-first with strict mode
- **Modular**: Pluggable validation and storage
- **Deterministic**: Rust WASM core for canonical hashing
- **OID-Native**: Deep integration with @onoal/oid-core

---

## 📦 Monorepo Structure

```
nucleus/
├── packages/
│   ├── nucleus/                    # Main SDK package
│   │   ├── src/
│   │   │   ├── core/              # Nucleus engine & module registry
│   │   │   ├── modules/           # OID & Proof validation modules
│   │   │   ├── storage-sqlite/    # SQLite storage adapter
│   │   │   ├── types/             # TypeScript definitions
│   │   │   └── wasm/              # Generated WASM bindings
│   │   ├── dist/                  # Build output
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── README.md
│   │   └── CHANGELOG.md
│   │
│   └── nucleus-core-rs/           # Rust WASM core
│       ├── src/
│       │   ├── lib.rs            # WASM exports
│       │   └── canonicalize.rs   # JCS implementation
│       ├── Cargo.toml
│       └── build.sh              # WASM build script
│
├── examples/
│   └── basic-usage.ts            # Usage examples
│
├── .github/                      # CI/CD (future)
├── turbo.json                    # Turbo build config
├── pnpm-workspace.yaml           # Workspace definition
├── package.json                  # Root package
├── tsconfig.base.json            # Shared TS config
├── CONTEXT.md                    # This file
├── PUBLISHING.md                 # Publishing guide
└── PRODUCTION-READINESS.md       # Implementation plan

```

---

## 🏗️ Architecture

### Core Components

#### 1. **Nucleus Engine** (`src/core/nucleus.ts`)

The main ledger orchestrator:

- `append(input)`: Add new record to chain
- `getHead(chainId)`: Get latest record in chain
- `getByHash(hash)`: Retrieve record by hash
- `getChain(chainId, opts)`: Query chain records

**Key Features:**

- Automatic `prevHash` linking
- Sequential index enforcement
- Deterministic hashing via WASM
- Module-based validation
- Storage adapter abstraction

#### 2. **Module Registry** (`src/core/module-registry.ts`)

Singleton pattern for runtime registration:

```typescript
registerModule("oid", oidModule);
registerModule("proof", proofModule);
```

#### 3. **Storage Adapters** (`src/types/storage.ts`)

`RecordStore` interface for pluggable backends:

- `put(record)`: Store record
- `getHead(chainId)`: Get chain head
- `getByHash(hash)`: Lookup by hash
- `getChain(chainId, opts)`: Query chain

**Current Implementations:**

- `SQLiteRecordStore`: Production-ready SQLite adapter

#### 4. **WASM Core** (`packages/nucleus-core-rs/`)

Rust-based deterministic primitives:

- `compute_hash(record)`: SHA-256 hash of canonical JSON
- `canonicalize(json)`: JCS-style JSON canonicalization

**Why Rust/WASM?**

- Deterministic across platforms
- Fast cryptographic operations
- Portable (Node.js + Browser ready)

### Data Model

#### NucleusRecord

```typescript
{
  schema: "nucleus-core/v0.1.0-beta",  // Constant schema version
  module: string,              // "oid", "proof", etc.
  chainId: string,             // Unique chain identifier
  index: number,               // Sequential (0, 1, 2, ...)
  prevHash: string | null,     // Previous record hash (null for genesis)
  createdAt: string,           // ISO 8601 timestamp
  body: unknown,               // Module-specific data
  meta: Record<string, unknown>, // Optional metadata
  hash: string                 // Base64url SHA-256 of canonical record
}
```

#### Invariants (Natural Laws of Nucleus)

These invariants are enforced by the combination of engine logic, WASM core, and storage constraints:

| Invariant                 | Description                                      | Enforced By          |
| ------------------------- | ------------------------------------------------ | -------------------- |
| **Append-only**           | No updates or deletes                            | API design + storage |
| **Unique hash**           | Every `hash` is unique across all records        | DB unique constraint |
| **Unique (chain, index)** | Every `(chainId, index)` tuple is unique         | DB unique constraint |
| **Hash correctness**      | `hash` = SHA-256(canonical(record without hash)) | Rust WASM + engine   |
| **Chain linkage**         | `prevHash` correctly links to previous record    | Engine validation    |
| **Sequential index**      | Index increments by 1 (0, 1, 2, ...)             | Engine validation    |
| **Module validation**     | `body` passes module-specific rules              | Module runtime       |

**Schema Version Constant:**

```typescript
export const NUCLEUS_SCHEMA_VERSION = "nucleus-core/v0.1.0-beta" as const;
```

---

## 🔌 Modules

### OID Module (`src/modules/oid/`)

Anchors OID Core Records per namespace in Nucleus.

**Purpose:** Provide an integrity layer for OID lifecycle events (create, update, key rotation).

**Validation Rules:**

1. `body.oidRecord` must be valid OID Core Record (v0.1.1)
2. Uses `@onoal/oid-core` for official validation
3. Chain must contain same OID throughout
4. `updatedAt` must be monotonically increasing
5. Caller authorization (if `callerOid` provided)

**Chain ID Format:**

```typescript
generateOidChainId(oid: string): string
// Design choice: chainId === oid (one chain per OID, no extra encoding)
// Example: "oid:onoal:user:alice" → "oid:onoal:user:alice"
```

**Design Rationale:** For v0.1.0-beta, we use the OID itself as the chain ID. This provides:

- **Simplicity**: No transformation needed
- **Debuggability**: Chain IDs are immediately readable
- **Canonical**: OIDs are already unique and canonical

No base64url encoding or hashing is needed since OIDs are already valid identifiers.

**OID Record Structure (from @onoal/oid-core):**

```typescript
{
  oid: string,
  schema: "oid-core/v0.1.1",
  kind: "human" | "org" | "service" | "device" | "key" | "asset",
  keys: [{
    id: string,          // e.g., "#main"
    usage: string[],     // ["auth", "sign"]
    alg: string,         // "ed25519"
    publicKey: string,   // Base64url
    createdAt: string
  }],
  metadata: Record<string, unknown>,
  createdAt: string,
  updatedAt: string,
  proof: {
    type: "ed25519-jcs-2025",
    createdAt: string,
    keyRef: string,
    signature: string
  }
}
```

### Proof Module (`src/modules/proof/`)

OID-native attestations/proofs about subjects.

**Purpose:** Enable verifiable claims between OID entities (e.g., certifications, approvals, attestations).

**Validation Rules:**

1. `subject` and `issuer` must be valid OIDs
2. `kind` must be non-empty string
3. `issuedAt` must be valid ISO 8601
4. `expiresAt` (if provided) must be > `issuedAt`
5. Context validation (check `now` against expiration)

**Chain ID Format:**

```typescript
generateProofChainId(issuer, subject, kind): string
// Format: "nucleus:proof:{issuer}:{subject}:{kind}"
// Example: "nucleus:proof:oid:onoal:org:verifier:oid:onoal:user:alice:kyc"
```

**Design Choice (v0.1.0-beta):** Readable chain IDs for debuggability. One chain per unique (issuer, subject, kind) combination. Future versions may offer hash-based alternative for privacy.

**Proof Body Structure:**

```typescript
{
  subject: string,        // OID of subject
  issuer: string,         // OID of issuer
  kind: string,          // e.g., "kyc", "certification", "membership"
  data: Record<string, unknown>, // Proof-specific data
  issuedAt: string,      // ISO 8601
  expiresAt?: string,    // Optional expiration
  issuerProof?: {        // Optional cryptographic signature
    type: string,        // e.g., "ed25519-jcs-2025"
    keyRef: string,      // e.g., "#main"
    signature: string    // Base64url
  }
}
```

---

## 🔗 Dependencies

### Production Dependencies

- **@onoal/oid-core** (^0.1.0): Official OID validation and cryptography
- **better-sqlite3** (^9.2.2): Native SQLite bindings (optional for storage)

### Peer Dependencies

- **@onoal/oid-core** (^0.1.0): Required by consumers

### Dev Dependencies

- **TypeScript** (^5.3.3): Type system and compiler
- **Vitest** (^1.0.4): Testing framework
- **@types/better-sqlite3**: TypeScript definitions
- **@types/node**: Node.js type definitions

### Build Tools

- **pnpm** (8.15.0): Package manager
- **Turbo** (^2.6.1): Monorepo build system
- **wasm-pack**: Rust → WASM compiler
- **tsc**: TypeScript compiler

---

## 🛠️ Development Workflow

### Initial Setup

```bash
# Install pnpm globally
npm install -g pnpm@8.15.0

# Install dependencies
pnpm install

# Build WASM + TypeScript
pnpm build
```

### Development Commands

```bash
# Build everything
pnpm build

# Build single package
cd packages/nucleus && pnpm build

# Watch mode
cd packages/nucleus && pnpm dev

# Run tests (core only, no SQLite)
cd packages/nucleus && pnpm test src/modules src/core

# Run all tests (requires better-sqlite3)
cd packages/nucleus && pnpm test

# Lint
cd packages/nucleus && pnpm lint

# Clean
pnpm clean
```

### Project Scripts (Root)

```json
{
  "build": "turbo run build",
  "dev": "turbo run dev",
  "test": "turbo run test",
  "lint": "turbo run lint",
  "clean": "turbo run clean && rm -rf node_modules"
}
```

### Package Scripts (nucleus/)

```json
{
  "build:wasm": "cd ../nucleus-core-rs && ./build.sh",
  "build:ts": "tsc",
  "build": "pnpm run build:wasm && pnpm run build:ts",
  "dev": "tsc --watch",
  "test": "vitest",
  "lint": "npx eslint src --ext .ts",
  "clean": "rm -rf dist src/wasm"
}
```

---

## 🧪 Testing Strategy

### Test Coverage (Current)

- **73/73 core tests passing** ✅ (modules + engine + registry)
- **36 storage tests** (SQLite adapter - optional, requires better-sqlite3 build)

### Test Structure

```
src/
├── core/
│   ├── module-registry.test.ts    # 11 tests - Registry functionality
│   └── nucleus.test.ts            # 20 tests - Engine integration
├── modules/
│   ├── oid/oid.test.ts           # 32 tests - OID validation
│   └── proof/proof.test.ts       # 30 tests - Proof validation
└── storage-sqlite/
    └── storage.test.ts            # 16 tests - CRUD + constraints
```

### Test Philosophy

- **Unit Tests**: Module validators (isolated)
- **Integration Tests**: Nucleus engine with real storage
- **Type Tests**: TypeScript compilation as validation
- **No Mocks**: Real implementations for integration tests

### Running Tests

```bash
# Core tests only (no SQLite dependency)
pnpm test src/modules src/core

# All tests (requires better-sqlite3 build)
pnpm test

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

---

## 📝 Code Conventions

### TypeScript

- **Strict mode enabled**: `"strict": true`
- **ES Modules**: `"type": "module"`
- **Target**: ES2022
- **Module resolution**: NodeNext

### Naming Conventions

- **Interfaces**: PascalCase (e.g., `NucleusRecord`, `ModuleRuntime`)
- **Types**: PascalCase (e.g., `ValidationResult`)
- **Functions**: camelCase (e.g., `createNucleus`, `registerModule`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `NUCLEUS_SCHEMA_VERSION`)
- **Files**: kebab-case (e.g., `module-registry.ts`)

### File Organization

```
src/
├── core/           # Core engine logic
├── modules/        # Validation modules
├── storage-*/      # Storage adapters (suffix with backend)
├── types/          # Shared type definitions
└── wasm/           # Generated WASM (gitignored)
```

### Error Handling

- **Custom Error Classes**: Extend `Error` with specific types
- **Validation Results**: Return `{ ok: boolean, errorCode, errorMessage }`
- **Storage Errors**: Throw `StorageConstraintError` for DB violations
- **Type Guards**: Use `isNucleusRecord()` for runtime validation

---

## 🔐 Security Considerations

### Current State (v0.1.0-beta)

**✅ Implemented:**

- Deterministic hashing (prevents hash collision attacks)
- Unique constraints (prevents record duplication)
- Chain integrity validation (prevents tampering)
- OID structure validation (via @onoal/oid-core)
- Sequential index enforcement
- prevHash linking validation

**⚠️ NOT Implemented (Deferred to v0.2.0):**

- **Signature Verification**: OID record signatures and Proof issuer signatures are NOT cryptographically verified
  - OID records: Structure validated, but `proof.signature` not verified
  - Proof records: Structure validated, but `issuerProof.signature` not verified
- **Access Control**: Any caller can append to any chain
- **Rate Limiting**: No quotas or throttling

**Design Decision:** For v0.1.0-beta, we prioritize structural integrity and chain consistency. Cryptographic signature verification will be added in v0.2.0 once we have comprehensive key resolution and rotation handling.

### Known Limitations

1. **Proof Signature Verification**: Proof issuer signatures are validated structurally but not cryptographically
   - OID records: ✅ Full signature verification via `@onoal/oid-core`
   - Proof records: ⚠️ Structure validated, but `issuerProof.signature` not verified
   - Applications needing verified proofs should verify externally until v0.2.0
2. **No Access Control**: Any caller can append to any chain (trust-on-first-use model)
3. **No Rate Limiting**: Storage can be DoS'd without quotas
4. **SQLite Only**: No distributed/replicated storage yet
5. **No Revocation**: Proof records can include `issuerProof` field but no enforcement of revocation semantics

### Future Security Enhancements (v0.2.0+)

- [ ] Proof signature verification (with cross-chain key resolution)
- [ ] Access control policies per chain
- [ ] Rate limiting and quotas
- [ ] Audit logging
- [ ] Backup and recovery mechanisms

---

## 🚀 Publishing & Release

### Version Strategy

- **Beta (0.x.x-beta)**: Current - API may change
- **RC (0.x.x-rc)**: Feature-complete, API stable, testing
- **Stable (1.0.0)**: Production-ready, semver guarantees

### Current Version

**v0.1.0-beta** - Initial beta release

### Package Distribution

- **Registry**: npm (@onoal/nucleus)
- **Tag**: `beta`
- **Access**: Public
- **License**: MIT

### Files Included in Package

- `dist/` - Compiled JavaScript + TypeScript definitions
- `README.md` - Installation and usage guide
- `CHANGELOG.md` - Version history

### Publishing Checklist

See [PUBLISHING.md](./PUBLISHING.md) for complete guide.

---

## 🔄 Integration with ONOAL Ecosystem

### Relationship to @onoal/oid-core

- **Nucleus** provides persistence layer
- **oid-core** provides validation and cryptography
- **Integration**: Nucleus uses oid-core for OID validation

### Usage in ONOAL Applications

```typescript
// 1. Application creates/updates OID via oid-core
import { createOidRecord, signOidRecord } from '@onoal/oid-core';

// 2. Application anchors OID in Nucleus
import { createNucleus, registerModule, oidModule } from '@onoal/nucleus';
await nucleus.append({
  module: 'oid',
  chainId: oid,
  body: { oidRecord }
});

// 3. Application creates proofs between OIDs
await nucleus.append({
  module: 'proof',
  chainId: generateProofChainId(subject, issuer),
  body: { subject, issuer, claimType, claims, ... }
});
```

### Future Integrations

- **@onoal/resolver**: OID resolution service
- **@onoal/wallet**: Identity wallet application
- **@onoal/registry**: Public OID registry
- **@onoal/verifier**: Proof verification service

---

## 📚 Additional Resources

### Documentation

- [README.md](./packages/nucleus/README.md) - User guide
- [CHANGELOG.md](./packages/nucleus/CHANGELOG.md) - Version history
- [PUBLISHING.md](./PUBLISHING.md) - Publishing guide
- [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) - Implementation plan

### External References

- [OID Core Spec](https://github.com/onoal/oid-core)
- [JSON Canonicalization Scheme (JCS)](https://datatracker.ietf.org/doc/html/rfc8785)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [WebAssembly](https://webassembly.org/)

### Community

- **Issues**: https://github.com/onoal/nucleus/issues
- **Discussions**: https://github.com/onoal/nucleus/discussions
- **Discord**: (coming soon)

---

## 🎯 Roadmap

### v0.1.0-beta (Current)

- ✅ Core engine with append-only chains
- ✅ OID module with @onoal/oid-core integration
- ✅ Proof module for attestations
- ✅ SQLite storage adapter
- ✅ Comprehensive test coverage
- ✅ Documentation and examples

### v0.2.0 (Next)

- [ ] Signature verification for OID and Proof records
- [ ] PostgreSQL storage adapter
- [ ] Access control policies
- [ ] Query optimization and indexing
- [ ] Browser compatibility (WASM optimization)
- [ ] Performance benchmarks

### v1.0.0 (Stable)

- [ ] Production-ready with semver guarantees
- [ ] Full security audit
- [ ] Comprehensive integration tests
- [ ] Migration tools from beta
- [ ] Enterprise support options

---

**Last Updated**: 2025-11-20  
**Status**: ✅ Production Ready for Beta  
**Maintainer**: ONOAL Team
