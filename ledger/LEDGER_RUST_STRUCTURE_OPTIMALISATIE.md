# Ledger Framework: TypeScript → Rust Structuur Optimalisatie

## Doelstelling

De **ideologie** (design principles, architecture patterns) van het TypeScript framework behouden, maar de **structuur optimaliseren** voor Rust's ownership model, type system, en performance characteristics.

---

## 1. Kern Ideologie (Te Behouden)

### 1.1 Design Principles

✅ **Factory Pattern** - `createLedger()` factory function  
✅ **Module System** - Modulaire architectuur met lifecycle hooks  
✅ **Plugin System** - Hooks-based extensibility (BetterAuth pattern)  
✅ **Service Container** - Dependency injection (Medusa.js pattern)  
✅ **Adapter Pattern** - Database adapters, multi-provider support  
✅ **Hash Chain Integrity** - Immutable ledger met cryptographic verification  
✅ **Context-Aware** - RequestContext en LogContext propagation  
✅ **Type Safety** - Strong typing (TypeScript → Rust types)  
✅ **Declarative Schemas** - Database schema definitions  
✅ **Connector Pattern** - External service integration  

### 1.2 Architecture Patterns

- **Separation of Concerns** - Core, Modules, Plugins, Adapters
- **Dependency Injection** - Service container voor loose coupling
- **Lifecycle Management** - Load → Start → Stop voor modules
- **Hook System** - Before/After hooks voor extensibility
- **Multi-Stream Support** - Unified ledger met stream filtering

---

## 2. TypeScript Structuur (Huidig)

```
ledger/framework/src/
├── core/
│   ├── ledger.ts              # Factory + Main implementation
│   ├── ledger-core.ts         # Low-level DB operations
│   ├── hash-chain.ts          # Chain verification
│   ├── service-container.ts   # DI container
│   ├── signer.ts              # Ed25519 signing
│   ├── types.ts               # Core types & interfaces
│   ├── schema.ts              # Database schema
│   └── ...
├── middleware/
│   └── auth.ts                # RequestContext extraction
├── utils/
│   ├── logger.ts              # LogContext
│   └── ...
└── server/
    └── index.ts               # HTTP server
```

**Problemen voor Rust**:
- ❌ Interfaces → Traits nodig
- ❌ Dynamic typing → Static typing met generics
- ❌ Class-based → Struct + impl pattern
- ❌ Promise chains → Async/await met tokio
- ❌ Service container met `any` → Type-safe container

---

## 3. Rust Structuur (Geoptimaliseerd)

### 3.1 Directory Structuur

```
ledger/framework-rust/src/
├── lib.rs                     # Public API exports
├── core/
│   ├── mod.rs                 # Core module exports
│   ├── ledger.rs              # Ledger struct + factory
│   ├── ledger_core.rs         # Low-level DB operations
│   ├── hash_chain.rs          # Chain verification
│   ├── service_container.rs   # Type-safe DI container
│   ├── signer.rs              # Ed25519 signing
│   ├── types.rs               # Core types & traits
│   ├── schema.rs              # Database schema definitions
│   └── cache.rs               # In-memory caching
├── context/
│   ├── mod.rs                 # Context module exports
│   ├── request.rs             # RequestContext
│   └── log.rs                 # LogContext + Logger
├── middleware/
│   ├── mod.rs                 # Middleware exports
│   └── auth.rs                # Auth middleware
├── database/
│   ├── mod.rs                 # Database trait
│   ├── adapter.rs             # Database adapter trait
│   ├── sqlite.rs              # SQLite adapter
│   ├── postgres.rs            # PostgreSQL adapter
│   └── d1.rs                  # Cloudflare D1 adapter
├── module/
│   ├── mod.rs                 # Module system
│   ├── trait.rs               # Module trait
│   ├── registry.rs            # Module registry
│   └── lifecycle.rs           # Lifecycle management
├── plugin/
│   ├── mod.rs                 # Plugin system
│   ├── trait.rs               # Plugin trait
│   ├── hooks.rs               # Hook definitions
│   └── registry.rs            # Plugin registry
├── server/
│   ├── mod.rs                 # HTTP server
│   ├── routes.rs              # Route definitions
│   └── handlers.rs            # Request handlers
└── utils/
    ├── mod.rs                 # Utility exports
    ├── jwt.rs                 # JWT proof generation
    ├── oid.rs                 # OID validation
    └── schema_validator.rs     # Schema validation
```

### 3.2 Kern Verschillen

**TypeScript** → **Rust**:
- `interface` → `trait` + `struct`
- `class` → `struct` + `impl`
- `Promise<T>` → `async fn() -> Result<T>`
- `any` → Generics + `dyn Trait`
- Dynamic dispatch → Static dispatch waar mogelijk
- Service container met `Map<string, any>` → Type-safe registry

---

## 4. Core Types & Traits

### 4.1 Ledger Trait (TypeScript Interface → Rust Trait)

**TypeScript**:
```typescript
interface OnoalLedger {
  append<T>(entry: {...}): Promise<LedgerEntry & { proof_jwt: string }>;
  get(id: string): Promise<LedgerEntry | null>;
  query(filters: {...}): Promise<{ entries: LedgerEntry[], ... }>;
  verifyChain(startId?: string, limit?: number): Promise<ChainVerificationResult>;
  getService<T>(name: string): T;
  use(plugin: OnoalLedgerPlugin): this;
  useModule(module: OnoalLedgerModule): this;
}
```

**Rust** (Geoptimaliseerd):
```rust
pub trait Ledger: Send + Sync {
    async fn append(
        &self,
        entry: AppendEntry,
    ) -> Result<LedgerEntryWithProof, LedgerError>;
    
    async fn get(&self, id: &str) -> Result<Option<LedgerEntry>, LedgerError>;
    
    async fn query(
        &self,
        filters: QueryFilters,
    ) -> Result<QueryResult, LedgerError>;
    
    async fn verify_chain(
        &self,
        start_id: Option<&str>,
        limit: Option<usize>,
    ) -> Result<ChainVerificationResult, LedgerError>;
    
    fn get_service<T: 'static>(&self, name: &str) -> Result<Arc<T>, ServiceError>;
    
    fn use_plugin(&mut self, plugin: Box<dyn Plugin>) -> Result<(), LedgerError>;
    
    fn use_module(&mut self, module: Box<dyn Module>) -> Result<(), LedgerError>;
}

// Concrete implementation
pub struct OnoalLedger {
    config: LedgerConfig,
    service_container: Arc<ServiceContainer>,
    modules: Vec<Box<dyn Module>>,
    plugins: Vec<Box<dyn Plugin>>,
    database: Arc<dyn DatabaseAdapter>,
    signer: Arc<Signer>,
    // ... internal state
}

impl Ledger for OnoalLedger {
    // Implementation...
}
```

**Optimalisaties**:
- ✅ `Arc<T>` voor shared ownership (service container, database)
- ✅ `Send + Sync` bounds voor thread-safety
- ✅ `Result<T, E>` voor error handling (geen exceptions)
- ✅ Generics voor type-safe service resolution

### 4.2 Module Trait

**TypeScript**:
```typescript
interface OnoalLedgerModule {
  id: string;
  load?: (ledger: OnoalLedger) => Promise<void>;
  start?: (ledger: OnoalLedger) => Promise<void>;
  services?: Record<string, ServiceFactory>;
  routes?: LedgerRoute[];
  hooks?: LedgerHooks;
}
```

**Rust** (Geoptimaliseerd):
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
}
```

**Optimalisaties**:
- ✅ `&mut self` voor lifecycle methods (ownership transfer)
- ✅ `Arc<dyn Ledger>` voor shared reference
- ✅ `Vec<ServiceDefinition>` in plaats van `Record<string, ...>`
- ✅ `Option<Box<dyn ModuleHooks>>` voor optional hooks

### 4.3 Plugin Trait

**TypeScript**:
```typescript
interface OnoalLedgerPlugin {
  id: string;
  hooks?: {
    beforeAppend?: (entry, ledger) => Promise<void>;
    afterAppend?: (entry, ledger) => Promise<void>;
    // ...
  };
}
```

**Rust** (Geoptimaliseerd):
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
    
    // ... meer hooks
}
```

**Optimalisaties**:
- ✅ Separate `PluginHooks` trait voor hook implementations
- ✅ `&dyn Ledger` voor read-only access
- ✅ `Result<(), HookError>` voor error handling

### 4.4 Service Container (Type-Safe)

**TypeScript**:
```typescript
class ServiceContainer {
  private services = new Map<string, any>();
  register<T>(name: string, service: T): void;
  resolve<T>(name: string): T;
}
```

**Rust** (Geoptimaliseerd):
```rust
pub struct ServiceContainer {
    services: Arc<RwLock<HashMap<String, Arc<dyn Any + Send + Sync>>>>,
    metadata: Arc<RwLock<HashMap<String, ServiceMetadata>>>,
}

impl ServiceContainer {
    pub fn register<T: 'static + Send + Sync>(
        &self,
        name: impl Into<String>,
        service: T,
        module_id: Option<&str>,
    ) -> Result<(), ServiceError> {
        let mut services = self.services.write().unwrap();
        let name = name.into();
        
        if services.contains_key(&name) {
            return Err(ServiceError::AlreadyRegistered(name));
        }
        
        services.insert(name.clone(), Arc::new(service));
        // Store metadata...
        Ok(())
    }
    
    pub fn resolve<T: 'static>(
        &self,
        name: &str,
    ) -> Result<Arc<T>, ServiceError> {
        let services = self.services.read().unwrap();
        let service = services
            .get(name)
            .ok_or_else(|| ServiceError::NotFound(name.to_string()))?;
        
        service
            .clone()
            .downcast::<T>()
            .map_err(|_| ServiceError::WrongType(name.to_string()))
    }
}
```

**Optimalisaties**:
- ✅ `Arc<RwLock<...>>` voor thread-safe shared state
- ✅ `dyn Any + Send + Sync` voor type erasure
- ✅ `downcast::<T>()` voor type-safe resolution
- ✅ `Result<T, E>` voor error handling

---

## 5. Database Adapter Pattern

### 5.1 Database Trait

**TypeScript**:
```typescript
interface LedgerDatabase {
  id: string;
  db: any; // Drizzle instance
  provider: "sqlite" | "postgres" | "d1";
}
```

**Rust** (Geoptimaliseerd):
```rust
pub trait DatabaseAdapter: Send + Sync {
    fn id(&self) -> &str;
    fn provider(&self) -> DatabaseProvider;
    
    async fn append_entry(
        &self,
        entry: &LedgerEntry,
    ) -> Result<(), DatabaseError>;
    
    async fn get_entry(
        &self,
        id: &str,
    ) -> Result<Option<LedgerEntry>, DatabaseError>;
    
    async fn query_entries(
        &self,
        filters: &QueryFilters,
    ) -> Result<QueryResult, DatabaseError>;
    
    async fn get_latest_entry(
        &self,
        stream: Option<&str>,
    ) -> Result<Option<LatestEntry>, DatabaseError>;
    
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

**Optimalisaties**:
- ✅ Trait-based abstraction (geen `any`)
- ✅ `sqlx::Pool` voor connection pooling
- ✅ `Transaction` trait voor atomic operations
- ✅ Type-safe error handling

---

## 6. Context System

### 6.1 RequestContext

**TypeScript**:
```typescript
interface RequestContext {
  oid: string;
  role?: string;
  token: string;
  claims: Record<string, unknown>;
  source: TokenSource;
}
```

**Rust** (Geoptimaliseerd):
```rust
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

// Middleware function
pub async fn extract_request_context(
    req: &Request,
    env: &Env,
) -> Result<Option<RequestContext>, AuthError> {
    // Implementation...
}
```

**Optimalisaties**:
- ✅ `serde` voor serialization
- ✅ `HashMap<String, Value>` voor claims
- ✅ `Result<Option<T>>` voor optional context

### 6.2 LogContext

**TypeScript**:
```typescript
interface LogContext {
  ledger?: string;
  module?: string;
  service?: string;
  // ...
}
```

**Rust** (Geoptimaliseerd):
```rust
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

impl Logger {
    pub fn with_context(context: LogContext) -> Self {
        let span = tracing::info_span!("ledger", 
            ledger = ?context.ledger,
            module = ?context.module,
        );
        Self { context, span }
    }
    
    pub fn info(&self, message: &str) {
        tracing::info!(parent: &self.span, message);
    }
}
```

**Optimalisaties**:
- ✅ `tracing` crate voor structured logging
- ✅ Spans voor context propagation
- ✅ `serde(flatten)` voor extra fields

---

## 7. Factory Pattern

### 7.1 createLedger Factory

**TypeScript**:
```typescript
export async function createLedger(
  config: OnoalLedgerConfig
): Promise<OnoalLedger> {
  // Validation, initialization...
  return ledger;
}
```

**Rust** (Geoptimaliseerd):
```rust
pub struct LedgerBuilder {
    config: LedgerConfig,
    modules: Vec<Box<dyn Module>>,
    plugins: Vec<Box<dyn Plugin>>,
}

impl LedgerBuilder {
    pub fn new(config: LedgerConfig) -> Self {
        Self {
            config,
            modules: Vec::new(),
            plugins: Vec::new(),
        }
    }
    
    pub fn with_module(mut self, module: Box<dyn Module>) -> Self {
        self.modules.push(module);
        self
    }
    
    pub fn with_plugin(mut self, plugin: Box<dyn Plugin>) -> Self {
        self.plugins.push(plugin);
        self
    }
    
    pub async fn build(self) -> Result<Arc<OnoalLedger>, LedgerError> {
        // Validation
        self.config.validate()?;
        
        // Initialize service container
        let service_container = Arc::new(ServiceContainer::new());
        
        // Initialize database
        let database = Arc::new(self.config.database.create().await?);
        service_container.register("database", database.clone(), None)?;
        
        // Initialize signer
        let signer = Arc::new(Signer::new(&self.config.signing_key)?);
        service_container.register("signer", signer.clone(), None)?;
        
        // Initialize logger
        let logger = Logger::with_config(&self.config.logger);
        service_container.register("logger", logger, None)?;
        
        // Create ledger
        let ledger = Arc::new(OnoalLedger {
            config: self.config,
            service_container: service_container.clone(),
            modules: self.modules,
            plugins: self.plugins,
            database,
            signer,
        });
        
        // Load modules
        ledger.load_modules().await?;
        
        // Start modules
        ledger.start_modules().await?;
        
        Ok(ledger)
    }
}

// Convenience function
pub async fn create_ledger(
    config: LedgerConfig,
) -> Result<Arc<OnoalLedger>, LedgerError> {
    LedgerBuilder::new(config).build().await
}
```

**Optimalisaties**:
- ✅ Builder pattern voor fluent API
- ✅ `Arc<T>` voor shared ownership
- ✅ `Result<T, E>` voor error handling
- ✅ Async initialization

---

## 8. Hash Chain Implementation

### 8.1 Hash Chain Core

**TypeScript**:
```typescript
export class HashChain {
  static computeHash(payload: unknown): string {
    const hash = sha256(encoder.encode(JSON.stringify(payload)));
    return bytesToHex(hash);
  }
  
  static async verifyChain(
    db: LedgerDb,
    signer: LedgerSigner,
    startId?: string,
    limit: number = 100
  ): Promise<ChainVerificationResult> {
    // Verification logic...
  }
}
```

**Rust** (Geoptimaliseerd):
```rust
pub struct HashChain;

impl HashChain {
    pub fn compute_hash(
        stream: &str,
        id: &str,
        payload: &serde_json::Value,
    ) -> Result<String, HashError> {
        let payload_str = serde_json::to_string(payload)?;
        let message = format!("{}:{}:{}", stream, id, payload_str);
        
        let mut hasher = sha2::Sha256::new();
        hasher.update(message.as_bytes());
        let hash = hasher.finalize();
        
        Ok(hex::encode(hash))
    }
    
    pub async fn verify_chain(
        db: &dyn DatabaseAdapter,
        signer: &Signer,
        start_id: Option<&str>,
        limit: usize,
    ) -> Result<ChainVerificationResult, ChainError> {
        // Get entries
        let entries = db.query_entries(&QueryFilters {
            start_id: start_id.map(|s| s.to_string()),
            limit: Some(limit),
            ..Default::default()
        }).await?;
        
        let mut errors = Vec::new();
        let mut prev_hash: Option<String> = None;
        
        for entry in entries.entries {
            // Verify hash
            let computed_hash = Self::compute_hash(
                &entry.stream,
                &entry.id,
                &entry.payload,
            )?;
            
            if computed_hash != entry.hash {
                errors.push(ChainError::HashMismatch {
                    entry_id: entry.id.clone(),
                    expected: computed_hash,
                    actual: entry.hash.clone(),
                });
            }
            
            // Verify chain link
            if let Some(ref prev) = prev_hash {
                if entry.prev_hash.as_ref() != Some(prev) {
                    errors.push(ChainError::ChainLinkBroken {
                        entry_id: entry.id.clone(),
                    });
                }
            }
            
            // Verify signature
            if let Some(ref signature) = entry.signature {
                let message = if let Some(ref prev) = entry.prev_hash {
                    format!("{}:{}", entry.hash, prev)
                } else {
                    entry.hash.clone()
                };
                
                if !signer.verify(&message, signature)? {
                    errors.push(ChainError::InvalidSignature {
                        entry_id: entry.id.clone(),
                    });
                }
            }
            
            prev_hash = Some(entry.hash.clone());
        }
        
        Ok(ChainVerificationResult {
            valid: errors.is_empty(),
            entries_checked: entries.entries.len(),
            errors,
        })
    }
}
```

**Optimalisaties**:
- ✅ `sha2` crate voor hashing
- ✅ `hex` crate voor hex encoding
- ✅ `serde_json` voor JSON handling
- ✅ Iterator-based verification (geen recursion)

---

## 9. Module & Plugin Registry

### 9.1 Module Registry

**TypeScript**: Modules worden direct in array opgeslagen

**Rust** (Geoptimaliseerd):
```rust
pub struct ModuleRegistry {
    modules: HashMap<String, Box<dyn Module>>,
    load_order: Vec<String>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
            load_order: Vec::new(),
        }
    }
    
    pub fn register(&mut self, module: Box<dyn Module>) -> Result<(), ModuleError> {
        let id = module.id().to_string();
        
        if self.modules.contains_key(&id) {
            return Err(ModuleError::DuplicateId(id));
        }
        
        // Check dependencies
        for dep in module.dependencies() {
            if !self.modules.contains_key(dep) {
                return Err(ModuleError::MissingDependency {
                    module: id.clone(),
                    dependency: dep.clone(),
                });
            }
        }
        
        self.modules.insert(id.clone(), module);
        self.load_order.push(id);
        Ok(())
    }
    
    pub async fn load_all(
        &mut self,
        ledger: Arc<dyn Ledger>,
    ) -> Result<(), ModuleError> {
        // Load in dependency order
        for id in &self.load_order {
            let module = self.modules.get_mut(id).unwrap();
            module.load(ledger.clone()).await?;
        }
        Ok(())
    }
    
    pub async fn start_all(
        &mut self,
        ledger: Arc<dyn Ledger>,
    ) -> Result<(), ModuleError> {
        for id in &self.load_order {
            let module = self.modules.get_mut(id).unwrap();
            module.start(ledger.clone()).await?;
        }
        Ok(())
    }
}
```

**Optimalisaties**:
- ✅ Dependency checking
- ✅ Load order management
- ✅ `HashMap` voor O(1) lookup

---

## 10. Error Handling

### 10.1 Error Types

**TypeScript**: `throw new Error(...)`

**Rust** (Geoptimaliseerd):
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

#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    #[error("Service not found: {0}")]
    NotFound(String),
    
    #[error("Service already registered: {0}")]
    AlreadyRegistered(String),
    
    #[error("Service wrong type: {0}")]
    WrongType(String),
}
```

**Optimalisaties**:
- ✅ `thiserror` voor ergonomic error types
- ✅ `#[from]` voor automatic conversion
- ✅ Type-safe error handling

---

## 11. Performance Optimalisaties

### 11.1 Caching

**TypeScript**: In-memory cache met TTL

**Rust** (Geoptimaliseerd):
```rust
use std::sync::Arc;
use tokio::sync::RwLock;
use dashmap::DashMap; // Concurrent HashMap

pub struct Cache {
    latest_entries: Arc<DashMap<String, CachedLatestEntry>>,
    payloads: Arc<DashMap<String, CachedPayload>>,
}

impl Cache {
    pub fn new() -> Self {
        Self {
            latest_entries: Arc::new(DashMap::new()),
            payloads: Arc::new(DashMap::new()),
        }
    }
    
    pub fn get_latest_entry(&self, key: &str) -> Option<LatestEntry> {
        self.latest_entries
            .get(key)
            .and_then(|entry| {
                if entry.expires_at > Instant::now() {
                    Some(entry.entry.clone())
                } else {
                    self.latest_entries.remove(key);
                    None
                }
            })
    }
    
    pub fn set_latest_entry(&self, key: String, entry: LatestEntry, ttl: Duration) {
        self.latest_entries.insert(key, CachedLatestEntry {
            entry,
            expires_at: Instant::now() + ttl,
        });
    }
}
```

**Optimalisaties**:
- ✅ `DashMap` voor concurrent access (lock-free)
- ✅ TTL-based expiration
- ✅ Automatic cleanup

### 11.2 Batch Operations

**TypeScript**: `appendBatch()` met transaction

**Rust** (Geoptimaliseerd):
```rust
impl Ledger {
    pub async fn append_batch(
        &self,
        entries: Vec<AppendEntry>,
    ) -> Result<Vec<LedgerEntryWithProof>, LedgerError> {
        let transaction = self.database.begin_transaction().await?;
        
        let mut results = Vec::with_capacity(entries.len());
        
        for entry in entries {
            // Validate
            self.validate_entry(&entry)?;
            
            // Call hooks
            for plugin in &self.plugins {
                if let Some(hooks) = plugin.hooks() {
                    hooks.before_append(&entry, self).await?;
                }
            }
            
            // Append to transaction
            let ledger_entry = self.append_to_transaction(&transaction, &entry).await?;
            results.push(ledger_entry);
        }
        
        // Commit transaction
        transaction.commit().await?;
        
        // Call after hooks
        for (entry, plugin) in results.iter().zip(self.plugins.iter()) {
            if let Some(hooks) = plugin.hooks() {
                hooks.after_append(entry, self).await?;
            }
        }
        
        Ok(results)
    }
}
```

**Optimalisaties**:
- ✅ Pre-allocated `Vec` met capacity
- ✅ Transaction-based atomicity
- ✅ Iterator-based processing

---

## 12. Type Safety Improvements

### 12.1 Schema Validation

**TypeScript**: Runtime validation met JSON Schema

**Rust** (Geoptimaliseerd):
```rust
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct AppendEntry {
    #[validate(length(min = 1))]
    pub r#type: String,
    
    #[validate(custom = "validate_oid")]
    pub issuer_oid: String,
    
    #[validate(custom = "validate_oid")]
    pub subject_oid: Option<String>,
    
    #[validate]
    pub payload: serde_json::Value,
    
    pub meta: Option<HashMap<String, serde_json::Value>>,
    pub stream: Option<String>,
}

fn validate_oid(oid: &str) -> Result<(), ValidationError> {
    if oid.starts_with("oid:") {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_oid"))
    }
}
```

**Optimalisaties**:
- ✅ Compile-time type checking
- ✅ `validator` crate voor validation
- ✅ Custom validators

---

## 13. Migratie Strategie

### 13.1 Incrementele Migratie

1. **Fase 1: Core Types** (Week 1-2)
   - Rust types & traits definiëren
   - RequestContext & LogContext
   - Error types

2. **Fase 2: Core Operations** (Week 3-4)
   - Hash chain implementation
   - Signer
   - Database adapter trait

3. **Fase 3: Service Container** (Week 5)
   - Type-safe DI container
   - Service registry

4. **Fase 4: Module System** (Week 6-7)
   - Module trait
   - Module registry
   - Lifecycle management

5. **Fase 5: Plugin System** (Week 8)
   - Plugin trait
   - Hook system

6. **Fase 6: Ledger Factory** (Week 9-10)
   - Builder pattern
   - Factory function
   - Integration tests

7. **Fase 7: HTTP Server** (Week 11-12)
   - Axum/Warp integration
   - Route handlers
   - Middleware

### 13.2 FFI Bridge (Optioneel)

Voor backward compatibility met TypeScript:

```rust
// Rust side
#[no_mangle]
pub extern "C" fn ledger_append(
    ledger_ptr: *mut OnoalLedger,
    entry_json: *const c_char,
) -> *mut c_char {
    // Implementation...
}

// TypeScript side (via wasm-bindgen of napi-rs)
```

---

## 14. Conclusie

### 14.1 Behoud Ideologie

✅ **Factory Pattern** - Builder + factory function  
✅ **Module System** - Trait-based modules met lifecycle  
✅ **Plugin System** - Hooks-based extensibility  
✅ **Service Container** - Type-safe DI  
✅ **Adapter Pattern** - Trait-based adapters  
✅ **Hash Chain** - Immutable ledger integrity  
✅ **Context-Aware** - RequestContext & LogContext  
✅ **Type Safety** - Rust's type system  
✅ **Declarative** - Schema definitions  

### 14.2 Rust Optimalisaties

✅ **Ownership Model** - `Arc<T>` voor shared ownership  
✅ **Type Safety** - Generics + traits (geen `any`)  
✅ **Error Handling** - `Result<T, E>` (geen exceptions)  
✅ **Async** - `tokio` voor async/await  
✅ **Performance** - Zero-cost abstractions  
✅ **Concurrency** - `DashMap`, `RwLock` voor concurrent access  
✅ **Memory Safety** - Compile-time guarantees  

### 14.3 Structuur Verbeteringen

✅ **Separation of Concerns** - Duidelijke module boundaries  
✅ **Trait-Based Design** - Extensibility via traits  
✅ **Builder Pattern** - Fluent API voor configuration  
✅ **Type-Safe Containers** - Geen runtime type errors  
✅ **Error Types** - Structured error handling  

---

*Document gegenereerd voor Rust structuur optimalisatie - 2024*

