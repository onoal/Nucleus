# Ledger Framework TypeScript → Rust Migratie Analyse

## Executive Summary

Dit document bevat een uitgebreide analyse van het huidige TypeScript Ledger Framework en de geplande migratie naar Rust. Het framework is een modulair, uitbreidbaar systeem voor het bouwen van custom Onoal ledgers met hash-chain integriteit.

---

## 1. TypeScript Framework Overzicht

### 1.1 Architectuur

Het Ledger Framework volgt een **modulaire architectuur** geïnspireerd op:
- **BetterAuth** - Plugin systeem, adapter pattern, factory functions
- **Medusa.js** - Module systeem, service container, dependency injection

### 1.2 Kern Componenten

#### **Core Framework** (`ledger/framework/`)
- **Ledger Engine** (`ledger.ts`) - Hoofd implementatie met append, get, query, verify operaties
- **Hash Chain** (`hash-chain.ts`) - Integriteit verificatie via SHA-256 hash chain
- **Ledger Core** (`ledger-core.ts`) - Low-level database operaties (append, get, query)
- **Service Container** (`service-container.ts`) - Dependency injection container
- **Signer** (`signer.ts`) - Ed25519 signing/verification
- **Schema System** - Drizzle ORM schema definitions + declarative schema support

#### **Modules** (`ledger/modules/`)
Modulaire functionaliteit die services en routes biedt:
- `proof` - Proof management
- `asset` - Asset management  
- `connect` - Connect grant module
- `token` - Fungible tokens met double-entry accounting
- `payment` - Payment processing
- `mesh` - Mesh network protocol

#### **Plugins** (`ledger/plugins/`)
Uitbreidbare functionaliteit via hooks:
- `analytics` - Analytics tracking
- `audit` - Audit logging
- `encryption` - Encryption utilities
- `rate-limit` - Rate limiting

#### **Database Adapters** (`ledger/database/`)
Storage abstractions:
- `sqlite` - SQLite adapter
- `postgres` - PostgreSQL adapter
- `cloudflare/d1` - Cloudflare D1 adapter

#### **Context Package** (`ledger/context/`)
**BELANGRIJK VOOR RUST MIGRATIE** - Geëxtraheerd voor migratie:
- `auth.ts` - RequestContext (authentication context)
- `logger.ts` - LogContext (structured logging)

---

## 2. Rust Migratie Documentatie Analyse

### 2.1 Migratie Documenten

De migratie documentatie bevindt zich in `ledger/rust-migration-docs/`:

#### **README.md**
- Overzicht van migratie documentatie
- Prioriteit lijst voor migratie:
  1. **RequestContext** (`auth.ts`) - Hoogste prioriteit
  2. **LogContext** (`logger.ts`) - Hoge prioriteit
  3. **Server Integration** - Medium prioriteit
  4. **Type Definitions** - Low prioriteit

#### **context-README.md**
- Documentatie van de geëxtraheerde context package
- Gebruiksvoorbeelden voor RequestContext en LogContext
- Migratie instructies van `ledger/framework` naar `ledger/context`

#### **CONTEXT_FILES_OVERVIEW.md**
- **Uitgebreid overzicht** van alle context-gerelateerde bestanden
- Mapping van TypeScript interfaces naar Rust equivalenten
- Context usage patterns in het framework

### 2.2 Context Files Extractie

De context files zijn **al geëxtraheerd** naar `ledger/context/` om de Rust migratie te faciliteren:

```
ledger/context/
├── src/
│   ├── index.ts      # Main exports
│   ├── auth.ts       # RequestContext + AuthMiddleware
│   └── logger.ts     # LogContext + Logger class
├── package.json
└── README.md
```

**Status**: ✅ Context package is geëxtraheerd en ready voor Rust migratie

---

## 3. RequestContext Analyse

### 3.1 Interface Definitie

```typescript
export interface RequestContext {
  oid: string;                    // OID van de requester
  role?: string;                  // Rol van de requester
  token: string;                  // Token gebruikt voor authenticatie
  claims: Record<string, unknown>; // JWT claims
  source: "connect_token" | "session_token" | "service_token" | "dev_token" | "api_key";
}
```

### 3.2 Functionaliteit

**Auth Middleware** (`createAuthMiddleware`):
- Extract authentication context uit HTTP requests
- Support voor meerdere token types:
  - **Connect Token** - DPoP-bound, bevat `grant_id`
  - **Session Token** - OIDC access token
  - **Dev Token** - Development/testing (`dev:oid:...`)
  - **API Key** - Legacy API key fallback
- DPoP proof verificatie voor Connect tokens
- Public path whitelisting

### 3.3 Rust Migratie Overwegingen

**Prioriteit**: 🔴 **HOOGSTE** - Core authenticatie context, gebruikt in alle route handlers

**Rust Equivalent**:
```rust
pub struct RequestContext {
    pub oid: String,
    pub role: Option<String>,
    pub token: String,
    pub claims: HashMap<String, serde_json::Value>,
    pub source: TokenSource,
}

pub enum TokenSource {
    ConnectToken,
    SessionToken,
    ServiceToken,
    DevToken,
    ApiKey,
}
```

**Challenges**:
- JWT verification libraries in Rust (bijv. `jsonwebtoken`, `josekit`)
- DPoP proof verification implementatie
- Async middleware pattern in Rust (bijv. `tower`, `axum`)

---

## 4. LogContext Analyse

### 4.1 Interface Definitie

```typescript
export interface LogContext {
  ledger?: string;
  module?: string;
  service?: string;
  operation?: string;
  entryId?: string;
  userId?: string;
  [key: string]: unknown; // Extra context velden
}
```

### 4.2 Functionaliteit

**Logger Class**:
- Structured logging met context awareness
- Multiple log levels: `debug`, `info`, `warn`, `error`
- Output formats: `json`, `pretty`
- Performance tracking (`time()`, `timeSync()`)
- Child loggers met inherited context
- Color support voor terminal output

### 4.3 Rust Migratie Overwegingen

**Prioriteit**: 🟠 **HOGE** - Structured logging, gebruikt door alle modules

**Rust Equivalent**:
```rust
#[derive(Debug, Clone, Serialize)]
pub struct LogContext {
    pub ledger: Option<String>,
    pub module: Option<String>,
    pub service: Option<String>,
    pub operation: Option<String>,
    pub entry_id: Option<String>,
    pub user_id: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}
```

**Rust Logging Libraries**:
- `tracing` - Structured logging met spans en events (aanbevolen)
- `log` + `env_logger` - Basic logging
- `slog` - Structured logging

**Aanbeveling**: Gebruik `tracing` voor enterprise-grade structured logging met context propagation.

---

## 5. Core Ledger Operaties

### 5.1 Hash Chain Implementatie

**TypeScript** (`hash-chain.ts`):
- SHA-256 hashing via `@noble/hashes`
- Chain verification met prev_hash linking
- Signature verification met Ed25519
- Timestamp ordering checks

**Rust Equivalent**:
```rust
// Gebruik: sha2 crate voor SHA-256
use sha2::{Sha256, Digest};

// Ed25519: ed25519-dalek of ed25519-compact
use ed25519_dalek::{Signer, Verifier};
```

### 5.2 Ledger Core Operaties

**Kern operaties**:
1. **Append** - Toevoegen entry aan ledger
   - Hash computation
   - Signature generation
   - Database insert
   - Chain linking (prev_hash)

2. **Get** - Ophalen entry by ID
   - Database query
   - Payload extraction
   - Context enrichment

3. **Query** - Query entries met filters
   - Stream filtering
   - Subject/Issuer OID filtering
   - Status filtering
   - Pagination (cursor-based)

4. **Verify Chain** - Chain integriteit verificatie
   - Hash verification
   - Signature verification
   - Chain link verification
   - Timestamp ordering

### 5.3 Database Layer

**TypeScript**: Drizzle ORM met declarative schema support

**Rust Opties**:
- **SQLx** - Async SQL toolkit (aanbevolen voor PostgreSQL)
- **Diesel** - Type-safe ORM
- **SeaORM** - Async ORM (Diesel alternative)
- **sqlx + custom schema** - Direct SQL met type safety

**Aanbeveling**: SQLx voor async database operaties met compile-time query checking.

---

## 6. Module & Plugin Systeem

### 6.1 Module Systeem

**TypeScript Pattern**:
```typescript
interface OnoalLedgerModule {
  id: string;
  load?: (ledger: OnoalLedger) => Promise<void>;
  start?: (ledger: OnoalLedger) => Promise<void>;
  services?: Record<string, ServiceFactory>;
  routes?: LedgerRoute[];
  connectors?: Record<string, LedgerConnector>;
  hooks?: LedgerHooks;
}
```

**Rust Equivalent**:
```rust
pub trait LedgerModule: Send + Sync {
    fn id(&self) -> &str;
    async fn load(&mut self, ledger: &mut Ledger) -> Result<()>;
    async fn start(&mut self, ledger: &mut Ledger) -> Result<()>;
    fn services(&self) -> HashMap<String, Box<dyn Service>>;
    fn routes(&self) -> Vec<Route>;
    fn connectors(&self) -> HashMap<String, Box<dyn Connector>>;
    fn hooks(&self) -> Option<Box<dyn Hooks>>;
}
```

### 6.2 Plugin Systeem

**TypeScript Pattern**:
```typescript
interface OnoalLedgerPlugin {
  id: string;
  hooks?: {
    beforeAppend?: (entry, ledger) => Promise<void>;
    afterAppend?: (entry, ledger) => Promise<void>;
    beforeGet?: (id, ledger) => Promise<Entry | null>;
    afterGet?: (entry, id, ledger) => Promise<Entry>;
    // ... meer hooks
  };
}
```

**Rust Equivalent**:
```rust
pub trait LedgerPlugin: Send + Sync {
    fn id(&self) -> &str;
    fn hooks(&self) -> Option<Box<dyn PluginHooks>>;
}

pub trait PluginHooks: Send + Sync {
    async fn before_append(&self, entry: &Entry, ledger: &Ledger) -> Result<()>;
    async fn after_append(&self, entry: &Entry, ledger: &Ledger) -> Result<()>;
    // ... meer hooks
}
```

---

## 7. Service Container

### 7.1 TypeScript Implementatie

**ServiceContainer** (`service-container.ts`):
- Dependency injection
- Service registration by name
- Type-safe service resolution
- Module-scoped services

### 7.2 Rust Equivalent

**Opties**:
- **shaku** - Dependency injection framework
- **inject** - Simple DI container
- **Custom implementation** - Lightweight service registry

**Aanbeveling**: Custom implementation met `HashMap<String, Box<dyn Any>>` voor flexibiliteit.

---

## 8. Database Schema & Migrations

### 8.1 TypeScript Schema

**Drizzle Schema** (`schema.ts`):
- `ledger_entries` - Main ledger table
- `ledger_tip` - Fast root hash lookup
- Module-specific tables via `drizzleSchema`
- Connector tables via `declarativeSchema`

### 8.2 Rust Migratie

**Schema Definition**:
- SQLx migrations (`.sql` files)
- Or: Rust structs met derive macros

**Migrations**:
- SQLx CLI voor migration management
- Of: Custom migration runner

---

## 9. Belangrijke Bevindingen

### 9.1 Performance Kritieke Componenten

1. **Hash Chain Verification** - CPU intensief, veel baat bij Rust
2. **Database Queries** - Async Rust (tokio) kan significant sneller zijn
3. **JWT Verification** - Crypto operaties, Rust is sneller
4. **Signature Generation** - Ed25519 signing, Rust is sneller

### 9.2 Complexiteit Analyse

**Hoogste Complexiteit**:
- ✅ **RequestContext** - Auth middleware met multiple token types + DPoP
- ✅ **Hash Chain** - Chain verification logic
- ✅ **Module System** - Dynamic loading, service registration
- ✅ **Plugin Hooks** - Hook system met async execution

**Medium Complexiteit**:
- LogContext - Structured logging
- Service Container - DI system
- Database Adapters - Multi-provider support

**Lage Complexiteit**:
- Type Definitions - Simple structs/interfaces
- Schema Definitions - Database tables

### 9.3 Migratie Strategie

**Fase 1: Context Layer** (Prioriteit 1)
- RequestContext → Rust
- LogContext → Rust
- TypeScript bindings voor backward compatibility

**Fase 2: Core Operations** (Prioriteit 2)
- Hash Chain → Rust
- Ledger Core → Rust
- Signer → Rust

**Fase 3: Framework Layer** (Prioriteit 3)
- Module System → Rust
- Plugin System → Rust
- Service Container → Rust

**Fase 4: Integration** (Prioriteit 4)
- Database Adapters → Rust
- Server Integration → Rust
- CLI Tools → Rust

---

## 10. Aanbevelingen

### 10.1 Rust Tech Stack

**Core Libraries**:
- `tokio` - Async runtime
- `serde` + `serde_json` - Serialization
- `sha2` - SHA-256 hashing
- `ed25519-dalek` - Ed25519 signing
- `sqlx` - Async SQL toolkit
- `tracing` - Structured logging
- `axum` of `warp` - HTTP framework
- `jsonwebtoken` of `josekit` - JWT handling

**Optional**:
- `diesel` of `sea-orm` - ORM (als SQLx niet voldoende is)
- `shaku` - Dependency injection
- `anyhow` + `thiserror` - Error handling

### 10.2 Migratie Aanpak

1. **Start met Context Layer** - Laagste risico, hoogste impact
2. **Incrementele Migratie** - Rust modules naast TypeScript
3. **FFI Bridge** - TypeScript → Rust via WebAssembly of native bindings
4. **Parallel Development** - TypeScript blijft functioneel tijdens migratie

### 10.3 Testing Strategie

- **Unit Tests** - Rust unit tests voor core logic
- **Integration Tests** - End-to-end tests met TypeScript + Rust
- **Performance Tests** - Benchmark Rust vs TypeScript
- **Compatibility Tests** - Verify backward compatibility

---

## 11. Conclusie

Het TypeScript Ledger Framework is een **mature, enterprise-grade** systeem met:
- ✅ Modulaire architectuur
- ✅ Uitgebreide plugin/module system
- ✅ Multi-database support
- ✅ Hash chain integriteit
- ✅ Context-aware logging & auth

**Rust Migratie Status**:
- ✅ Context package geëxtraheerd (`ledger/context/`)
- ✅ Migratie documentatie aanwezig (`rust-migration-docs/`)
- ⏳ Rust implementatie nog niet gestart (`framework-rust/` is leeg)

**Volgende Stappen**:
1. Start met RequestContext migratie (hoogste prioriteit)
2. Implementeer LogContext met `tracing`
3. Migreer Hash Chain core logic
4. Build FFI bridge voor TypeScript compatibiliteit

---

## 12. Referenties

- **Context Files**: `ledger/context/src/`
- **Migratie Docs**: `ledger/rust-migration-docs/`
- **Framework Core**: `ledger/framework/src/core/`
- **Hash Chain**: `ledger/framework/src/core/hash-chain.ts`
- **Auth Middleware**: `ledger/framework/src/middleware/auth.ts`
- **Logger**: `ledger/framework/src/utils/logger.ts`

---

*Document gegenereerd op basis van codebase analyse - Laatste update: 2024*

