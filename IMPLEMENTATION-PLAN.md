# Nucleus v0.1.0-beta Implementation Plan

## Hoofddoel

Een minimaal maar functioneel ledger-systeem voor:

- OID-records verankeren (oid module)
- Proofs/attestations over OIDs (proof module)
- TypeScript-first met Rust alleen voor canonicalisatie + hashing (WASM)

---

## Architectuur Overzicht

```
┌─────────────────────────────────────────┐
│  @onoal/nucleus (TypeScript)            │
│  - append(), getHead(), getByHash()     │
│  - Module registry & orchestration      │
└─────────────┬───────────────────────────┘
              │
        ┌─────┴─────┐
        │           │
   ┌────▼────┐ ┌───▼────────┐
   │ proof   │ │ oid        │
   │ module  │ │ module     │
   └─────────┘ └────────────┘
        │           │
   ┌────┴───────────▼────┐
   │ Storage Adapter     │
   │ (@onoal/nucleus/    │
   │  storage-sqlite)    │
   └─────────────────────┘

   ┌─────────────────────┐
   │ Rust Core (WASM)    │
   │ - compute_hash()    │
   │ - canonicalize()    │
   └─────────────────────┘
```

---

## Package Structuur

```
nucleus/
├── packages/
│   ├── nucleus/                          # @onoal/nucleus
│   │   ├── src/
│   │   │   ├── core/                     # Core engine
│   │   │   ├── modules/                  # Module implementations
│   │   │   │   ├── proof/
│   │   │   │   └── oid/
│   │   │   ├── storage-sqlite/           # @onoal/nucleus/storage-sqlite
│   │   │   ├── types/                    # TypeScript types
│   │   │   └── index.ts
│   │   └── package.json
│   └── nucleus-core-rs/                  # Rust WASM core
│       ├── src/
│       │   └── lib.rs
│       └── Cargo.toml
├── examples/                              # Usage examples
├── SCOPE-nucleus-v0.1.0-beta.md
├── IMPLEMENTATION-PLAN.md
└── package.json
```

---

## Implementatie Stappenplan

### **FASE 1: Fundament**

#### **Stap 1: Project Setup**

**Doel:** Monorepo structuur en build tooling opzetten

**Acties:**

- [ ] Initialiseer monorepo (pnpm workspaces of npm workspaces)
- [ ] Package structuur aanmaken:
  - `packages/nucleus/` → `@onoal/nucleus`
  - `packages/nucleus/src/storage-sqlite/` → `@onoal/nucleus/storage-sqlite`
  - `packages/nucleus-core-rs/` → Rust WASM
- [ ] TypeScript configuratie (strict mode enabled)
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    }
  }
  ```
- [ ] ESLint + Prettier configuratie
- [ ] Build tooling (tsup of tsc)
- [ ] Git ignore (node_modules, dist, target, .wasm artifacts)

**Deliverables:**

- Werkende monorepo structuur
- Build scripts in package.json
- TypeScript compileert zonder errors

---

#### **Stap 2: Rust Core (WASM)**

**Doel:** Deterministische canonicalisatie en hashing implementeren

**Acties:**

- [ ] Setup Rust workspace met `wasm-pack`
- [ ] Dependencies toevoegen:
  ```toml
  [dependencies]
  wasm-bindgen = "0.2"
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"
  sha2 = "0.10"
  base64 = "0.21"
  ```
- [ ] Implementeer canonicalisatie:
  ```rust
  pub fn canonicalize(record_without_hash: JsValue) -> Result<Vec<u8>, JsValue>
  ```
  - Keys alfabetisch sorteren
  - Geen whitespace
  - `hash` property exclusief
- [ ] Implementeer hashing:
  ```rust
  pub fn compute_hash(record_without_hash: JsValue) -> Result<String, JsValue>
  ```
  - SHA-256 over canonical bytes
  - base64url encoding
- [ ] WASM build configureren:
  ```bash
  wasm-pack build --target bundler --out-dir ../nucleus/src/wasm
  ```
- [ ] TypeScript bindings genereren

**Deliverables:**

- `compute_hash()` en `canonicalize()` functies
- WASM module bruikbaar vanuit TypeScript
- Unit tests voor canonicalisatie (determinisme)

---

#### **Stap 3: Core Types & Interfaces**

**Doel:** TypeScript types definiëren voor het hele systeem

**Acties:**

- [ ] `packages/nucleus/src/types/core.ts`:

  ```typescript
  export interface NucleusRecord {
    schema: "nucleus-core/v0.1.0-beta";
    module: "proof" | "oid";
    chainId: string;
    index: number;
    prevHash: string | null;
    createdAt: string; // ISO 8601 UTC
    body: any;
    meta?: Record<string, any>;
    hash: string;
  }

  export interface AppendInput {
    module: "proof" | "oid";
    chainId: string;
    body: any;
    meta?: Record<string, any>;
    context?: {
      callerOid?: string;
      now?: string;
    };
  }

  export interface GetChainOpts {
    limit?: number;
    offset?: number;
    reverse?: boolean;
  }

  export interface ValidationResult {
    ok: boolean;
    errorCode?: string;
    errorMessage?: string;
  }

  export interface ValidationContext {
    callerOid?: string;
    now: string;
  }
  ```

- [ ] `packages/nucleus/src/types/storage.ts`:

  ```typescript
  export interface RecordStore {
    put(record: NucleusRecord): Promise<void>;
    getByHash(hash: string): Promise<NucleusRecord | null>;
    getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]>;
    getHead(chainId: string): Promise<NucleusRecord | null>;
  }
  ```

- [ ] `packages/nucleus/src/types/module.ts`:
  ```typescript
  export interface ModuleRuntime {
    validateRecord(input: {
      record: NucleusRecord;
      prevRecord: NucleusRecord | null;
      context: ValidationContext;
    }): Promise<ValidationResult>;
  }
  ```

**Deliverables:**

- Volledige type definitions
- Type exports in `index.ts`
- JSDoc comments voor public API

---

#### **Stap 4: Storage Adapter Interface + SQLite**

**Doel:** SQLite implementatie van RecordStore interface

**Acties:**

- [ ] `packages/nucleus/src/storage-sqlite/index.ts`
- [ ] Dependencies:
  ```json
  {
    "dependencies": {
      "better-sqlite3": "^9.0.0"
    },
    "devDependencies": {
      "@types/better-sqlite3": "^7.6.0"
    }
  }
  ```
- [ ] Database schema:

  ```sql
  CREATE TABLE IF NOT EXISTS records (
    hash TEXT PRIMARY KEY NOT NULL,
    chain_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    module TEXT NOT NULL,
    json TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS records_chain_idx
    ON records(chain_id, idx);

  CREATE INDEX IF NOT EXISTS records_chain_id
    ON records(chain_id);

  CREATE INDEX IF NOT EXISTS records_module
    ON records(module);
  ```

- [ ] Implementeer `SQLiteRecordStore` class:
  ```typescript
  export class SQLiteRecordStore implements RecordStore {
    constructor(dbPath: string);
    async put(record: NucleusRecord): Promise<void>;
    async getByHash(hash: string): Promise<NucleusRecord | null>;
    async getChain(
      chainId: string,
      opts?: GetChainOpts
    ): Promise<NucleusRecord[]>;
    async getHead(chainId: string): Promise<NucleusRecord | null>;
    close(): void;
  }
  ```
- [ ] Error handling voor constraint violations
- [ ] Transaction support voor atomic writes

**Deliverables:**

- `@onoal/nucleus/storage-sqlite` export
- SQLite adapter volledig functioneel
- Tests voor CRUD operaties
- Tests voor unieke constraints

---

### **FASE 2: SDK Engine**

#### **Stap 5: Module Runtime Interface & Registry**

**Doel:** Pluggable module systeem (simpele singleton voor v0.1.0-beta)

**Acties:**

- [ ] `packages/nucleus/src/core/module-registry.ts`:

  ```typescript
  // Internal registry (singleton pattern voor v0.1.0-beta)
  const globalModules = new Map<string, ModuleRuntime>();

  export function registerModule(name: string, runtime: ModuleRuntime): void {
    if (globalModules.has(name)) {
      throw new Error(`Module already registered: ${name}`);
    }
    if (!name || typeof name !== "string") {
      throw new Error("Module name must be a non-empty string");
    }
    globalModules.set(name, runtime);
  }

  export function getModule(name: string): ModuleRuntime {
    const module = globalModules.get(name);
    if (!module) {
      throw new Error(`Module not registered: ${name}`);
    }
    return module;
  }

  export function hasModule(name: string): boolean {
    return globalModules.has(name);
  }

  // For testing: clear registry
  export function clearModules(): void {
    globalModules.clear();
  }
  ```

**Design rationale:**

- Singleton pattern: simpel voor developers in v0.1.0-beta
- Globaal state OK voor single-instance use case
- Later refactorbaar naar dependency injection voor multi-tenant

**Deliverables:**

- Singleton module registry
- Type-safe module registratie
- Tests voor registry operations

---

#### **Stap 6: Nucleus SDK Core Engine**

**Doel:** Hoofd-API implementeren met invarianten

**Acties:**

- [ ] `packages/nucleus/src/core/nucleus.ts`:

  ```typescript
  export class Nucleus {
    constructor(
      private storage: RecordStore,
      private computeHash: (record: any) => string
    ) {}

    async append(input: AppendInput): Promise<NucleusRecord>;
    async getHead(chainId: string): Promise<NucleusRecord | null>;
    async getByHash(hash: string): Promise<NucleusRecord | null>;
    async getChain(
      chainId: string,
      opts?: GetChainOpts
    ): Promise<NucleusRecord[]>;
  }
  ```

- [ ] **Append flow implementeren:**

  1. Timestamp bepalen (`context.now` of `new Date().toISOString()`)
  2. `prevRecord = await this.storage.getHead(chainId)`
  3. Bereken `index` en `prevHash`:
     - Als `prevRecord === null`: `index = 0`, `prevHash = null`
     - Anders: `index = prevRecord.index + 1`, `prevHash = prevRecord.hash`
  4. Bouw tijdelijk record zonder hash:
     ```typescript
     const recordWithoutHash = {
       schema: "nucleus-core/v0.1.0-beta",
       module: input.module,
       chainId: input.chainId,
       index,
       prevHash,
       createdAt: now,
       body: input.body,
       meta: input.meta || {},
     };
     ```
  5. Hash berekenen: `const hash = this.computeHash(recordWithoutHash)`
  6. Final record: `const record = { ...recordWithoutHash, hash }`
  7. Module validatie:

     ```typescript
     const moduleRuntime = getModule(input.module);

     const result = await moduleRuntime.validateRecord({
       record,
       prevRecord,
       context: { callerOid: input.context?.callerOid, now },
     });

     if (!result.ok) {
       throw new Error(`Validation failed: ${result.errorMessage}`);
     }
     ```

  8. Opslaan: `await this.storage.put(record)`
  9. Return: `return record`

- [ ] **Invarianten afdwingen:**

  - Hash uniek (via storage constraints)
  - (chainId, index) uniek (via storage constraints)
  - Chain-consistentie check in append
  - Append-only (geen update/delete methods)

- [ ] **Delegeer read operations:**

  ```typescript
  async getHead(chainId: string): Promise<NucleusRecord | null> {
    return this.storage.getHead(chainId);
  }

  async getByHash(hash: string): Promise<NucleusRecord | null> {
    return this.storage.getByHash(hash);
  }

  async getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]> {
    return this.storage.getChain(chainId, opts);
  }
  ```

- [ ] Factory function voor convenience:

  ```typescript
  export async function createNucleus(config: {
    storage: RecordStore;
    wasmPath?: string;
  }): Promise<Nucleus> {
    // Load WASM module
    const wasm = await import("./wasm/nucleus_core_rs");

    // Create compute hash function
    const computeHash = (record: any): string => {
      return wasm.compute_hash(record);
    };

    // Return Nucleus instance (modules registered separately via registerModule)
    return new Nucleus(config.storage, computeHash);
  }
  ```

**Usage pattern:**

```typescript
// 1. Register modules globally (before creating Nucleus)
import { registerModule } from '@onoal/nucleus';
import { oidModule, proofModule } from '@onoal/nucleus';

registerModule('oid', oidModule);
registerModule('proof', proofModule);

// 2. Create Nucleus instance
const nucleus = await createNucleus({
  storage: new SQLiteRecordStore('./nucleus.db')
});

// 3. Use nucleus (modules already registered)
await nucleus.append({ module: 'oid', ... });
```

**Deliverables:**

- Volledige Nucleus class implementatie
- Append flow met alle validaties
- Read operations
- Error handling voor alle edge cases
- Integration tests

---

### **FASE 3: Modules**

#### **Stap 7: proof Module**

**Doel:** Attestations over OID-subjects valideren

**Acties:**

- [ ] `packages/nucleus/src/modules/proof/types.ts`:

  ```typescript
  export interface ProofBody {
    subject: string; // OID
    issuer: string; // OID
    kind: string; // "kyc", "membership", etc.
    data: Record<string, any>;
    issuedAt: string; // ISO 8601
    expiresAt?: string; // ISO 8601
    issuerProof?: {
      type: "ed25519-jcs-2025";
      keyRef: string;
      signature: string;
    };
  }
  ```

- [ ] `packages/nucleus/src/modules/proof/validator.ts`:

  ```typescript
  import { parseOid } from "@onoal/oid";

  export class ProofModuleRuntime implements ModuleRuntime {
    async validateRecord(input: {
      record: NucleusRecord;
      prevRecord: NucleusRecord | null;
      context: ValidationContext;
    }): Promise<ValidationResult> {
      const body = input.record.body as ProofBody;

      // 1. Validate subject OID
      try {
        parseOid(body.subject);
      } catch {
        return {
          ok: false,
          errorCode: "INVALID_SUBJECT_OID",
          errorMessage: `Invalid subject OID: ${body.subject}`,
        };
      }

      // 2. Validate issuer OID
      try {
        parseOid(body.issuer);
      } catch {
        return {
          ok: false,
          errorCode: "INVALID_ISSUER_OID",
          errorMessage: `Invalid issuer OID: ${body.issuer}`,
        };
      }

      // 3. Validate kind
      if (!body.kind || typeof body.kind !== "string") {
        return {
          ok: false,
          errorCode: "INVALID_KIND",
          errorMessage: "kind must be a non-empty string",
        };
      }

      // 4. Validate data
      if (!body.data || typeof body.data !== "object") {
        return {
          ok: false,
          errorCode: "INVALID_DATA",
          errorMessage: "data must be an object",
        };
      }

      // 5. Validate issuedAt
      const issuedAt = new Date(body.issuedAt);
      const createdAt = new Date(input.record.createdAt);
      if (isNaN(issuedAt.getTime())) {
        return {
          ok: false,
          errorCode: "INVALID_ISSUED_AT",
          errorMessage: "issuedAt must be valid ISO 8601",
        };
      }
      if (issuedAt > createdAt) {
        return {
          ok: false,
          errorCode: "ISSUED_AT_FUTURE",
          errorMessage: "issuedAt cannot be after createdAt",
        };
      }

      // 6. Validate expiresAt if present
      if (body.expiresAt) {
        const expiresAt = new Date(body.expiresAt);
        if (isNaN(expiresAt.getTime())) {
          return {
            ok: false,
            errorCode: "INVALID_EXPIRES_AT",
            errorMessage: "expiresAt must be valid ISO 8601",
          };
        }
        if (expiresAt <= issuedAt) {
          return {
            ok: false,
            errorCode: "EXPIRES_AT_BEFORE_ISSUED",
            errorMessage: "expiresAt must be after issuedAt",
          };
        }
      }

      // 7. Validate caller is issuer
      if (input.context.callerOid && input.context.callerOid !== body.issuer) {
        return {
          ok: false,
          errorCode: "UNAUTHORIZED_ISSUER",
          errorMessage: "callerOid must match issuer",
        };
      }

      // 8. TODO: Validate issuerProof signature (optional in beta)
      // if (body.issuerProof) {
      //   // Verify signature using @onoal/oid + crypto lib
      // }

      return { ok: true };
    }
  }
  ```

- [ ] Export module instance:

  ```typescript
  export const proofModule = new ProofModuleRuntime();
  ```

- [ ] **ChainId convention** documenteren:
  - Aanbevolen: `nucleus:proof:{issuer}:{subject}:{kind}`
  - Eén chain per (issuer, subject, kind) combinatie
  - Makkelijk auditeerbaar

**Deliverables:**

- proof module volledig geïmplementeerd
- Alle validaties werkend
- Unit tests voor elk validatie scenario
- Integration tests met Nucleus.append()

---

#### **Stap 8: oid Module**

**Doel:** OID-records verankeren met validatie

**Acties:**

- [ ] `packages/nucleus/src/modules/oid/types.ts`:

  ```typescript
  import type { OidRecord } from "@onoal/oid";

  export interface OidBody {
    oidRecord: OidRecord;
  }
  ```

- [ ] `packages/nucleus/src/modules/oid/validator.ts`:

  ```typescript
  import {
    parseOid,
    validateOidRecord,
    verifyOidRecordSignature,
  } from "@onoal/oid";

  export class OidModuleRuntime implements ModuleRuntime {
    async validateRecord(input: {
      record: NucleusRecord;
      prevRecord: NucleusRecord | null;
      context: ValidationContext;
    }): Promise<ValidationResult> {
      const body = input.record.body as OidBody;
      const oidRecord = body.oidRecord;

      // 1. Validate schema version
      if (oidRecord.schema !== "oid-core/v0.1.1") {
        return {
          ok: false,
          errorCode: "INVALID_SCHEMA",
          errorMessage: `Expected oid-core/v0.1.1, got ${oidRecord.schema}`,
        };
      }

      // 2. Validate OID string
      try {
        parseOid(oidRecord.oid);
      } catch {
        return {
          ok: false,
          errorCode: "INVALID_OID",
          errorMessage: `Invalid OID: ${oidRecord.oid}`,
        };
      }

      // 3. Validate OID record structure
      const structureValidation = validateOidRecord(oidRecord);
      if (!structureValidation.valid) {
        return {
          ok: false,
          errorCode: "INVALID_OID_RECORD",
          errorMessage: structureValidation.error,
        };
      }

      // 4. Verify signature
      const signatureValid = await verifyOidRecordSignature(oidRecord);
      if (!signatureValid) {
        return {
          ok: false,
          errorCode: "INVALID_SIGNATURE",
          errorMessage: "OID record signature verification failed",
        };
      }

      // 5. Chain consistency checks
      if (input.prevRecord) {
        const prevBody = input.prevRecord.body as OidBody;
        const prevOidRecord = prevBody.oidRecord;

        // Same OID throughout chain
        if (prevOidRecord.oid !== oidRecord.oid) {
          return {
            ok: false,
            errorCode: "OID_MISMATCH",
            errorMessage: "OID cannot change within a chain",
          };
        }

        // updatedAt must increase
        const prevUpdated = new Date(prevOidRecord.updatedAt);
        const currUpdated = new Date(oidRecord.updatedAt);
        if (currUpdated <= prevUpdated) {
          return {
            ok: false,
            errorCode: "UPDATED_AT_NOT_INCREASING",
            errorMessage: "updatedAt must be later than previous record",
          };
        }
      }

      // 6. Caller policy
      if (input.context.callerOid) {
        // In beta: caller must be the OID itself
        // Later: extend with delegation/authorization
        if (input.context.callerOid !== oidRecord.oid) {
          return {
            ok: false,
            errorCode: "UNAUTHORIZED_CALLER",
            errorMessage: "callerOid must match oidRecord.oid",
          };
        }
      }

      return { ok: true };
    }
  }
  ```

- [ ] Export module instance:

  ```typescript
  export const oidModule = new OidModuleRuntime();
  ```

- [ ] **ChainId utilities** voor aanbevolen patroon:

  ```typescript
  import { base64url } from "@onoal/oid";

  export function generateOidChainId(oid: string): string {
    const parsed = parseOid(oid);
    const encoded = base64url.encode(oid);
    return `oid:${parsed.namespace}:${encoded}`;
  }
  ```

**Deliverables:**

- oid module volledig geïmplementeerd
- Integratie met @onoal/oid library
- Signature verificatie werkend
- Chain consistency checks
- Unit tests voor elk validatie scenario
- Integration tests met Nucleus.append()

---

### **FASE 4: Integration & Documentation**

#### **Stap 9: Integration Tests**

**Doel:** Kern-validatie (chain invariants, hash consistency, module integration)

**Prioriteit: Beta-realiteit** → Test wat écht moet kloppen, niet alles

**Acties (MUST HAVE voor beta):**

- [ ] Test framework setup (Vitest of Jest)
- [ ] `tests/integration/oid-flow.test.ts`:

  ```typescript
  describe("OID Module Integration", () => {
    it("should anchor OID record in chain", async () => {
      const nucleus = await createNucleus({
        storage: new SQLiteRecordStore(":memory:")
      });

      registerModule("oid", oidModule);

      const oidRecord = {
        oid: "oid:onoal:user:test123",
        schema: "oid-core/v0.1.1",
        kind: "human",
        keys: [...],
        metadata: { displayName: "Test User" },
        createdAt: "2025-11-20T12:00:00Z",
        updatedAt: "2025-11-20T12:00:00Z",
        proof: { /* valid signature */ }
      };

      const record = await nucleus.append({
        module: "oid",
        chainId: generateOidChainId(oidRecord.oid),
        body: { oidRecord },
        context: { callerOid: oidRecord.oid }
      });

      expect(record.index).toBe(0);
      expect(record.prevHash).toBeNull();
      expect(record.hash).toBeTruthy();
    });

    it("should maintain chain consistency across updates", async () => {
      // Create initial record
      // Append update with same OID
      // Verify chain links correctly
    });
  });
  ```

- [ ] `tests/integration/proof-flow.test.ts`:

  ```typescript
  describe("Proof Module Integration", () => {
    it("should issue proof about OID subject", async () => {
      const nucleus = await createNucleus({
        storage: new SQLiteRecordStore(":memory:"),
      });

      registerModule("proof", proofModule);

      const proof = {
        subject: "oid:onoal:user:alice",
        issuer: "oid:onoal:org:kyc-provider",
        kind: "kyc",
        data: { country: "NL", level: "basic" },
        issuedAt: "2025-11-20T12:00:00Z",
        expiresAt: "2026-11-20T12:00:00Z",
      };

      const record = await nucleus.append({
        module: "proof",
        chainId: `nucleus:proof:${proof.issuer}:${proof.subject}:${proof.kind}`,
        body: proof,
        context: { callerOid: proof.issuer },
      });

      expect(record.body.subject).toBe(proof.subject);
      expect(record.body.issuer).toBe(proof.issuer);
    });

    it("should reject proof from unauthorized issuer", async () => {
      // Attempt to issue proof where callerOid !== issuer
      // Expect validation error
    });
  });
  ```

- [ ] `tests/integration/chain-consistency.test.ts`:

  ```typescript
  describe("Chain Consistency", () => {
    it("should reject duplicate (chainId, index)", async () => {
      // Manual attempt to insert duplicate index
      // Expect constraint violation
    });

    it("should reject broken chain (invalid prevHash)", async () => {
      // Attempt to append with wrong prevHash
      // Expect validation error
    });

    it("should handle concurrent appends to same chain", async () => {
      // Test race conditions
      // Verify one succeeds, others retry or fail gracefully
    });
  });
  ```

**Acties (NICE TO HAVE – kan later):**

- [ ] Performance tests:
  - Bulk inserts (1000+ records)
  - Chain query performance
  - Hash computation benchmarks
- [ ] Edge case scenarios:
  - Concurrent appends
  - Large chain queries
  - Storage corruption recovery

**Deliverables:**

- ✅ Integration tests voor happy paths
- ✅ Tests voor core invariants (chain consistency, hash uniqueness)
- ✅ Tests voor beide modules met OID integration
- ✅ Tests voor validation errors
- 📋 Performance benchmarks kunnen later
- 📋 CI pipeline optioneel voor beta

---

#### **Stap 10: Documentation**

**Doel:** Minimale maar volledige documentatie voor v0.1.0-beta

**Prioriteit: Beta-realiteit** → Focus op werkende code, niet perfecte docs

**Acties (MUST HAVE voor beta):**

- [ ] **Root README.md** – Het enige dat echt moet:

  ````markdown
  # Nucleus v0.1.0-beta

  Minimaal ledger-systeem voor OID-based verifiable records.

  ## Features

  - Append-only ledger met chain consistency
  - OID-native proof system
  - Pluggable modules (oid, proof)
  - SQLite storage
  - TypeScript SDK

  ## Installation

  npm install @onoal/nucleus @onoal/oid

  ## Quick Start

  ### 1. Register modules

  ```typescript
  import { registerModule, oidModule, proofModule } from "@onoal/nucleus";

  registerModule("oid", oidModule);
  registerModule("proof", proofModule);
  ```
  ````

  ### 2. Create Nucleus instance

  ```typescript
  import { createNucleus } from "@onoal/nucleus";
  import { SQLiteRecordStore } from "@onoal/nucleus/storage-sqlite";

  const nucleus = await createNucleus({
    storage: new SQLiteRecordStore("./nucleus.db"),
  });
  ```

  ### 3. Append records

  ```typescript
  // Anchor OID record
  const oidRecord = await nucleus.append({
    module: "oid",
    chainId: "oid:onoal:...",
    body: {
      oidRecord: {
        /* OID record */
      },
    },
  });

  // Issue proof
  const proof = await nucleus.append({
    module: "proof",
    chainId: "nucleus:proof:issuer:subject:kind",
    body: {
      subject: "oid:onoal:user:alice",
      issuer: "oid:onoal:org:verifier",
      kind: "kyc",
      data: { level: "basic" },
      issuedAt: new Date().toISOString(),
    },
  });
  ```

  ## How It Works

  - **Append-only**: Records never change
  - **Chain consistency**: Each record links to previous via `prevHash`
  - **Modules**: `oid` module anchors OID records, `proof` module stores attestations
  - **Verifiable**: All hashes computed via Rust WASM (deterministic)

  ## Examples

  See `examples/` directory for:

  - Basic usage
  - OID lifecycle
  - Proof verification

  ## Architecture

  See `SCOPE-nucleus-v0.1.0-beta.md` for complete specification.

  ## Status

  **v0.1.0-beta** – Functional but minimal. Use for testing, not production.

  ```

  ```

- [ ] **examples/basic-usage.ts** – Werkend voorbeeld:

  ```typescript
  import {
    createNucleus,
    registerModule,
    oidModule,
    proofModule,
  } from "@onoal/nucleus";
  import { SQLiteRecordStore } from "@onoal/nucleus/storage-sqlite";

  async function main() {
    // 1. Register modules (globally, before creating Nucleus)
    registerModule("oid", oidModule);
    registerModule("proof", proofModule);

    // 2. Create Nucleus instance
    const nucleus = await createNucleus({
      storage: new SQLiteRecordStore("./nucleus.db"),
    });

    // 3. Anchor OID record
    const oidRecord = await nucleus.append({
      module: "oid",
      chainId: "oid:onoal:user123",
      body: {
        oidRecord: {
          oid: "oid:onoal:user:abc123",
          schema: "oid-core/v0.1.1",
          kind: "human",
          keys: [
            /* ... */
          ],
          metadata: { displayName: "Alice" },
          createdAt: "2025-11-20T12:00:00Z",
          updatedAt: "2025-11-20T12:00:00Z",
          proof: {
            /* signature */
          },
        },
      },
    });

    console.log("OID anchored:", oidRecord.hash);

    // 4. Issue proof about OID
    const proofRecord = await nucleus.append({
      module: "proof",
      chainId: "nucleus:proof:verifier:alice:kyc",
      body: {
        subject: "oid:onoal:user:abc123",
        issuer: "oid:onoal:org:verifier",
        kind: "kyc",
        data: { country: "NL", level: "basic" },
        issuedAt: new Date().toISOString(),
        expiresAt: "2026-11-20T12:00:00Z",
      },
      context: {
        callerOid: "oid:onoal:org:verifier",
      },
    });

    console.log("Proof issued:", proofRecord.hash);

    // 5. Query chain
    const chain = await nucleus.getChain("nucleus:proof:verifier:alice:kyc");
    console.log("Chain length:", chain.length);
  }

  main().catch(console.error);
  ```

**Acties (NICE TO HAVE – kan later):**

- [ ] **examples/oid-lifecycle.ts**: OID updates over tijd
- [ ] **examples/proof-verification.ts**: Query en verify proofs
- [ ] **CHANGELOG.md**: Version history (start met v0.1.0-beta)
- [ ] **API docs**: TypeDoc generated (optioneel, JSDoc comments zijn genoeg)

**NIET in v0.1.0-beta:**

- ❌ CONTRIBUTING.md (geen externe contributors verwacht)
- ❌ Uitgebreide module development guide
- ❌ Architecture diagrams (SCOPE doc is genoeg)
- ❌ Benchmarks en performance docs

**Deliverables:**

- ✅ Root README met Quick Start
- ✅ Minimaal één werkend voorbeeld
- ✅ JSDoc comments in code
- ✅ SCOPE document als referentie
- 📋 Rest kan groeien na beta

---

## Design Principles

### ✅ Enterprise-Grade Quality

- **Clean Architecture**: Clear separation between core, modules, storage
- **Type Safety**: Strict TypeScript with comprehensive interfaces
- **Error Handling**: Structured error codes and messages
- **Testing**: Unit + integration tests with >80% coverage
- **Documentation**: JSDoc comments, README's, examples
- **Performance**: Optimized queries, indexed storage

### ✅ Core Invariants

- **Append-only**: No updates or deletes
- **Verifiable**: All hashes deterministically reproducible
- **Chain Consistency**: prevHash links validated
- **Uniqueness**: Enforced via constraints on hash and (chainId, index)

### ✅ OID-Native

- Subject/issuer as OID strings
- Direct linking to oid module
- Integration with @onoal/oid library
- Signature verification built-in

### ✅ Modular & Extensible

- Pluggable storage adapters
- Module runtime interface
- Clean dependency injection
- Future-proof for additional modules

---

## Non-Goals (v0.1.0-beta)

❌ **Postgres/S3 adapters** – Only SQLite in this release  
❌ **Networking/replication** – Local-only, no consensus  
❌ **Rust modules** – All module logic in TypeScript  
❌ **Multi-tenant access control** – App-layer responsibility  
❌ **Query DSL** – Basic read operations only  
❌ **UI/dashboard** – SDK only

---

## Dependencies

### Production

- **@onoal/oid** – OID parsing, validation, types

  - Required exports for Nucleus modules:

    ```typescript
    // OID parsing & validation
    export function parseOid(oid: string): ParsedOid;
    export interface ParsedOid {
      namespace: string;
      type: string;
      identifier: string;
    }

    // OID record validation
    export interface OidRecord {
      oid: string;
      schema: "oid-core/v0.1.1";
      kind: "human" | "org" | "agent";
      keys: PublicKey[];
      metadata: Record<string, any>;
      createdAt: string;
      updatedAt: string;
      proof: OidRecordProof;
    }

    export function validateOidRecord(record: OidRecord): {
      valid: boolean;
      error?: string;
    };

    export function verifyOidRecordSignature(
      record: OidRecord
    ): Promise<boolean>;

    // Utilities
    export namespace base64url {
      export function encode(input: string | Uint8Array): string;
      export function decode(input: string): Uint8Array;
    }
    ```

  - **TODO**: Verify these exports exist in @onoal/oid before implementing Nucleus modules

- **better-sqlite3** – SQLite storage
- **wasm-bindgen** – Rust ↔ TypeScript bridge

### Development

- TypeScript 5.x (strict mode)
- Vitest or Jest – Testing
- ESLint + Prettier – Code quality
- TypeDoc – Documentation generation (optioneel in v0.1.0-beta)
- wasm-pack – Rust → WASM build

---

## Success Criteria

### Stap 1-4 (Fundament)

- ✅ Monorepo builds without errors
- ✅ WASM hash computation works from TS
- ✅ SQLite storage passes all CRUD tests
- ✅ All types compile with strict mode

### Stap 5-6 (Engine)

- ✅ Nucleus.append() creates valid chains
- ✅ Chain consistency enforced
- ✅ Module validation integrated
- ✅ All invariants hold under edge cases

### Stap 7-8 (Modules)

- ✅ proof module validates all OID proofs correctly
- ✅ oid module anchors OID records with signature verification
- ✅ Integration with @onoal/oid library seamless

### Stap 9-10 (Quality)

- ✅ All integration tests pass
- ✅ >80% code coverage
- ✅ Examples run successfully
- ✅ Documentation complete and accurate
- ✅ Ready for beta release

---

## Timeline Estimate

| Fase               | Stappen | Geschatte tijd |
| ------------------ | ------- | -------------- |
| FASE 1: Fundament  | 1-4     | 2-3 dagen      |
| FASE 2: SDK Engine | 5-6     | 2-3 dagen      |
| FASE 3: Modules    | 7-8     | 2-3 dagen      |
| FASE 4: Quality    | 9-10    | 2-3 dagen      |
| **Totaal**         |         | **8-12 dagen** |

_Tijdsinschatting voor een ervaren developer, full-time werk._

---

## Praktische Tips voor Implementatie

### File Organisatie

**Aanbeveling:** Knip het plan in 2 files voor duidelijkheid:

1. **SCOPE-nucleus-v0.1.0-beta.md** → Wat is beloofd (feature spec, blijft stabiel)
2. **PLAN-v0.1.0-beta.md** → Hoe je het gaat doen (deze file, met vinkjes)

**Voordeel:** Je kunt tijdens implementatie rustig aanvinken zonder de scope steeds te heronderhandelen.

### Module Registry Pattern

Dit plan gebruikt **Optie B: Singleton pattern** voor v0.1.0-beta:

```typescript
// Simpel voor developers
registerModule("oid", oidModule);
registerModule("proof", proofModule);

const nucleus = await createNucleus({ storage });
```

**Later refactorbaar naar DI** voor multi-tenant scenarios:

```typescript
// Toekomstige optie A: Dependency Injection
const registry = new ModuleRegistry();
registry.register("oid", oidModule);

const nucleus = new Nucleus(storage, registry, computeHash);
```

### @onoal/oid Afhankelijkheden

**Voor implementatie:** Verifieer dat deze functies bestaan in @onoal/oid:

```typescript
// Parsing & validation
parseOid(oid: string): ParsedOid
validateOidRecord(record: OidRecord): { valid: boolean; error?: string }
verifyOidRecordSignature(record: OidRecord): Promise<boolean>

// Utilities
base64url.encode(input: string | Uint8Array): string
base64url.decode(input: string): Uint8Array
```

**Als ze nog niet bestaan:** Definieer ze eerst in @onoal/oid voordat je Nucleus modules implementeert.

---

## Next Steps

1. ✅ Review dit implementatieplan
2. ✅ (Optioneel) Hernoem naar PLAN-v0.1.0-beta.md
3. ⏳ Verifieer @onoal/oid exports
4. ⏳ Start met **Stap 1: Project Setup**
5. ⏳ Implementeer stap voor stap volgens plan
6. ⏳ Update checklist items tijdens voortgang
7. ⏳ Beta release na voltooiing Stap 10

---

_Generated from SCOPE-nucleus-v0.1.0-beta.md_

**Versie:** 1.0 (Updated with feedback: singleton registry, explicit @onoal/oid deps, beta-reality scope)
