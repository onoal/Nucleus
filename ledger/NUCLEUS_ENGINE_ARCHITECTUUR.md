# Nucleus Engine – Rust + TypeScript DX Architectuur

## Doel

Dit document definieert de hoofdlijnen van de Nucleus ledger-architectuur met een heldere scheiding:

- **Nucleus Engine (Rust)** – één canonieke ledger-engine voor integriteit, chaining, anchoring en modules
- **TypeScript DX Layer** – een builder/config-API om eenvoudig een eigen ledger te ontwerpen, maar zonder een tweede engine te implementeren

**Belangrijkste principe:**
> Alle integriteit en ledger-logica leeft in Rust.  
> TypeScript beschrijft en configureert, Rust voert uit.

---

## 1. Conceptueel Verschil t.o.v. de oude TS-implementatie

### 1.1 Wat de oude TypeScript-structuur deed

De huidige TS codebase bevat:
- Een volledige ledger engine in TS: `LedgerCore`, `HashChain`, module system, plugins, database, server
- Een serverlaag (HTTP)
- Een DX-laag voor modules, hooks, routes

**In het oude model was TypeScript dus: engine + framework + server.**

### 1.2 Wat we nu willen

We splitsen dat in twee duidelijk gescheiden lagen:

**Nucleus Engine (Rust)**
- Is de enige plaats waar:
  - hash-chains
  - anchoring
  - record-verificatie
  - canonical serialization
  - module-executie
  worden gedefinieerd.

**Nucleus DX (TypeScript)**
- Biedt een builder API en configuratie om:
  - een ledger te definiëren (id, anchors, modules, policies)
  - modules te kiezen (asset, proof, etc.)
- Stuurt deze config naar de Rust-engine via:
  - WASM (embedded/in-browser/in-app)
  - (optioneel) HTTP naar een Nucleus-server
- Bevat géén eigen chain/verify/ledger-implementatie.

---

## 2. Rust Structuur Hoofdlijnen (Nucleus Engine)

We herdenken de Rust-structuur niet als "port van framework", maar als **engine + adapters**.

### 2.1 Crate-indeling (hoog niveau)

```
nucleus/
├── nucleus-core/        # Pure engine (geen I/O, geen HTTP)
├── nucleus-engine/      # In-memory / host-agnostic engine wrapper
├── nucleus-server/       # HTTP/gRPC server bovenop nucleus-engine
├── nucleus-wasm/         # WASM-bindings voor nucleus-core
└── nucleus-cli/          # CLI tools (optioneel, later)
```

### 2.2 nucleus-core (Canonieke Engine)

**Bevat alles wat Nucleus, de truth-engine, is:**

**Types:**
- `Record`, `Anchor`, `ModuleConfig`, `LedgerState`, `Proof`, etc.

**Kernlogica:**
- hash-chain berekening
- append/verify mechaniek
- canonical serialization (JSON/CBOR/custom)
- module-API & module-executie

**Geen:**
- database
- HTTP
- server
- TS awareness

**nucleus-core moet theoretisch draaien zonder netwerk, db of OS – pure logica.**

#### Structuur nucleus-core

```
nucleus-core/src/
├── lib.rs                    # Public API
├── record.rs                 # Record type & canonical serialization
├── anchor.rs                 # Anchor types & anchoring logic
├── hash_chain.rs             # Hash chain computation & verification
├── ledger_state.rs           # LedgerState (in-memory representation)
├── module/
│   ├── mod.rs                # Module trait & registry
│   ├── trait.rs              # Module trait definition
│   ├── proof.rs              # Proof module implementation
│   ├── asset.rs              # Asset module implementation
│   └── config.rs             # ModuleConfig types
├── serialization/
│   ├── mod.rs                # Canonical serialization
│   ├── json.rs               # JSON canonical form
│   └── cbor.rs               # CBOR canonical form (optioneel)
└── error.rs                  # Core error types
```

**Kern API nucleus-core:**

```rust
// nucleus-core/src/lib.rs

pub mod record;
pub mod anchor;
pub mod hash_chain;
pub mod ledger_state;
pub mod module;
pub mod serialization;
pub mod error;

use crate::record::Record;
use crate::anchor::Anchor;
use crate::ledger_state::LedgerState;
use crate::module::Module;

/// Compute hash for a record
pub fn compute_record_hash(record: &Record) -> Result<Hash, HashError>;

/// Verify a record's integrity
pub fn verify_record(record: &Record, prev_hash: Option<&Hash>) -> Result<(), VerificationError>;

/// Verify chain integrity
pub fn verify_chain(records: &[Record]) -> Result<ChainVerificationResult, ChainError>;

/// Canonical serialization
pub fn serialize_canonical(record: &Record) -> Result<Vec<u8>, SerializationError>;
```

### 2.3 nucleus-engine (Host-agnostische "runtime")

Een dunne laag bovenop `nucleus-core`:

**Houdt:**
- in-memory state
- module-instanties
- policies

**Biedt:**
- functionele API voor:
  - `append_record`
  - `get_record`
  - `query`
  - `verify`

**Kan door verschillende "hosts" gebruikt worden:**
- `nucleus-server` (HTTP)
- `nucleus-wasm` (embedded)

#### Structuur nucleus-engine

```
nucleus-engine/src/
├── lib.rs                    # Public API
├── engine.rs                 # LedgerEngine struct
├── config.rs                 # LedgerConfig
├── module_registry.rs        # Module registry & lifecycle
├── state.rs                  # In-memory state management
└── error.rs                  # Engine error types
```

**Kern API nucleus-engine:**

```rust
// nucleus-engine/src/lib.rs

use nucleus_core::{Record, Hash, Module};
use nucleus_core::ledger_state::LedgerState;

pub struct LedgerEngine {
    config: LedgerConfig,
    state: LedgerState,
    modules: ModuleRegistry,
}

impl LedgerEngine {
    pub fn new(config: LedgerConfig) -> Result<Self, EngineError>;
    
    pub fn append_record(&mut self, record: Record) -> Result<Hash, EngineError>;
    
    pub fn get_record(&self, hash: &Hash) -> Option<&Record>;
    
    pub fn query(&self, filters: QueryFilters) -> Vec<&Record>;
    
    pub fn verify(&self) -> Result<ChainVerificationResult, EngineError>;
    
    pub fn get_module<T: Module>(&self, id: &str) -> Option<&T>;
}
```

### 2.4 nucleus-server (optioneel, maar logisch)

HTTP/gRPC laag

**Mapping:**
- HTTP → `nucleus-engine` calls

**Voegt:**
- auth
- multi-tenant / multi-ledger support
- eventuele database persistence

#### Structuur nucleus-server

```
nucleus-server/src/
├── lib.rs                    # Public API
├── server.rs                 # HTTP server (axum/warp)
├── routes/
│   ├── mod.rs                # Route definitions
│   ├── ledger.rs             # Ledger endpoints
│   ├── records.rs            # Record endpoints
│   └── modules.rs            # Module endpoints
├── middleware/
│   ├── mod.rs                # Middleware exports
│   ├── auth.rs               # Authentication
│   └── context.rs            # Request context
└── persistence/
    ├── mod.rs                # Persistence layer
    └── database.rs           # Database adapter
```

### 2.5 nucleus-wasm

Wrapt `nucleus-core` (of `nucleus-engine`) in WASM-bindings:

**expose't types & functies aan TypeScript**

**Doel:**
TS apps kunnen embedded een Nucleus-engine draaien in:
- Node
- browser
- Tauri/Electron

#### Structuur nucleus-wasm

```
nucleus-wasm/src/
├── lib.rs                    # WASM bindings
├── ledger.rs                 # WasmLedger struct
├── record.rs                 # Record bindings
├── module.rs                 # Module bindings
└── utils.rs                  # Helper functions
```

**Voorbeeld-binding:**

```rust
// nucleus-wasm/src/lib.rs

use wasm_bindgen::prelude::*;
use nucleus_engine::{LedgerEngine, LedgerConfig};
use serde_wasm_bindgen;

#[wasm_bindgen]
pub struct WasmLedger {
    inner: LedgerEngine,
}

#[wasm_bindgen]
impl WasmLedger {
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue) -> Result<WasmLedger, JsValue> {
        let cfg: LedgerConfig = serde_wasm_bindgen::from_value(config)?;
        Ok(WasmLedger {
            inner: LedgerEngine::new(cfg)
                .map_err(|e| JsValue::from_str(&format!("Engine error: {}", e)))?,
        })
    }

    #[wasm_bindgen]
    pub fn append_record(&mut self, record: JsValue) -> Result<JsValue, JsValue> {
        let record: Record = serde_wasm_bindgen::from_value(record)?;
        let hash = self.inner.append_record(record)
            .map_err(|e| JsValue::from_str(&format!("Append error: {}", e)))?;
        serde_wasm_bindgen::to_value(&hash)
    }

    #[wasm_bindgen]
    pub fn verify(&self) -> Result<JsValue, JsValue> {
        let result = self.inner.verify()
            .map_err(|e| JsValue::from_str(&format!("Verify error: {}", e)))?;
        serde_wasm_bindgen::to_value(&result)
    }
}
```

---

## 3. TS DX Layer – Nucleus als Framework in TypeScript

De TS-kant is niet meer een engine, maar een **DX-wrapper**.

### 3.1 Package: @onoal/nucleus (DX / Builder)

**Doel:**
Devs laten voelen dat ze hun eigen ledger-engine ontwerpen, terwijl onder water alles via Rust loopt.

**Voorbeeld API:**

```typescript
import { Nucleus, assetModule, proofModule } from '@onoal/nucleus'

const ledger = await Nucleus.createLedger({
  id: 'tickets-eu-1',
  backend: {
    mode: 'wasm',          // of 'http'
    url: 'http://localhost:8080', // voor http mode
  },
  anchors: {
    type: 'hashchain',
    window: 100,
  },
  modules: [
    assetModule({
      name: 'tickets',
      schema: TicketSchema,
      indexBy: ['owner', 'eventId'],
    }),
    proofModule({
      strategies: ['ownership'],
    }),
  ],
})
```

**Belangrijk:**
- `createLedger` maakt géén TS-engine.
- Het:
  - bundelt een config
  - initialiseert een WASM-engine (`nucleus-wasm`)
  - of praat met een remote Rust-engine (`nucleus-server`)

### 3.2 TS runtime API (bovenop WASM/HTTP)

Zodra de ledger "bestaat":

```typescript
await ledger.modules.tickets.create({
  id: 'ticket-123',
  owner: 'oid:onoal:human:alice',
  eventId: 'event-amsterdam',
})

const proof = await ledger.modules.tickets.prove('ticket-123')

await ledger.verify()
```

**Onder water:**
- `ledger.modules.tickets.create` → call naar Rust-engine
- `ledger.verify` → Rust-core verify (exact dezelfde logica als native Rust)

### 3.3 Geen 1-op-1 mapping van alle TS-frameworkfiles

Veel van wat in de junior-analyse stond (bijv. `ServiceContainer`, `Logger`, `DatabaseAdapter`, `Server/routes`), hoort primair in Rust.

**De TS-DX layer:**
- hoeft die patronen niet te kopiëren
- hoeft geen eigen DI, logging, db of server te kennen
- hoeft alleen:
  - config mooi typend
  - een prettige builder
  - een API voor wasm/http-bridge

#### Structuur @onoal/nucleus (TS)

```
packages/nucleus/
├── src/
│   ├── index.ts              # Public API
│   ├── builder.ts            # Nucleus.createLedger()
│   ├── config.ts             # Config types
│   ├── backend/
│   │   ├── wasm.ts           # WASM backend
│   │   └── http.ts           # HTTP backend
│   ├── modules/
│   │   ├── asset.ts           # assetModule() helper
│   │   ├── proof.ts           # proofModule() helper
│   │   └── types.ts           # Module type definitions
│   └── runtime/
│       ├── ledger.ts         # Ledger runtime API
│       └── module.ts         # Module runtime API
├── wasm/
│   └── nucleus-wasm.wasm     # Compiled WASM (from nucleus-wasm crate)
└── package.json
```

---

## 4. Hoe de oude TS-structuur nu "herinterpreteerd" wordt

Je junior had netjes de oude TS-mappen gemapt naar Rust. We gebruiken die analyse als inspiratie, maar niet meer als migratieplan 1-op-1.

### 4.1 Wat blijft relevant in Rust

**Uit de originele mapping:**

| TypeScript | Rust (nucleus-core/engine) | Notities |
|------------|---------------------------|----------|
| `LedgerCore` | `nucleus-core::hash_chain` | Hash, append, verify |
| `HashChain` | `nucleus-core::hash_chain` | Chain verification |
| `Module system` | `nucleus-core::module` + `nucleus-engine::module_registry` | Module trait & registry |
| `Plugin/hooks` | `nucleus-core::module::hooks` (optioneel) | Hook system |
| `Signer` | `nucleus-core::signer` | Ed25519 signing |
| `Record types` | `nucleus-core::record` | Record, LedgerEntry |
| `Schema validation` | `nucleus-core::validation` | Schema validation |

### 4.2 Wat niet meer naar TS moet terugkomen

**Uit de TS-analyse:**

| TypeScript Component | Waar het nu hoort | Reden |
|---------------------|-------------------|-------|
| `server/index.ts` & routes | `nucleus-server` | HTTP server is Rust-only |
| Directe DB-adapters (sqlite/postgres/d1) | `nucleus-server` (optioneel) | Database is server concern |
| Framework DI/container | `nucleus-engine` (optioneel) | Service container in Rust |
| Chain-implementatie in TS | ❌ Verwijderd | Alleen in Rust |
| `LedgerCore` in TS | ❌ Verwijderd | Alleen in Rust |
| `HashChain` in TS | ❌ Verwijderd | Alleen in Rust |

### 4.3 Wat TS DX Layer wel heeft

**TypeScript DX Layer bevat:**

1. **Config & Types** (`config.ts`)
   - `LedgerConfig` type
   - `ModuleConfig` types
   - Type-safe configuratie

2. **Builder API** (`builder.ts`)
   - `Nucleus.createLedger(config)`
   - Module helpers (`assetModule()`, `proofModule()`)

3. **Backend Abstraction** (`backend/wasm.ts`, `backend/http.ts`)
   - WASM bridge
   - HTTP client
   - Unified API

4. **Runtime API** (`runtime/ledger.ts`)
   - `ledger.append()`
   - `ledger.verify()`
   - `ledger.modules.*`

**TypeScript DX Layer bevat NIET:**

- ❌ Hash chain implementatie
- ❌ Record verification logic
- ❌ Module execution engine
- ❌ Service container
- ❌ Database adapters
- ❌ HTTP server

---

## 5. Nieuwe Prioriteiten (fase-indeling)

In plaats van "port alles uit TS", focussen we nu op:

### Fase 1 – nucleus-core (Week 1-4)

**Kern types:**
- [ ] `Record` type & canonical serialization
- [ ] `Anchor` types & anchoring logic
- [ ] `LedgerState` (in-memory representation)
- [ ] `ModuleConfig` types

**Kernlogica:**
- [ ] HashChain implementatie
- [ ] Append/verify kernlogica
- [ ] Canonical serialization (JSON)
- [ ] Module-API (traits) & basic modules (proof, asset)

**Test vectors:**
- [ ] Input → expected hashes/anchors
- [ ] Chain verification tests
- [ ] Serialization tests

### Fase 2 – nucleus-engine (Week 5-7)

**Engine wrapper:**
- [ ] `LedgerEngine` struct
- [ ] `LedgerConfig` type
- [ ] Module registry & lifecycle
- [ ] In-memory state management

**Publieke API:**
- [ ] `append_record()`
- [ ] `get_record()`
- [ ] `query()`
- [ ] `verify()`

**Tests:**
- [ ] Engine integration tests
- [ ] Module lifecycle tests

### Fase 3 – nucleus-wasm (Week 8-10)

**WASM-bindings:**
- [ ] WASM-bindings voor `LedgerEngine`
- [ ] JS/TS-friendly types
- [ ] `serde-wasm-bindgen` integration

**Build & Package:**
- [ ] WASM build setup
- [ ] NPM package (`@onoal/nucleus-wasm`)
- [ ] TypeScript type definitions

**End-to-end tests:**
- [ ] TS → WASM → Rust tests
- [ ] Browser tests
- [ ] Node.js tests

### Fase 4 – @onoal/nucleus (TS DX) (Week 11-12)

**Config & Types:**
- [ ] Config & type definitions
- [ ] Type-safe configuratie

**Builder API:**
- [ ] `Nucleus.createLedger()` implementation
- [ ] Module helpers (`assetModule()`, `proofModule()`, …)
- [ ] WASM/HTTP backend abstraction

**Runtime API:**
- [ ] `ledger.append()` → WASM/HTTP
- [ ] `ledger.verify()` → WASM/HTTP
- [ ] `ledger.modules.*` → Module API

**Dev-docs:**
- [ ] "Define your own ledger in TS"
- [ ] API documentation
- [ ] Examples

### Fase 5 – nucleus-server (optioneel, later)

**HTTP Server:**
- [ ] Axum/Warp server
- [ ] Route definitions
- [ ] Authentication middleware
- [ ] Multi-tenant support

**Persistence:**
- [ ] Database adapter (optioneel)
- [ ] State persistence

---

## 6. Mapping: Oude TS → Nieuwe Rust Structuur

### 6.1 Core Components

| Oude TS Component | Nieuwe Rust Locatie | Notities |
|-------------------|---------------------|----------|
| `core/ledger-core.ts` | `nucleus-core/hash_chain.rs` | Hash, append, verify |
| `core/hash-chain.ts` | `nucleus-core/hash_chain.rs` | Chain verification |
| `core/signer.ts` | `nucleus-core/signer.rs` | Ed25519 signing |
| `core/types-internal.ts` | `nucleus-core/record.rs` | Record, LedgerEntry |
| `core/schema.ts` | `nucleus-core/serialization/` | Canonical serialization |
| `core/service-container.ts` | `nucleus-engine/module_registry.rs` | Module registry (optioneel) |
| `core/ledger.ts` | `nucleus-engine/engine.rs` | LedgerEngine |

### 6.2 Module System

| Oude TS Component | Nieuwe Rust Locatie | Notities |
|-------------------|---------------------|----------|
| `core/types.ts` (Module) | `nucleus-core/module/trait.rs` | Module trait |
| `modules/*/` | `nucleus-core/module/*.rs` | Module implementations |
| Module lifecycle | `nucleus-engine/module_registry.rs` | Registry & lifecycle |

### 6.3 Context & Middleware

| Oude TS Component | Nieuwe Rust Locatie | Notities |
|-------------------|---------------------|----------|
| `middleware/auth.ts` | `nucleus-server/middleware/auth.rs` | Auth middleware (server-only) |
| `utils/logger.ts` | Rust `tracing` crate | Structured logging |
| `context/request.rs` | `nucleus-server/middleware/context.rs` | Request context (server-only) |

### 6.4 Server & Routes

| Oude TS Component | Nieuwe Rust Locatie | Notities |
|-------------------|---------------------|----------|
| `server/index.ts` | `nucleus-server/server.rs` | HTTP server |
| `server/routes/` | `nucleus-server/routes/` | Route definitions |
| Route handlers | `nucleus-server/routes/*.rs` | Request handlers |

### 6.5 Database

| Oude TS Component | Nieuwe Rust Locatie | Notities |
|-------------------|---------------------|----------|
| `database/*/` | `nucleus-server/persistence/` | Database adapters (server-only) |
| DB schemas | `nucleus-server/persistence/schema.rs` | Database schemas |

### 6.6 TypeScript DX Layer

| Oude TS Component | Nieuwe TS Locatie | Notities |
|-------------------|-------------------|----------|
| `framework/src/index.ts` | `packages/nucleus/src/index.ts` | Public API |
| Config types | `packages/nucleus/src/config.ts` | Config & types |
| Builder API | `packages/nucleus/src/builder.ts` | `Nucleus.createLedger()` |
| Module helpers | `packages/nucleus/src/modules/*.ts` | `assetModule()`, etc. |
| Runtime API | `packages/nucleus/src/runtime/*.ts` | `ledger.append()`, etc. |

---

## 7. Conclusie (nieuwe ideologie)

De junior had de oude TS codebase gezien als:
> "Broncode die we naar Rust moeten overzetten."

**Met ons nieuwe inzicht is het eerder:**
> "Een referentie van patterns en features,  
> maar de echte waarheid wordt één Rust-engine: Nucleus.  
> TypeScript wordt een expressieve laag om die engine te configureren en aan te sturen  
> – nooit een tweede engine."

### ✅ Rust Nucleus Engine
- = integriteit, verifiability, canon
- = hash chains, anchoring, verification
- = module execution
- = canonical serialization

### ✅ TS Nucleus DX
- = configuratie & developer experience
- = builder API
- = type-safe configuratie
- = WASM/HTTP bridge

### ❌ Geen dubbele ledger-implementaties
- ❌ Geen integriteitslogica in TS
- ❌ Geen hash chain in TS
- ❌ Geen verification in TS

---

## 8. Belangrijkste Architectuur Principes

1. **Single Source of Truth**
   - Alle integriteit in Rust (`nucleus-core`)
   - TypeScript is configuratie-laag

2. **Host-Agnostic Engine**
   - `nucleus-core` = pure logica
   - `nucleus-engine` = runtime wrapper
   - `nucleus-server` = HTTP host
   - `nucleus-wasm` = WASM host

3. **Type Safety**
   - Rust: Compile-time type safety
   - TypeScript: Type-safe configuratie & API

4. **Developer Experience**
   - TypeScript: Prettige builder API
   - Rust: Performante engine

5. **Verifiability**
   - Alle verificatie in Rust
   - TypeScript kan alleen configureren, niet verifiëren

---

*Architectuur document voor Nucleus Engine - 2024*

