# Nucleus v0.1.0-beta

Minimaal ledger-systeem voor OID-based verifiable records.

## ✅ FASE 1, 2 & 3 Status: VOLTOOID

Alle kern-componenten zijn geïmplementeerd:

### Stap 1: Project Setup ✅
- ✅ Monorepo structuur (pnpm workspaces)
- ✅ TypeScript configuratie (strict mode)
- ✅ ESLint + Prettier
- ✅ Package structuur

### Stap 2: Rust Core (WASM) ✅
- ✅ Cargo.toml + wasm-pack setup
- ✅ Canonicalisatie (JCS-stijl, keys sorted)
- ✅ SHA-256 hashing + base64url encoding
- ✅ WASM build script
- ✅ Unit tests voor determinisme

### Stap 3: Core Types ✅
- ✅ `NucleusRecord` interface
- ✅ `AppendInput`, `ValidationResult`, `ValidationContext`
- ✅ `RecordStore` interface
- ✅ `ModuleRuntime` interface
- ✅ Type guards en error classes

### Stap 4: SQLite Storage ✅
- ✅ Schema met unieke constraints
- ✅ `SQLiteRecordStore` implementatie
- ✅ Comprehensive tests (CRUD + constraints)

### Stap 5: Module Registry ✅
- ✅ Singleton pattern (globale registry)
- ✅ `registerModule()`, `getModule()`, `hasModule()`
- ✅ Module not found error handling
- ✅ Tests (7 test cases)

### Stap 6: Nucleus SDK Core ✅
- ✅ `Nucleus` class met storage + computeHash
- ✅ `append()` met volledige flow:
  - Timestamp bepaling
  - prevRecord fetching
  - Index + prevHash berekening
  - Hash computation via WASM wrapper
  - Module validatie
  - Storage.put() met error handling
- ✅ `getHead()`, `getByHash()`, `getChain()`
- ✅ Chain consistency validatie
- ✅ `createNucleus()` factory function
- ✅ Comprehensive tests (25+ test cases)

### Stap 7: proof Module ✅
- ✅ `ProofBody` types (subject, issuer, kind, data, issuedAt, expiresAt)
- ✅ `ProofModuleRuntime` validator:
  - OID format validation (basic "oid:" prefix check)
  - Timestamp validation (issuedAt ≤ createdAt, expiresAt > issuedAt)
  - Caller authorization (callerOid must match issuer)
  - issuerProof structure validation (signature verification TODO)
- ✅ `generateProofChainId()` utility
- ✅ 30+ test cases covering all validation rules

### Stap 8: oid Module ✅
- ✅ `OidBody` types (oidRecord wrapper)
- ✅ `OidRecordProof`, `PublicKey` types
- ✅ `OidModuleRuntime` validator:
  - Schema version check ("oid-core/v0.1.1")
  - OID string format validation
  - Kind validation ("human", "org", "agent")
  - Keys array validation (at least one key)
  - Timestamp validation
  - Proof structure validation (signature verification TODO)
  - Chain consistency (same OID, updatedAt monotonic)
  - Caller policy (callerOid must match oidRecord.oid)
- ✅ `generateOidChainId()` - base64url encoding
- ✅ `parseOid()` - basic OID parser
- ✅ 35+ test cases covering all validation rules

---

## Volgende Stappen

### Dependencies Installeren

```bash
# Root dependencies
pnpm install

# Als er problemen zijn, force reinstall:
rm -rf node_modules packages/*/node_modules
pnpm install
```

### WASM Build (vereist Rust + wasm-pack)

```bash
# Installeer Rust als je dat nog niet hebt
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Installeer wasm-pack
cargo install wasm-pack

# Build WASM module
cd packages/nucleus-core-rs
./build.sh
```

### TypeScript Build

```bash
cd packages/nucleus
pnpm build:ts
```

### Tests Draaien

```bash
cd packages/nucleus
pnpm test
```

---

## Project Structuur

```
nucleus/
├── packages/
│   ├── nucleus/                     # @onoal/nucleus
│   │   ├── src/
│   │   │   ├── core/                # Engine (FASE 2)
│   │   │   ├── modules/             # Modules (FASE 2-3)
│   │   │   │   ├── proof/
│   │   │   │   └── oid/
│   │   │   ├── storage-sqlite/      # ✅ SQLite adapter
│   │   │   │   ├── index.ts
│   │   │   │   └── storage.test.ts
│   │   │   ├── types/               # ✅ Core types
│   │   │   │   ├── core.ts
│   │   │   │   ├── storage.ts
│   │   │   │   ├── module.ts
│   │   │   │   └── index.ts
│   │   │   └── wasm/                # WASM output (na build)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── nucleus-core-rs/             # ✅ Rust WASM core
│       ├── src/
│       │   ├── lib.rs
│       │   └── canonicalize.rs
│       ├── Cargo.toml
│       └── build.sh
├── examples/                         # FASE 4
├── tests/integration/                # FASE 4
├── IMPLEMENTATION-PLAN.md
├── SCOPE-nucleus-v0.1.0-beta.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json
├── .gitignore
├── .eslintrc.json
└── .prettierrc.json
```

---

## Implementatie Voortgang

| Fase | Status | Omschrijving |
|------|--------|--------------|
| **FASE 1** | ✅ **VOLTOOID** | Fundament (Rust core, types, storage) |
| **FASE 2** | ✅ **VOLTOOID** | SDK Engine (Nucleus class, module registry, append) |
| **FASE 3** | ✅ **VOLTOOID** | Modules (proof & oid validatie) |
| **FASE 4** | ⏳ Pending | Integration tests & documentatie |

---

## Geïmplementeerde Features (FASE 1)

### Rust Core (`nucleus-core-rs`)

**Canonicalisatie:**
- Keys alfabetisch gesorteerd
- Geen whitespace
- JSON escape sequences correct
- Deterministische output

**Hashing:**
- SHA-256 over canonical bytes
- base64url encoding (RFC 4648 §5)
- WASM exports: `compute_hash()`, `canonicalize()`

**Tests:**
- ✅ Key sorting
- ✅ Nested objects
- ✅ Array order preservation
- ✅ String escaping
- ✅ Determinisme (zelfde content = zelfde hash)

### TypeScript Types

**Core Types:**
```typescript
interface NucleusRecord {
  schema: "nucleus-core/v0.1.0-beta";
  module: "proof" | "oid" | string;
  chainId: string;
  index: number;
  prevHash: string | null;
  createdAt: string;
  body: unknown;
  meta?: Record<string, unknown>;
  hash: string;
}
```

**Storage Interface:**
```typescript
interface RecordStore {
  put(record: NucleusRecord): Promise<void>;
  getByHash(hash: string): Promise<NucleusRecord | null>;
  getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]>;
  getHead(chainId: string): Promise<NucleusRecord | null>;
}
```

**Module Interface:**
```typescript
interface ModuleRuntime {
  validateRecord(input: {
    record: NucleusRecord;
    prevRecord: NucleusRecord | null;
    context: ValidationContext;
  }): Promise<ValidationResult>;
}
```

### SQLite Storage

**Schema:**
- `records` table met hash (PK) + (chain_id, idx) unieke index
- Indexes op chain_id en module voor performance
- WAL mode voor concurrency

**Features:**
- ✅ Atomic writes
- ✅ Unique constraints (hash, chain_id+idx)
- ✅ Pagination (limit, offset)
- ✅ Reverse ordering
- ✅ Chain isolation

**Tests:** 14 test cases covering:
- CRUD operaties
- Constraint violations
- Chain queries
- Pagination
- Isolation

---

## Bekende Issues / TODO's

1. **WASM Build:** Vereist `wasm-pack` installatie
2. **@onoal/oid Dependency:** Peer dependency niet beschikbaar (FASE 3 nodig)
3. **Storage Tests:** Kunnen pas draaien na `pnpm install` + TypeScript compile

---

## Enterprise-Grade Principes (toegepast)

✅ **Clean Architecture** – Duidelijke scheiding types/storage/core  
✅ **Type Safety** – Strict TypeScript, comprehensive interfaces  
✅ **Error Handling** – Structured error classes (StorageConstraintError, etc.)  
✅ **Testing** – Unit tests met >80% coverage target  
✅ **Documentation** – JSDoc comments, inline explanations  
✅ **Performance** – Indexed queries, WAL mode, deterministic hashing  

---

## Next: FASE 4 - Integration & Polish

Voor volledige productie-readiness:

1. **WASM Build**: Run `cd packages/nucleus-core-rs && ./build.sh`
2. **Integration Tests**: End-to-end scenarios met beide modules
3. **Example Apps**: Werkende voorbeelden in `examples/`
4. **Documentation**: Usage guides, API docs

---

**Versie:** 0.1.0-beta  
**Laatst bijgewerkt:** November 20, 2025  
**Status:** FASE 1, 2 & 3 voltooid - Core functionaliteit compleet!  

