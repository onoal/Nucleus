# Nucleus Engine – Implementatie Roadmap

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor de implementatie van de Nucleus Engine architectuur. Elke stap bevat:
- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

---

## Fase 1: nucleus-core – Pure Engine (Week 1-4)

### Stap 1.1: Project Setup & Basis Types

#### Waarom
We beginnen met de fundamenten: de pure engine zonder I/O dependencies. Dit is de canonieke waarheid waar alles op gebouwd wordt.

#### Wat
- Rust workspace setup met `nucleus-core` crate
- Basis types: `Record`, `Hash`, `Anchor`
- Error types met `thiserror`
- Basis test setup

#### Waar
```
nucleus/
├── Cargo.toml              # Workspace config
└── nucleus-core/
    ├── Cargo.toml
    └── src/
        ├── lib.rs          # Public API
        ├── record.rs       # Record type
        ├── hash.rs         # Hash type & utilities
        ├── anchor.rs       # Anchor types
        └── error.rs        # Error types
```

#### Hoe

**1. Workspace Setup (`nucleus/Cargo.toml`):**
```toml
[workspace]
members = ["nucleus-core"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
authors = ["Onoal Team"]
license = "MIT"
```

**2. nucleus-core Crate (`nucleus-core/Cargo.toml`):**
```toml
[package]
name = "nucleus-core"
version.workspace = true
edition.workspace = true

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sha2 = "0.10"
hex = "0.4"
thiserror = "1.0"

[dev-dependencies]
criterion = "0.5"
```

**3. Basis Types (`nucleus-core/src/record.rs`):**
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Record {
    pub id: String,
    pub stream: String,
    pub timestamp: u64,
    pub payload: serde_json::Value,
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Hash([u8; 32]);

impl Hash {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }
    
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
    
    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }
}
```

**4. Error Types (`nucleus-core/src/error.rs`):**
```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Hash computation error: {0}")]
    HashError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Invalid record: {0}")]
    InvalidRecord(String),
}
```

**5. Public API (`nucleus-core/src/lib.rs`):**
```rust
pub mod record;
pub mod hash;
pub mod anchor;
pub mod error;

pub use record::{Record, Hash};
pub use error::CoreError;
```

**Acceptatie Criteria:**
- ✅ Workspace compileert
- ✅ Basis types zijn gedefinieerd
- ✅ Tests kunnen geschreven worden
- ✅ `cargo test` werkt

---

### Stap 1.2: Canonical Serialization

#### Waarom
Voor hash computation en verificatie moeten records altijd op dezelfde manier geserialiseerd worden. Canonical JSON zorgt voor deterministische serialization.

#### Wat
- Canonical JSON serialization implementatie
- Test vectors voor serialization
- Hash computation op basis van canonical form

#### Waar
```
nucleus-core/src/
├── serialization/
│   ├── mod.rs              # Public API
│   └── canonical.rs        # Canonical JSON implementation
└── hash.rs                 # Hash computation
```

#### Hoe

**1. Canonical Serialization (`nucleus-core/src/serialization/canonical.rs`):**
```rust
use serde_json::Value;
use crate::record::Record;

/// Serialize record to canonical JSON form
/// - Keys sorted alphabetically
/// - No whitespace
/// - Deterministic ordering
pub fn serialize_canonical(record: &Record) -> Result<Vec<u8>, serde_json::Error> {
    let mut canonical = serde_json::Map::new();
    
    // Add fields in canonical order
    canonical.insert("id".to_string(), Value::String(record.id.clone()));
    canonical.insert("stream".to_string(), Value::String(record.stream.clone()));
    canonical.insert("timestamp".to_string(), Value::Number(record.timestamp.into()));
    canonical.insert("payload".to_string(), record.payload.clone());
    
    if let Some(ref meta) = record.meta {
        canonical.insert("meta".to_string(), meta.clone());
    }
    
    // Serialize with no whitespace
    serde_json::to_vec(&canonical)
}

/// Compute hash of canonical serialization
pub fn compute_hash(record: &Record) -> Result<crate::Hash, crate::CoreError> {
    use sha2::{Sha256, Digest};
    
    let canonical = serialize_canonical(record)?;
    let mut hasher = Sha256::new();
    hasher.update(&canonical);
    let hash_bytes = hasher.finalize();
    
    let mut hash_array = [0u8; 32];
    hash_array.copy_from_slice(&hash_bytes);
    
    Ok(crate::Hash::from_bytes(hash_array))
}
```

**2. Test Vectors (`nucleus-core/tests/serialization.rs`):**
```rust
use nucleus_core::{Record, Hash};
use nucleus_core::serialization::canonical;

#[test]
fn test_canonical_serialization() {
    let record = Record {
        id: "test-123".to_string(),
        stream: "proofs".to_string(),
        timestamp: 1234567890,
        payload: serde_json::json!({"type": "proof"}),
        meta: None,
    };
    
    let serialized = canonical::serialize_canonical(&record).unwrap();
    let hash = canonical::compute_hash(&record).unwrap();
    
    // Verify deterministic
    let hash2 = canonical::compute_hash(&record).unwrap();
    assert_eq!(hash, hash2);
}
```

**Acceptatie Criteria:**
- ✅ Canonical serialization is deterministisch
- ✅ Test vectors passen
- ✅ Hash computation werkt consistent

---

### Stap 1.3: Hash Chain Implementation

#### Waarom
De hash chain is het kernmechanisme voor integriteit. Elke record linkt naar de vorige via `prev_hash`, waardoor manipulatie detecteerbaar is.

#### Wat
- Hash chain computation (prev_hash linking)
- Chain verification logic
- Chain traversal utilities

#### Waar
```
nucleus-core/src/
└── hash_chain.rs           # Hash chain implementation
```

#### Hoe

**1. Hash Chain (`nucleus-core/src/hash_chain.rs`):**
```rust
use crate::{Record, Hash, CoreError};

#[derive(Debug, Clone)]
pub struct ChainEntry {
    pub record: Record,
    pub hash: Hash,
    pub prev_hash: Option<Hash>,
}

impl ChainEntry {
    pub fn new(record: Record, prev_hash: Option<Hash>) -> Result<Self, CoreError> {
        use crate::serialization::canonical;
        
        let hash = canonical::compute_hash(&record)?;
        Ok(Self {
            record,
            hash,
            prev_hash,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ChainVerificationResult {
    pub valid: bool,
    pub entries_checked: usize,
    pub errors: Vec<ChainError>,
}

#[derive(Debug, Clone)]
pub enum ChainError {
    HashMismatch { entry_id: String, expected: Hash, actual: Hash },
    ChainLinkBroken { entry_id: String },
    TimestampOutOfOrder { entry_id: String },
}

/// Verify chain integrity
pub fn verify_chain(entries: &[ChainEntry]) -> ChainVerificationResult {
    let mut errors = Vec::new();
    let mut prev_hash: Option<Hash> = None;
    
    for (idx, entry) in entries.iter().enumerate() {
        // Verify hash matches computed hash
        if let Ok(computed) = crate::serialization::canonical::compute_hash(&entry.record) {
            if computed != entry.hash {
                errors.push(ChainError::HashMismatch {
                    entry_id: entry.record.id.clone(),
                    expected: computed,
                    actual: entry.hash,
                });
            }
        }
        
        // Verify chain link
        if let Some(ref prev) = prev_hash {
            if entry.prev_hash.as_ref() != Some(prev) {
                errors.push(ChainError::ChainLinkBroken {
                    entry_id: entry.record.id.clone(),
                });
            }
        }
        
        // Verify timestamp ordering
        if idx > 0 {
            let prev_timestamp = entries[idx - 1].record.timestamp;
            if entry.record.timestamp < prev_timestamp {
                errors.push(ChainError::TimestampOutOfOrder {
                    entry_id: entry.record.id.clone(),
                });
            }
        }
        
        prev_hash = Some(entry.hash);
    }
    
    ChainVerificationResult {
        valid: errors.is_empty(),
        entries_checked: entries.len(),
        errors,
    }
}
```

**2. Tests (`nucleus-core/tests/hash_chain.rs`):**
```rust
use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};

#[test]
fn test_hash_chain_verification() {
    let mut entries = Vec::new();
    let mut prev_hash = None;
    
    for i in 0..5 {
        let record = Record {
            id: format!("entry-{}", i),
            stream: "proofs".to_string(),
            timestamp: 1000 + i as u64,
            payload: serde_json::json!({"index": i}),
            meta: None,
        };
        
        let entry = ChainEntry::new(record, prev_hash).unwrap();
        prev_hash = Some(entry.hash);
        entries.push(entry);
    }
    
    let result = verify_chain(&entries);
    assert!(result.valid);
    assert_eq!(result.entries_checked, 5);
}
```

**Acceptatie Criteria:**
- ✅ Hash chain linking werkt
- ✅ Chain verification detecteert manipulatie
- ✅ Test vectors passen

---

### Stap 1.4: Module System – Trait Definition

#### Waarom
Modules zijn de extensibility mechanisme. We definiëren eerst de trait, dan implementaties.

#### Wat
- `Module` trait definitie
- `ModuleConfig` types
- Basis module registry structuur

#### Waar
```
nucleus-core/src/
└── module/
    ├── mod.rs              # Public API
    ├── trait.rs            # Module trait
    └── config.rs           # ModuleConfig types
```

#### Hoe

**1. Module Trait (`nucleus-core/src/module/trait.rs`):**
```rust
use crate::{Record, Hash, CoreError};
use serde_json::Value;

pub trait Module: Send + Sync {
    /// Module identifier
    fn id(&self) -> &str;
    
    /// Module version
    fn version(&self) -> &str;
    
    /// Process record before append
    fn before_append(&self, record: &mut Record) -> Result<(), CoreError>;
    
    /// Process record after append
    fn after_append(&self, record: &Record, hash: &Hash) -> Result<(), CoreError>;
    
    /// Validate record
    fn validate(&self, record: &Record) -> Result<(), CoreError>;
    
    /// Query records (module-specific filtering)
    fn query(&self, records: &[Record], filters: &Value) -> Vec<&Record>;
}
```

**2. Module Config (`nucleus-core/src/module/config.rs`):**
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleConfig {
    pub id: String,
    pub version: String,
    pub config: serde_json::Value,
}
```

**3. Public API (`nucleus-core/src/module/mod.rs`):**
```rust
pub mod trait;
pub mod config;

pub use trait::Module;
pub use config::ModuleConfig;
```

**Acceptatie Criteria:**
- ✅ Module trait is gedefinieerd
- ✅ ModuleConfig types zijn gedefinieerd
- ✅ Trait kan geïmplementeerd worden

---

### Stap 1.5: Proof Module Implementation

#### Waarom
Proof module is een basis module die we nodig hebben. Het demonstreert hoe modules werken.

#### Wat
- Proof module implementatie
- Proof-specific validation
- Proof query logic

#### Waar
```
nucleus-core/src/module/
└── proof.rs                # Proof module implementation
```

#### Hoe

**1. Proof Module (`nucleus-core/src/module/proof.rs`):**
```rust
use crate::{Record, Hash, CoreError};
use crate::module::{Module, ModuleConfig};
use serde_json::Value;

pub struct ProofModule {
    config: ModuleConfig,
}

impl ProofModule {
    pub fn new(config: ModuleConfig) -> Self {
        Self { config }
    }
}

impl Module for ProofModule {
    fn id(&self) -> &str {
        &self.config.id
    }
    
    fn version(&self) -> &str {
        &self.config.version
    }
    
    fn before_append(&self, record: &mut Record) -> Result<(), CoreError> {
        // Validate proof-specific fields
        if record.stream != "proofs" {
            return Err(CoreError::InvalidRecord(
                "Proof module only handles 'proofs' stream".to_string()
            ));
        }
        
        // Ensure required fields
        if !record.payload.get("subject_oid").is_some() {
            return Err(CoreError::InvalidRecord(
                "Proof record must have 'subject_oid'".to_string()
            ));
        }
        
        Ok(())
    }
    
    fn after_append(&self, _record: &Record, _hash: &Hash) -> Result<(), CoreError> {
        // No post-processing needed
        Ok(())
    }
    
    fn validate(&self, record: &Record) -> Result<(), CoreError> {
        self.before_append(&mut record.clone())
    }
    
    fn query(&self, records: &[Record], filters: &Value) -> Vec<&Record> {
        records
            .iter()
            .filter(|r| r.stream == "proofs")
            .filter(|r| {
                // Apply filters
                if let Some(subject_oid) = filters.get("subject_oid").and_then(|v| v.as_str()) {
                    if r.payload.get("subject_oid").and_then(|v| v.as_str()) != Some(subject_oid) {
                        return false;
                    }
                }
                true
            })
            .collect()
    }
}
```

**Acceptatie Criteria:**
- ✅ Proof module implementeert Module trait
- ✅ Validation werkt
- ✅ Query filtering werkt

---

### Stap 1.6: Asset Module Implementation

#### Waarom
Asset module is een tweede basis module die ownership en state management demonstreert.

#### Wat
- Asset module implementatie
- Asset-specific validation
- Asset query logic

#### Waar
```
nucleus-core/src/module/
└── asset.rs                # Asset module implementation
```

#### Hoe

**1. Asset Module (`nucleus-core/src/module/asset.rs`):**
```rust
use crate::{Record, Hash, CoreError};
use crate::module::{Module, ModuleConfig};
use serde_json::Value;

pub struct AssetModule {
    config: ModuleConfig,
}

impl AssetModule {
    pub fn new(config: ModuleConfig) -> Self {
        Self { config }
    }
}

impl Module for AssetModule {
    fn id(&self) -> &str {
        &self.config.id
    }
    
    fn version(&self) -> &str {
        &self.config.version
    }
    
    fn before_append(&self, record: &mut Record) -> Result<(), CoreError> {
        if record.stream != "assets" {
            return Err(CoreError::InvalidRecord(
                "Asset module only handles 'assets' stream".to_string()
            ));
        }
        
        // Validate required fields
        if !record.payload.get("owner_oid").is_some() {
            return Err(CoreError::InvalidRecord(
                "Asset record must have 'owner_oid'".to_string()
            ));
        }
        
        Ok(())
    }
    
    fn after_append(&self, _record: &Record, _hash: &Hash) -> Result<(), CoreError> {
        Ok(())
    }
    
    fn validate(&self, record: &Record) -> Result<(), CoreError> {
        self.before_append(&mut record.clone())
    }
    
    fn query(&self, records: &[Record], filters: &Value) -> Vec<&Record> {
        records
            .iter()
            .filter(|r| r.stream == "assets")
            .filter(|r| {
                if let Some(owner_oid) = filters.get("owner_oid").and_then(|v| v.as_str()) {
                    if r.payload.get("owner_oid").and_then(|v| v.as_str()) != Some(owner_oid) {
                        return false;
                    }
                }
                true
            })
            .collect()
    }
}
```

**Acceptatie Criteria:**
- ✅ Asset module implementeert Module trait
- ✅ Validation werkt
- ✅ Query filtering werkt

---

## Fase 2: nucleus-engine – Runtime Wrapper (Week 5-7)

### Stap 2.1: LedgerEngine Struct

#### Waarom
`nucleus-engine` is de runtime wrapper die in-memory state beheert en modules registreert. Het is de host-agnostische laag.

#### Wat
- `LedgerEngine` struct
- `LedgerConfig` type
- In-memory state management
- Basis append/get/query API

#### Waar
```
nucleus-engine/
├── Cargo.toml
└── src/
    ├── lib.rs              # Public API
    ├── engine.rs           # LedgerEngine struct
    ├── config.rs           # LedgerConfig
    └── state.rs            # In-memory state
```

#### Hoe

**1. Crate Setup (`nucleus-engine/Cargo.toml`):**
```toml
[package]
name = "nucleus-engine"
version.workspace = true
edition.workspace = true

[dependencies]
nucleus-core = { path = "../nucleus-core" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
```

**2. Ledger Config (`nucleus-engine/src/config.rs`):**
```rust
use serde::{Deserialize, Serialize};
use nucleus_core::module::ModuleConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerConfig {
    pub id: String,
    pub modules: Vec<ModuleConfig>,
}

impl LedgerConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Ledger ID cannot be empty".to_string());
        }
        Ok(())
    }
}
```

**3. Ledger State (`nucleus-engine/src/state.rs`):**
```rust
use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::ChainEntry;
use std::collections::HashMap;

pub struct LedgerState {
    entries: Vec<ChainEntry>,
    by_hash: HashMap<Hash, usize>,
    by_id: HashMap<String, usize>,
    latest_hash: Option<Hash>,
}

impl LedgerState {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            by_hash: HashMap::new(),
            by_id: HashMap::new(),
            latest_hash: None,
        }
    }
    
    pub fn append(&mut self, entry: ChainEntry) {
        let idx = self.entries.len();
        self.by_hash.insert(entry.hash, idx);
        self.by_id.insert(entry.record.id.clone(), idx);
        self.latest_hash = Some(entry.hash);
        self.entries.push(entry);
    }
    
    pub fn get_by_hash(&self, hash: &Hash) -> Option<&ChainEntry> {
        self.by_hash.get(hash).map(|&idx| &self.entries[idx])
    }
    
    pub fn get_by_id(&self, id: &str) -> Option<&ChainEntry> {
        self.by_id.get(id).map(|&idx| &self.entries[idx])
    }
    
    pub fn latest_hash(&self) -> Option<&Hash> {
        self.latest_hash.as_ref()
    }
    
    pub fn all_entries(&self) -> &[ChainEntry] {
        &self.entries
    }
}
```

**4. Ledger Engine (`nucleus-engine/src/engine.rs`):**
```rust
use nucleus_core::{Record, Hash, CoreError};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};
use nucleus_core::module::Module;
use crate::config::LedgerConfig;
use crate::state::LedgerState;
use std::sync::Arc;

pub struct LedgerEngine {
    config: LedgerConfig,
    state: LedgerState,
    modules: Vec<Box<dyn Module>>,
}

impl LedgerEngine {
    pub fn new(config: LedgerConfig) -> Result<Self, EngineError> {
        config.validate()?;
        
        // Initialize modules
        let modules: Vec<Box<dyn Module>> = Vec::new(); // TODO: Load modules
        
        Ok(Self {
            config,
            state: LedgerState::new(),
            modules,
        })
    }
    
    pub fn append_record(&mut self, mut record: Record) -> Result<Hash, EngineError> {
        // Call module before_append hooks
        for module in &self.modules {
            module.before_append(&mut record)?;
        }
        
        // Get previous hash
        let prev_hash = self.state.latest_hash().copied();
        
        // Create chain entry
        let entry = ChainEntry::new(record.clone(), prev_hash)?;
        let hash = entry.hash;
        
        // Call module after_append hooks
        for module in &self.modules {
            module.after_append(&record, &hash)?;
        }
        
        // Append to state
        self.state.append(entry);
        
        Ok(hash)
    }
    
    pub fn get_record(&self, hash: &Hash) -> Option<&Record> {
        self.state.get_by_hash(hash).map(|e| &e.record)
    }
    
    pub fn verify(&self) -> Result<(), EngineError> {
        let result = verify_chain(self.state.all_entries());
        if !result.valid {
            return Err(EngineError::ChainInvalid(result));
        }
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("Core error: {0}")]
    Core(#[from] CoreError),
    
    #[error("Chain invalid: {0:?}")]
    ChainInvalid(verify_chain::ChainVerificationResult),
    
    #[error("Config error: {0}")]
    Config(String),
}
```

**Acceptatie Criteria:**
- ✅ LedgerEngine kan aangemaakt worden
- ✅ Records kunnen geappend worden
- ✅ Records kunnen opgehaald worden
- ✅ Chain verification werkt

---

### Stap 2.2: Module Registry

#### Waarom
Modules moeten geregistreerd en beheerd worden. De registry houdt modules bij en voert lifecycle uit.

#### Wat
- Module registry implementatie
- Module loading & lifecycle
- Module query API

#### Waar
```
nucleus-engine/src/
└── module_registry.rs      # Module registry
```

#### Hoe

**1. Module Registry (`nucleus-engine/src/module_registry.rs`):**
```rust
use nucleus_core::module::{Module, ModuleConfig};
use nucleus_core::module::proof::ProofModule;
use nucleus_core::module::asset::AssetModule;
use std::collections::HashMap;

pub struct ModuleRegistry {
    modules: HashMap<String, Box<dyn Module>>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
        }
    }
    
    pub fn register(&mut self, module: Box<dyn Module>) -> Result<(), String> {
        let id = module.id().to_string();
        if self.modules.contains_key(&id) {
            return Err(format!("Module {} already registered", id));
        }
        self.modules.insert(id, module);
        Ok(())
    }
    
    pub fn load_from_config(&mut self, configs: &[ModuleConfig]) -> Result<(), String> {
        for config in configs {
            let module: Box<dyn Module> = match config.id.as_str() {
                "proof" => Box::new(ProofModule::new(config.clone())),
                "asset" => Box::new(AssetModule::new(config.clone())),
                _ => return Err(format!("Unknown module: {}", config.id)),
            };
            self.register(module)?;
        }
        Ok(())
    }
    
    pub fn get_module(&self, id: &str) -> Option<&dyn Module> {
        self.modules.get(id).map(|m| m.as_ref())
    }
    
    pub fn all_modules(&self) -> Vec<&dyn Module> {
        self.modules.values().map(|m| m.as_ref()).collect()
    }
}
```

**2. Integratie in Engine (`nucleus-engine/src/engine.rs`):**
```rust
use crate::module_registry::ModuleRegistry;

pub struct LedgerEngine {
    config: LedgerConfig,
    state: LedgerState,
    modules: ModuleRegistry,
}

impl LedgerEngine {
    pub fn new(config: LedgerConfig) -> Result<Self, EngineError> {
        config.validate()?;
        
        let mut modules = ModuleRegistry::new();
        modules.load_from_config(&config.modules)?;
        
        Ok(Self {
            config,
            state: LedgerState::new(),
            modules,
        })
    }
    
    pub fn get_module(&self, id: &str) -> Option<&dyn Module> {
        self.modules.get_module(id)
    }
}
```

**Acceptatie Criteria:**
- ✅ Modules kunnen geregistreerd worden
- ✅ Modules worden geladen vanuit config
- ✅ Modules zijn beschikbaar via get_module()

---

### Stap 2.3: Query API

#### Waarom
Query functionaliteit is nodig om records te filteren en op te halen op basis van criteria.

#### Wat
- Query filters type
- Query implementatie
- Module-aware querying

#### Waar
```
nucleus-engine/src/
└── query.rs                 # Query implementation
```

#### Hoe

**1. Query Filters (`nucleus-engine/src/query.rs`):**
```rust
use serde_json::Value;
use nucleus_core::Record;

#[derive(Debug, Clone)]
pub struct QueryFilters {
    pub stream: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub module_filters: Value,
}

impl Default for QueryFilters {
    fn default() -> Self {
        Self {
            stream: None,
            limit: None,
            offset: None,
            module_filters: Value::Object(serde_json::Map::new()),
        }
    }
}

pub struct QueryResult {
    pub records: Vec<Record>,
    pub total: usize,
}

impl LedgerEngine {
    pub fn query(&self, filters: QueryFilters) -> QueryResult {
        let mut records: Vec<&Record> = self.state.all_entries()
            .iter()
            .map(|e| &e.record)
            .collect();
        
        // Filter by stream
        if let Some(ref stream) = filters.stream {
            records.retain(|r| r.stream == *stream);
        }
        
        // Apply module filters
        for module in self.modules.all_modules() {
            records = module.query(&records, &filters.module_filters);
        }
        
        // Apply limit/offset
        let total = records.len();
        let offset = filters.offset.unwrap_or(0);
        let limit = filters.limit.unwrap_or(records.len());
        
        let records: Vec<Record> = records
            .into_iter()
            .skip(offset)
            .take(limit)
            .cloned()
            .collect();
        
        QueryResult { records, total }
    }
}
```

**Acceptatie Criteria:**
- ✅ Query filtering werkt
- ✅ Module-aware querying werkt
- ✅ Limit/offset werkt

---

## Fase 3: nucleus-wasm – WASM Bindings (Week 8-10)

### Stap 3.1: WASM Project Setup

#### Waarom
WASM bindings maken het mogelijk om de Rust engine te gebruiken vanuit TypeScript in browser/Node.

#### Wat
- WASM project setup
- wasm-bindgen dependencies
- Basis build configuratie

#### Waar
```
nucleus-wasm/
├── Cargo.toml
└── src/
    └── lib.rs              # WASM bindings
```

#### Hoe

**1. Crate Setup (`nucleus-wasm/Cargo.toml`):**
```toml
[package]
name = "nucleus-wasm"
version.workspace = true
edition.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
nucleus-engine = { path = "../nucleus-engine" }
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
serde_json = "1.0"
js-sys = "0.3"
wasm-bindgen-futures = "0.4"

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

**2. Build Script (`build.sh`):**
```bash
#!/bin/bash
set -e

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# Generate bindings
wasm-bindgen target/wasm32-unknown-unknown/release/nucleus_wasm.wasm \
  --out-dir pkg \
  --target web \
  --no-typescript
```

**Acceptatie Criteria:**
- ✅ WASM project compileert
- ✅ Build script werkt
- ✅ WASM bindings worden gegenereerd

---

### Stap 3.2: WasmLedger Struct

#### Waarom
WasmLedger is de WASM-wrapped versie van LedgerEngine die vanuit JavaScript/TypeScript gebruikt kan worden.

#### Wat
- WasmLedger struct met wasm-bindgen
- Constructor vanuit JS config
- Basis methods (append, get, verify)

#### Waar
```
nucleus-wasm/src/
├── lib.rs                  # Main bindings
└── ledger.rs               # WasmLedger struct
```

#### Hoe

**1. WasmLedger (`nucleus-wasm/src/ledger.rs`):**
```rust
use wasm_bindgen::prelude::*;
use nucleus_engine::{LedgerEngine, LedgerConfig};
use serde_wasm_bindgen;
use serde_json;

#[wasm_bindgen]
pub struct WasmLedger {
    inner: LedgerEngine,
}

#[wasm_bindgen]
impl WasmLedger {
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue) -> Result<WasmLedger, JsValue> {
        let config_json: serde_json::Value = serde_wasm_bindgen::from_value(config)?;
        let config: LedgerConfig = serde_json::from_value(config_json)
            .map_err(|e| JsValue::from_str(&format!("Config error: {}", e)))?;
        
        let engine = LedgerEngine::new(config)
            .map_err(|e| JsValue::from_str(&format!("Engine error: {}", e)))?;
        
        Ok(WasmLedger { inner: engine })
    }
    
    #[wasm_bindgen]
    pub fn append_record(&mut self, record: JsValue) -> Result<JsValue, JsValue> {
        let record_json: serde_json::Value = serde_wasm_bindgen::from_value(record)?;
        let record: nucleus_core::Record = serde_json::from_value(record_json)
            .map_err(|e| JsValue::from_str(&format!("Record error: {}", e)))?;
        
        let hash = self.inner.append_record(record)
            .map_err(|e| JsValue::from_str(&format!("Append error: {}", e)))?;
        
        serde_wasm_bindgen::to_value(&hash.to_hex())
    }
    
    #[wasm_bindgen]
    pub fn get_record(&self, hash: &str) -> Result<JsValue, JsValue> {
        // Implementation...
    }
    
    #[wasm_bindgen]
    pub fn verify(&self) -> Result<(), JsValue> {
        self.inner.verify()
            .map_err(|e| JsValue::from_str(&format!("Verify error: {}", e)))?;
        Ok(())
    }
}
```

**2. Public API (`nucleus-wasm/src/lib.rs`):**
```rust
mod ledger;

use wasm_bindgen::prelude::*;

pub use ledger::WasmLedger;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}
```

**Acceptatie Criteria:**
- ✅ WasmLedger kan vanuit JS aangemaakt worden
- ✅ append_record werkt
- ✅ verify werkt

---

### Stap 3.3: TypeScript Type Definitions

#### Waarom
TypeScript types maken de WASM API type-safe en developer-friendly.

#### Wat
- TypeScript type definitions
- NPM package setup
- Type exports

#### Waar
```
nucleus-wasm/
├── pkg/                    # Generated WASM + bindings
├── types/
│   └── index.d.ts          # TypeScript definitions
└── package.json
```

#### Hoe

**1. TypeScript Definitions (`nucleus-wasm/types/index.d.ts`):**
```typescript
export interface LedgerConfig {
  id: string;
  modules: ModuleConfig[];
}

export interface ModuleConfig {
  id: string;
  version: string;
  config: Record<string, unknown>;
}

export interface Record {
  id: string;
  stream: string;
  timestamp: number;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export class WasmLedger {
  constructor(config: LedgerConfig);
  append_record(record: Record): Promise<string>;
  get_record(hash: string): Promise<Record | null>;
  verify(): Promise<void>;
}
```

**2. Package.json (`nucleus-wasm/package.json`):**
```json
{
  "name": "@onoal/nucleus-wasm",
  "version": "0.1.0",
  "main": "pkg/nucleus_wasm.js",
  "types": "types/index.d.ts",
  "files": ["pkg", "types"]
}
```

**Acceptatie Criteria:**
- ✅ TypeScript types zijn gedefinieerd
- ✅ NPM package kan gepubliceerd worden
- ✅ Types werken in TypeScript projecten

---

## Fase 4: @onoal/nucleus – TypeScript DX Layer (Week 11-12)

### Stap 4.1: TypeScript Project Setup

#### Waarom
De TypeScript DX layer biedt een prettige API voor developers om ledgers te configureren en te gebruiken.

#### Wat
- TypeScript project setup
- Package structure
- WASM dependency

#### Waar
```
packages/nucleus/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

#### Hoe

**1. Package Setup (`packages/nucleus/package.json`):**
```json
{
  "name": "@onoal/nucleus",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@onoal/nucleus-wasm": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**2. TypeScript Config (`packages/nucleus/tsconfig.json`):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "strict": true
  },
  "include": ["src/**/*"]
}
```

**Acceptatie Criteria:**
- ✅ TypeScript project compileert
- ✅ WASM dependency werkt
- ✅ Build setup werkt

---

### Stap 4.2: Builder API

#### Waarom
De builder API maakt het eenvoudig om een ledger te configureren met modules en policies.

#### Wat
- `Nucleus.createLedger()` function
- Config types
- Module helpers

#### Waar
```
packages/nucleus/src/
├── index.ts                 # Public API
├── builder.ts              # createLedger()
├── config.ts                # Config types
└── modules/
    ├── asset.ts             # assetModule()
    └── proof.ts              # proofModule()
```

#### Hoe

**1. Config Types (`packages/nucleus/src/config.ts`):**
```typescript
export interface LedgerConfig {
  id: string;
  backend: {
    mode: 'wasm' | 'http';
    url?: string;
  };
  anchors?: {
    type: 'hashchain';
    window?: number;
  };
  modules: ModuleConfig[];
}

export interface ModuleConfig {
  id: string;
  version: string;
  config: Record<string, unknown>;
}
```

**2. Builder (`packages/nucleus/src/builder.ts`):**
```typescript
import { WasmLedger } from '@onoal/nucleus-wasm';
import { LedgerConfig } from './config';

export class Nucleus {
  static async createLedger(config: LedgerConfig): Promise<Ledger> {
    // Initialize WASM backend
    if (config.backend.mode === 'wasm') {
      const wasmConfig = {
        id: config.id,
        modules: config.modules,
      };
      
      const wasmLedger = new WasmLedger(wasmConfig);
      return new Ledger(wasmLedger, config);
    }
    
    // TODO: HTTP backend
    throw new Error('HTTP backend not yet implemented');
  }
}
```

**3. Module Helpers (`packages/nucleus/src/modules/asset.ts`):**
```typescript
export function assetModule(config: {
  name: string;
  schema?: unknown;
  indexBy?: string[];
}): ModuleConfig {
  return {
    id: 'asset',
    version: '1.0.0',
    config: {
      name: config.name,
      schema: config.schema,
      indexBy: config.indexBy || [],
    },
  };
}
```

**Acceptatie Criteria:**
- ✅ `Nucleus.createLedger()` werkt
- ✅ Module helpers werken
- ✅ Config is type-safe

---

### Stap 4.3: Runtime API

#### Waarom
De runtime API biedt een prettige interface om met de ledger te werken (append, query, verify).

#### Wat
- Ledger class met runtime methods
- Module API
- Query API

#### Waar
```
packages/nucleus/src/
└── runtime/
    ├── ledger.ts            # Ledger class
    └── module.ts            # Module API
```

#### Hoe

**1. Ledger Runtime (`packages/nucleus/src/runtime/ledger.ts`):**
```typescript
import { WasmLedger } from '@onoal/nucleus-wasm';
import { LedgerConfig } from '../config';

export class Ledger {
  constructor(
    private wasm: WasmLedger,
    private config: LedgerConfig
  ) {}
  
  async append(record: {
    id: string;
    stream: string;
    timestamp: number;
    payload: Record<string, unknown>;
    meta?: Record<string, unknown>;
  }): Promise<string> {
    return await this.wasm.append_record(record);
  }
  
  async get(hash: string) {
    return await this.wasm.get_record(hash);
  }
  
  async verify(): Promise<void> {
    return await this.wasm.verify();
  }
  
  get modules() {
    // Return module API
    return new ModuleAPI(this.wasm, this.config);
  }
}
```

**2. Module API (`packages/nucleus/src/runtime/module.ts`):**
```typescript
export class ModuleAPI {
  constructor(
    private wasm: WasmLedger,
    private config: LedgerConfig
  ) {}
  
  // Dynamic module access
  // ledger.modules.tickets.create(...)
}
```

**Acceptatie Criteria:**
- ✅ Ledger runtime API werkt
- ✅ Module API werkt
- ✅ End-to-end tests passen

---

## Fase 5: Testing & Documentation

### Stap 5.1: Integration Tests

#### Waarom
Integration tests verifiëren dat alle componenten samenwerken.

#### Wat
- End-to-end tests (TS → WASM → Rust)
- Chain verification tests
- Module lifecycle tests

#### Waar
```
tests/
├── integration/
│   ├── wasm_test.ts         # TS → WASM tests
│   └── chain_test.ts        # Chain verification tests
└── unit/
    └── ...                  # Unit tests per crate
```

#### Hoe

**1. WASM Integration Test (`tests/integration/wasm_test.ts`):**
```typescript
import { Nucleus, assetModule } from '@onoal/nucleus';

describe('WASM Integration', () => {
  it('should create ledger and append records', async () => {
    const ledger = await Nucleus.createLedger({
      id: 'test-ledger',
      backend: { mode: 'wasm' },
      modules: [assetModule({ name: 'tickets' })],
    });
    
    const hash = await ledger.append({
      id: 'ticket-1',
      stream: 'assets',
      timestamp: Date.now(),
      payload: { owner: 'oid:onoal:human:alice' },
    });
    
    expect(hash).toBeDefined();
    
    const record = await ledger.get(hash);
    expect(record).toBeDefined();
    expect(record?.id).toBe('ticket-1');
  });
});
```

**Acceptatie Criteria:**
- ✅ Integration tests passen
- ✅ Chain verification werkt end-to-end
- ✅ Module lifecycle werkt

---

### Stap 5.2: Documentation

#### Waarom
Documentatie helpt developers om Nucleus te gebruiken.

#### Wat
- API documentation
- Getting started guide
- Architecture documentation

#### Waar
```
docs/
├── getting-started.md
├── api-reference.md
└── architecture.md
```

#### Hoe

**1. Getting Started (`docs/getting-started.md`):**
```markdown
# Getting Started with Nucleus

## Installation

```bash
npm install @onoal/nucleus
```

## Create Your First Ledger

```typescript
import { Nucleus, assetModule } from '@onoal/nucleus';

const ledger = await Nucleus.createLedger({
  id: 'my-ledger',
  backend: { mode: 'wasm' },
  modules: [assetModule({ name: 'tickets' })],
});

await ledger.append({
  id: 'ticket-1',
  stream: 'assets',
  timestamp: Date.now(),
  payload: { owner: 'oid:onoal:human:alice' },
});
```
```

**Acceptatie Criteria:**
- ✅ Documentation is compleet
- ✅ Examples werken
- ✅ API reference is accuraat

---

## Samenvatting

### Fase 1: nucleus-core (Week 1-4)
- ✅ Basis types & serialization
- ✅ Hash chain implementation
- ✅ Module system
- ✅ Proof & Asset modules

### Fase 2: nucleus-engine (Week 5-7)
- ✅ LedgerEngine struct
- ✅ Module registry
- ✅ Query API

### Fase 3: nucleus-wasm (Week 8-10)
- ✅ WASM bindings
- ✅ TypeScript types
- ✅ NPM package

### Fase 4: @onoal/nucleus (Week 11-12)
- ✅ Builder API
- ✅ Runtime API
- ✅ Module helpers

### Fase 5: Testing & Docs
- ✅ Integration tests
- ✅ Documentation

---

*Implementatie Roadmap voor Nucleus Engine - 2024*

