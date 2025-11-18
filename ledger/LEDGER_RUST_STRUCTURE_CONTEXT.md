# Ledger Framework: Rust Structuur Context

## Doel

Dit document definieert de **hoofdlijnen** voor de Rust structuur op basis van:
1. Analyse van de huidige TypeScript implementatie
2. Optimalisatie document (`LEDGER_RUST_STRUCTURE_OPTIMALISATIE.md`)
3. Behoud van de core ideologie en design principles

---

## 1. Huidige TypeScript Structuur Analyse

### 1.1 Core Componenten

**TypeScript Structuur**:
```
framework/src/
├── index.ts                    # Public API exports
├── core/
│   ├── ledger.ts              # Factory + OnoalLedgerImpl
│   ├── ledger-core.ts         # Low-level DB operations (LedgerCore class)
│   ├── hash-chain.ts          # Chain verification (HashChain class)
│   ├── service-container.ts  # DI container (ServiceContainer class)
│   ├── signer.ts              # Ed25519 signing (LedgerSigner class)
│   ├── types.ts               # Core interfaces & types
│   ├── types-internal.ts      # Internal types (LedgerEntry, etc.)
│   ├── schema.ts              # Database schema (Drizzle)
│   ├── cache.ts               # In-memory caching
│   ├── db.ts                  # Database type definitions
│   ├── ual.ts                 # Unified Access Layer
│   └── ledger-module-adapter.ts # Module adapter
├── middleware/
│   └── auth.ts                # RequestContext extraction
├── utils/
│   ├── logger.ts              # LogContext + Logger class
│   ├── jwt.ts                 # JWT proof generation
│   ├── oid-validator.ts       # OID validation
│   └── schema-validator*.ts  # Schema validation
├── server/
│   └── index.ts               # HTTP server (createLedgerServer)
└── routes/
    └── ...                    # Route helpers
```

### 1.2 Belangrijkste TypeScript Patterns

1. **Factory Function**: `createLedger(config)` → `OnoalLedger`
2. **Class-based Implementation**: `OnoalLedgerImpl` implements `OnoalLedger`
3. **Static Methods**: `LedgerCore.append()`, `HashChain.verifyChain()`
4. **Service Container**: `Map<string, any>` met type casting
5. **Module Lifecycle**: `load()` → register services → `start()` → connect connectors
6. **Plugin Hooks**: Before/After hooks voor append, get, query, verify
7. **Route System**: Modules registreren routes, server matcht en executeert

---

## 2. Rust Structuur Hoofdlijnen

### 2.1 Directory Structuur

```
framework-rust/src/
├── lib.rs                     # Public API (equivalent van index.ts)
│
├── core/                      # Core ledger functionality
│   ├── mod.rs                 # Module exports
│   ├── ledger.rs              # Ledger trait + OnoalLedger struct
│   ├── ledger_core.rs         # Low-level operations (was LedgerCore class)
│   ├── hash_chain.rs          # Chain verification (was HashChain class)
│   ├── service_container.rs   # Type-safe DI container
│   ├── signer.rs              # Ed25519 signing (was LedgerSigner class)
│   ├── types.rs               # Core types & traits
│   ├── types_internal.rs      # Internal types (LedgerEntry, etc.)
│   ├── schema.rs              # Database schema definitions
│   ├── cache.rs               # In-memory caching
│   ├── builder.rs             # LedgerBuilder (factory pattern)
│   └── error.rs               # Error types
│
├── context/                    # Context system (was utils/logger + middleware/auth)
│   ├── mod.rs                 # Module exports
│   ├── request.rs             # RequestContext (was middleware/auth.ts)
│   └── log.rs                 # LogContext + Logger (was utils/logger.ts)
│
├── database/                   # Database adapters
│   ├── mod.rs                 # Database trait
│   ├── adapter.rs             # DatabaseAdapter trait
│   ├── sqlite.rs              # SQLite implementation
│   ├── postgres.rs            # PostgreSQL implementation
│   └── d1.rs                  # Cloudflare D1 implementation
│
├── module/                     # Module system
│   ├── mod.rs                 # Module exports
│   ├── trait.rs               # Module trait
│   ├── registry.rs            # ModuleRegistry (dependency management)
│   └── lifecycle.rs           # Lifecycle management
│
├── plugin/                     # Plugin system
│   ├── mod.rs                 # Plugin exports
│   ├── trait.rs               # Plugin trait
│   ├── hooks.rs               # PluginHooks trait
│   └── registry.rs            # PluginRegistry
│
├── server/                     # HTTP server
│   ├── mod.rs                 # Server exports
│   ├── routes.rs              # Route definitions
│   ├── handlers.rs            # Request handlers
│   └── middleware.rs          # Server middleware
│
└── utils/                      # Utilities
    ├── mod.rs                 # Utility exports
    ├── jwt.rs                 # JWT proof generation
    ├── oid.rs                 # OID validation
    └── schema_validator.rs     # Schema validation
```

### 2.2 Type Mapping (TypeScript → Rust)

| TypeScript | Rust | Notities |
|------------|------|----------|
| `interface OnoalLedger` | `trait Ledger` | Trait voor extensibility |
| `class OnoalLedgerImpl` | `struct OnoalLedger` | Concrete implementatie |
| `class LedgerCore` | `struct LedgerCore` | Static methods → impl methods |
| `class HashChain` | `struct HashChain` | Static methods → impl methods |
| `class ServiceContainer` | `struct ServiceContainer` | Type-safe met `Arc<dyn Any>` |
| `class LedgerSigner` | `struct Signer` | Ed25519 signing |
| `class Logger` | `struct Logger` | Met `tracing` crate |
| `interface OnoalLedgerModule` | `trait Module` | Module trait |
| `interface OnoalLedgerPlugin` | `trait Plugin` | Plugin trait |
| `interface LedgerDatabase` | `trait DatabaseAdapter` | Database abstraction |
| `interface RequestContext` | `struct RequestContext` | Context struct |
| `interface LogContext` | `struct LogContext` | Context struct |
| `Promise<T>` | `async fn() -> Result<T, E>` | Async + error handling |
| `Record<string, T>` | `HashMap<String, T>` | Key-value mapping |
| `T | null` | `Option<T>` | Optional values |
| `throw Error` | `Result<T, E>` | Error handling |

---

## 3. Core Componenten Mapping

### 3.1 Ledger (Factory + Implementation)

**TypeScript** (`core/ledger.ts`):
- `createLedger(config)` → factory function
- `OnoalLedgerImpl` class → implements `OnoalLedger` interface
- Methods: `append()`, `get()`, `query()`, `verifyChain()`, `getService()`, etc.

**Rust** (`core/ledger.rs` + `core/builder.rs`):
```rust
// Trait definition
pub trait Ledger: Send + Sync {
    async fn append(&self, entry: AppendEntry) -> Result<LedgerEntryWithProof, LedgerError>;
    async fn get(&self, id: &str) -> Result<Option<LedgerEntry>, LedgerError>;
    async fn query(&self, filters: QueryFilters) -> Result<QueryResult, LedgerError>;
    async fn verify_chain(&self, start_id: Option<&str>, limit: Option<usize>) -> Result<ChainVerificationResult, LedgerError>;
    fn get_service<T: 'static>(&self, name: &str) -> Result<Arc<T>, ServiceError>;
    // ...
}

// Concrete implementation
pub struct OnoalLedger {
    config: LedgerConfig,
    service_container: Arc<ServiceContainer>,
    modules: Vec<Box<dyn Module>>,
    plugins: Vec<Box<dyn Plugin>>,
    database: Arc<dyn DatabaseAdapter>,
    signer: Arc<Signer>,
    // ...
}

impl Ledger for OnoalLedger {
    // Implementation...
}

// Factory (Builder pattern)
pub struct LedgerBuilder {
    config: LedgerConfig,
    modules: Vec<Box<dyn Module>>,
    plugins: Vec<Box<dyn Plugin>>,
}

impl LedgerBuilder {
    pub fn new(config: LedgerConfig) -> Self;
    pub fn with_module(mut self, module: Box<dyn Module>) -> Self;
    pub fn with_plugin(mut self, plugin: Box<dyn Plugin>) -> Self;
    pub async fn build(self) -> Result<Arc<OnoalLedger>, LedgerError>;
}

// Convenience function
pub async fn create_ledger(config: LedgerConfig) -> Result<Arc<OnoalLedger>, LedgerError> {
    LedgerBuilder::new(config).build().await
}
```

**Belangrijkste verschillen**:
- ✅ Trait-based design (extensibility)
- ✅ Builder pattern voor fluent API
- ✅ `Arc<T>` voor shared ownership
- ✅ `Result<T, E>` voor error handling

### 3.2 LedgerCore (Low-level Operations)

**TypeScript** (`core/ledger-core.ts`):
- Static class methods: `append()`, `getEntry()`, `queryEntries()`, `appendBatch()`
- Uses Drizzle ORM for database operations
- In-memory caching voor latest entry

**Rust** (`core/ledger_core.rs`):
```rust
pub struct LedgerCore;

impl LedgerCore {
    pub fn compute_hash(
        stream: &str,
        id: &str,
        payload: &serde_json::Value,
    ) -> Result<String, HashError>;
    
    pub async fn append(
        db: &dyn DatabaseAdapter,
        signer: &Signer,
        stream: &str,
        payload: &serde_json::Value,
        status: EntryStatus,
        meta: Option<&HashMap<String, serde_json::Value>>,
    ) -> Result<LedgerEntry, DatabaseError>;
    
    pub async fn get_entry(
        db: &dyn DatabaseAdapter,
        id: &str,
    ) -> Result<Option<LedgerEntry>, DatabaseError>;
    
    pub async fn query_entries(
        db: &dyn DatabaseAdapter,
        filters: &QueryFilters,
    ) -> Result<QueryResult, DatabaseError>;
    
    pub async fn append_batch(
        db: &dyn DatabaseAdapter,
        signer: &Signer,
        entries: Vec<BatchEntry>,
    ) -> Result<Vec<LedgerEntry>, DatabaseError>;
}
```

**Belangrijkste verschillen**:
- ✅ Trait-based database adapter (geen Drizzle dependency)
- ✅ `&dyn DatabaseAdapter` voor abstraction
- ✅ Explicit error types

### 3.3 HashChain (Chain Verification)

**TypeScript** (`core/hash-chain.ts`):
- Static class methods: `computeHash()`, `verifyChain()`
- Verifies hash, signature, chain links, timestamp ordering

**Rust** (`core/hash_chain.rs`):
```rust
pub struct HashChain;

impl HashChain {
    pub fn compute_hash(
        stream: &str,
        id: &str,
        payload: &serde_json::Value,
    ) -> Result<String, HashError>;
    
    pub async fn verify_chain(
        db: &dyn DatabaseAdapter,
        signer: &Signer,
        start_id: Option<&str>,
        limit: usize,
    ) -> Result<ChainVerificationResult, ChainError>;
    
    pub async fn verify_entry(
        db: &dyn DatabaseAdapter,
        signer: &Signer,
        entry_id: &str,
    ) -> Result<EntryVerificationResult, ChainError>;
}
```

**Belangrijkste verschillen**:
- ✅ Iterator-based verification (geen recursion)
- ✅ Structured error types per verification step

### 3.4 ServiceContainer (Dependency Injection)

**TypeScript** (`core/service-container.ts`):
- `Map<string, any>` voor services
- `register<T>(name, service)` met type casting
- `resolve<T>(name)` met type assertion

**Rust** (`core/service_container.rs`):
```rust
pub struct ServiceContainer {
    services: Arc<RwLock<HashMap<String, Arc<dyn Any + Send + Sync>>>>,
    metadata: Arc<RwLock<HashMap<String, ServiceMetadata>>>,
}

impl ServiceContainer {
    pub fn new() -> Self;
    
    pub fn register<T: 'static + Send + Sync>(
        &self,
        name: impl Into<String>,
        service: T,
        module_id: Option<&str>,
    ) -> Result<(), ServiceError>;
    
    pub fn resolve<T: 'static>(
        &self,
        name: &str,
    ) -> Result<Arc<T>, ServiceError>;
    
    pub fn has(&self, name: &str) -> bool;
    pub fn get_service_names(&self) -> Vec<String>;
}
```

**Belangrijkste verschillen**:
- ✅ Type-safe met `downcast::<T>()`
- ✅ `Arc<RwLock<...>>` voor thread-safety
- ✅ `Result<T, E>` voor error handling

### 3.5 Module System

**TypeScript** (`core/types.ts` - `OnoalLedgerModule`):
- Interface met optional methods: `load?`, `start?`, `stop?`
- `services` als `Record<string, ServiceFactory>`
- `routes` als array
- `hooks` als `LedgerHooks` interface
- `connectors` als `Record<string, LedgerConnector>`

**Rust** (`module/trait.rs` + `module/registry.rs`):
```rust
pub trait Module: Send + Sync {
    fn id(&self) -> &str;
    fn version(&self) -> Option<&str>;
    fn dependencies(&self) -> &[String];
    
    async fn load(&mut self, ledger: Arc<dyn Ledger>) -> Result<(), ModuleError>;
    async fn start(&mut self, ledger: Arc<dyn Ledger>) -> Result<(), ModuleError>;
    async fn stop(&mut self, ledger: Arc<dyn Ledger>) -> Result<(), ModuleError>;
    
    fn services(&self) -> Vec<ServiceDefinition>;
    fn routes(&self) -> Vec<Route>;
    fn hooks(&self) -> Option<Box<dyn ModuleHooks>>;
    fn connectors(&self) -> Vec<Box<dyn Connector>>;
    fn schema(&self) -> Option<ModuleSchema>;
}

pub struct ModuleRegistry {
    modules: HashMap<String, Box<dyn Module>>,
    load_order: Vec<String>,
}

impl ModuleRegistry {
    pub fn register(&mut self, module: Box<dyn Module>) -> Result<(), ModuleError>;
    pub async fn load_all(&mut self, ledger: Arc<dyn Ledger>) -> Result<(), ModuleError>;
    pub async fn start_all(&mut self, ledger: Arc<dyn Ledger>) -> Result<(), ModuleError>;
}
```

**Belangrijkste verschillen**:
- ✅ Trait-based (geen optional methods)
- ✅ Dependency checking in registry
- ✅ Load order management

### 3.6 Plugin System

**TypeScript** (`core/types.ts` - `OnoalLedgerPlugin`):
- Interface met optional `hooks` object
- Hooks: `beforeAppend`, `afterAppend`, `beforeGet`, `afterGet`, etc.

**Rust** (`plugin/trait.rs` + `plugin/hooks.rs`):
```rust
pub trait Plugin: Send + Sync {
    fn id(&self) -> &str;
    fn version(&self) -> &str;
    fn hooks(&self) -> Option<Box<dyn PluginHooks>>;
}

pub trait PluginHooks: Send + Sync {
    async fn before_append(
        &self,
        entry: &AppendEntry,
        ledger: &dyn Ledger,
    ) -> Result<(), HookError>;
    
    async fn after_append(
        &self,
        entry: &LedgerEntryWithProof,
        ledger: &dyn Ledger,
    ) -> Result<(), HookError>;
    
    async fn before_get(
        &self,
        id: &str,
        ledger: &dyn Ledger,
    ) -> Result<Option<LedgerEntry>, HookError>;
    
    async fn after_get(
        &self,
        entry: Option<&LedgerEntry>,
        id: &str,
        ledger: &dyn Ledger,
    ) -> Result<Option<LedgerEntry>, HookError>;
    
    // ... meer hooks
}
```

**Belangrijkste verschillen**:
- ✅ Separate `PluginHooks` trait
- ✅ Type-safe hook signatures
- ✅ `Result<T, E>` voor error handling

### 3.7 Database Adapter

**TypeScript** (`core/types.ts` - `LedgerDatabase`):
- Interface met `db: any` (Drizzle instance)
- `provider: "sqlite" | "postgres" | "d1"`

**Rust** (`database/adapter.rs`):
```rust
pub trait DatabaseAdapter: Send + Sync {
    fn id(&self) -> &str;
    fn provider(&self) -> DatabaseProvider;
    
    async fn append_entry(&self, entry: &LedgerEntry) -> Result<(), DatabaseError>;
    async fn get_entry(&self, id: &str) -> Result<Option<LedgerEntry>, DatabaseError>;
    async fn query_entries(&self, filters: &QueryFilters) -> Result<QueryResult, DatabaseError>;
    async fn get_latest_entry(&self, stream: Option<&str>) -> Result<Option<LatestEntry>, DatabaseError>;
    async fn begin_transaction(&self) -> Result<Box<dyn Transaction>, DatabaseError>;
}

pub enum DatabaseProvider {
    Sqlite,
    Postgres,
    D1,
}

// Concrete implementations
pub struct SqliteAdapter {
    pool: sqlx::SqlitePool,
    id: String,
}

impl DatabaseAdapter for SqliteAdapter {
    // Implementation...
}
```

**Belangrijkste verschillen**:
- ✅ Trait-based abstraction (geen `any`)
- ✅ `sqlx::Pool` voor connection pooling
- ✅ `Transaction` trait voor atomic operations

### 3.8 Context System

**TypeScript**:
- `middleware/auth.ts` → `RequestContext` interface
- `utils/logger.ts` → `LogContext` interface + `Logger` class

**Rust** (`context/request.rs` + `context/log.rs`):
```rust
// RequestContext
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestContext {
    pub oid: String,
    pub role: Option<String>,
    pub token: String,
    pub claims: HashMap<String, serde_json::Value>,
    pub source: TokenSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TokenSource {
    ConnectToken,
    SessionToken,
    ServiceToken,
    DevToken,
    ApiKey,
}

// LogContext
#[derive(Debug, Clone, Serialize, Deserialize)]
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

// Logger met tracing
pub struct Logger {
    context: LogContext,
    span: tracing::Span,
}
```

**Belangrijkste verschillen**:
- ✅ `serde` voor serialization
- ✅ `tracing` crate voor structured logging
- ✅ Spans voor context propagation

---

## 4. Module Lifecycle Flow

### 4.1 TypeScript Flow

```
createLedger(config)
  ├─> Validate config
  ├─> Initialize ServiceContainer
  ├─> Create Logger
  ├─> Initialize Database
  ├─> Create Signer
  ├─> Create OnoalLedgerImpl
  └─> Load Modules (for each module):
        ├─> module.load(ledger)
        ├─> Register services (module.services)
        ├─> module.start(ledger)
        └─> Connect connectors (module.connectors)
```

### 4.2 Rust Flow

```rust
LedgerBuilder::new(config)
  .with_module(module1)
  .with_module(module2)
  .with_plugin(plugin1)
  .build()
    ├─> Validate config
    ├─> Initialize ServiceContainer
    ├─> Initialize Database
    ├─> Initialize Signer
    ├─> Initialize Logger
    ├─> Create OnoalLedger
    └─> ModuleRegistry::load_all()
          └─> For each module (dependency order):
                ├─> module.load(ledger)
                ├─> Register services
                ├─> module.start(ledger)
                └─> Connect connectors
```

**Belangrijkste verschillen**:
- ✅ Builder pattern voor fluent API
- ✅ Dependency order in ModuleRegistry
- ✅ `Result<T, E>` voor error propagation

---

## 5. Error Handling

### 5.1 TypeScript

- `throw new Error(...)`
- Custom error classes: `ModuleError`, `ServiceError`, etc.
- Error codes via `ErrorCodes` enum

### 5.2 Rust

```rust
#[derive(Debug, thiserror::Error)]
pub enum LedgerError {
    #[error("Database error: {0}")]
    Database(#[from] DatabaseError),
    
    #[error("Module error: {0}")]
    Module(#[from] ModuleError),
    
    #[error("Plugin error: {0}")]
    Plugin(#[from] PluginError),
    
    #[error("Service error: {0}")]
    Service(#[from] ServiceError),
    
    #[error("Hash chain error: {0}")]
    HashChain(#[from] ChainError),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
}
```

**Belangrijkste verschillen**:
- ✅ `thiserror` voor ergonomic error types
- ✅ `#[from]` voor automatic conversion
- ✅ Type-safe error handling

---

## 6. Public API (lib.rs)

### 6.1 TypeScript (`index.ts`)

```typescript
export { createLedger } from "./core/ledger";
export { ServiceContainer } from "./core/service-container";
export { createLedgerServer } from "./server/index.js";
export type { OnoalLedger, OnoalLedgerConfig, ... } from "./core/types";
export { createCustomModule } from "./core/types";
// ... meer exports
```

### 6.2 Rust (`lib.rs`)

```rust
// Core
pub use core::ledger::{Ledger, OnoalLedger, create_ledger, LedgerBuilder};
pub use core::service_container::ServiceContainer;
pub use core::types::{LedgerConfig, AppendEntry, QueryFilters, ...};

// Context
pub use context::request::{RequestContext, TokenSource};
pub use context::log::{LogContext, Logger};

// Module & Plugin
pub use module::trait::Module;
pub use plugin::trait::{Plugin, PluginHooks};

// Database
pub use database::adapter::{DatabaseAdapter, DatabaseProvider};

// Server
pub use server::create_ledger_server;

// Utils
pub use utils::jwt::generate_proof_jwt;
pub use utils::oid::{validate_oid, parse_oid};

// Errors
pub use core::error::{LedgerError, ModuleError, ServiceError, ...};
```

---

## 7. Belangrijkste Optimalisaties

### 7.1 Type Safety

- ❌ TypeScript: `any` types, runtime type checking
- ✅ Rust: Generics + traits, compile-time type checking

### 7.2 Ownership Model

- ❌ TypeScript: Garbage collected, reference counting
- ✅ Rust: `Arc<T>` voor shared ownership, zero-cost abstractions

### 7.3 Error Handling

- ❌ TypeScript: Exceptions, try/catch
- ✅ Rust: `Result<T, E>`, explicit error propagation

### 7.4 Concurrency

- ❌ TypeScript: Single-threaded (Node.js event loop)
- ✅ Rust: `Arc<RwLock<...>>`, `DashMap` voor concurrent access

### 7.5 Performance

- ❌ TypeScript: Runtime overhead, JIT compilation
- ✅ Rust: Zero-cost abstractions, compile-time optimizations

---

## 8. Implementatie Prioriteiten

### Fase 1: Core Types & Traits (Week 1-2)
- [ ] `Ledger` trait
- [ ] `Module` trait
- [ ] `Plugin` trait
- [ ] `DatabaseAdapter` trait
- [ ] Error types
- [ ] Core types (`LedgerEntry`, `AppendEntry`, etc.)

### Fase 2: Core Operations (Week 3-4)
- [ ] `LedgerCore` implementation
- [ ] `HashChain` implementation
- [ ] `Signer` implementation
- [ ] Database adapter trait

### Fase 3: Service Container (Week 5)
- [ ] `ServiceContainer` implementation
- [ ] Service registry
- [ ] Type-safe resolution

### Fase 4: Module System (Week 6-7)
- [ ] `Module` trait implementation
- [ ] `ModuleRegistry` implementation
- [ ] Lifecycle management
- [ ] Dependency resolution

### Fase 5: Plugin System (Week 8)
- [ ] `Plugin` trait implementation
- [ ] `PluginHooks` trait
- [ ] Hook execution

### Fase 6: Ledger Factory (Week 9-10)
- [ ] `LedgerBuilder` implementation
- [ ] `create_ledger()` function
- [ ] Integration tests

### Fase 7: Context System (Week 11)
- [ ] `RequestContext` implementation
- [ ] `LogContext` + `Logger` implementation
- [ ] Middleware integration

### Fase 8: HTTP Server (Week 12)
- [ ] Route system
- [ ] Request handlers
- [ ] Middleware integration

---

## 9. Conclusie

De Rust structuur behoudt de **ideologie** van het TypeScript framework:
- ✅ Factory pattern (Builder)
- ✅ Module system (Trait-based)
- ✅ Plugin system (Hooks)
- ✅ Service container (Type-safe DI)
- ✅ Database adapters (Trait-based)
- ✅ Hash chain integrity
- ✅ Context-aware (RequestContext & LogContext)

Maar optimaliseert voor Rust:
- ✅ Type safety (geen `any`)
- ✅ Ownership model (`Arc<T>`)
- ✅ Error handling (`Result<T, E>`)
- ✅ Concurrency (`RwLock`, `DashMap`)
- ✅ Performance (zero-cost abstractions)

---

*Context document voor Rust implementatie - 2024*

