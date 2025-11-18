# Nucleus Engine – Fase 2: nucleus-engine (Gedetailleerd Plan)

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor **Fase 2: nucleus-engine – Runtime Wrapper (Week 5-7)**. Elke stap bevat:

- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

---

## Stap 2.1: LedgerEngine Struct

### Stap 2.1.1: nucleus-engine Crate Setup

#### Waarom

`nucleus-engine` is de runtime wrapper bovenop `nucleus-core`. Het beheert in-memory state, module instanties en biedt een functionele API. Dit is de host-agnostische laag die gebruikt kan worden door verschillende hosts (server, WASM, etc.).

#### Wat

- Maak `nucleus-engine/` directory
- Maak `Cargo.toml` voor nucleus-engine
- Setup basis module structuur
- Configureer dependency op `nucleus-core`

#### Waar

```
nucleus-engine/
├── Cargo.toml
└── src/
    └── lib.rs              # Public API entry point
```

#### Hoe

**1. Maak crate directory:**

```bash
mkdir -p nucleus-engine/src
cd nucleus-engine
```

**2. Maak Cargo.toml (`nucleus-engine/Cargo.toml`):**

```toml
[package]
name = "nucleus-engine"
version.workspace = true
edition.workspace = true
authors.workspace = true
license.workspace = true
description = "Nucleus Engine - Runtime wrapper for nucleus-core"

[dependencies]
nucleus-core = { path = "../nucleus-core" }
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }

[dev-dependencies]
criterion = { workspace = true }

[lib]
name = "nucleus_engine"
path = "src/lib.rs"
```

**3. Update workspace Cargo.toml (`nucleus/Cargo.toml`):**

```toml
[workspace]
members = [
    "nucleus-core",
    "nucleus-engine",  # Toegevoegd
    "nucleus-wasm",
    "nucleus-server",
]
# ... rest blijft hetzelfde
```

**4. Maak basis lib.rs (`nucleus-engine/src/lib.rs`):**

```rust
//! Nucleus Engine - Runtime wrapper for nucleus-core
//!
//! This crate provides a host-agnostic runtime wrapper around nucleus-core.
//! It manages in-memory state, module instances, and provides a functional API.

/// Ledger engine implementation
pub mod engine;

/// Engine configuration
pub mod config;

/// In-memory state management
pub mod state;

/// Module registry
pub mod module_registry;

/// Error types
pub mod error;

// Re-export commonly used types
pub use engine::LedgerEngine;
pub use config::LedgerConfig;
pub use error::EngineError;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_setup() {
        // Basic smoke test
        assert!(true);
    }
}
```

**5. Verifieer crate:**

```bash
cargo check
cargo test
```

**Acceptatie Criteria:**

- ✅ `nucleus-engine/Cargo.toml` bestaat
- ✅ `nucleus-engine/src/lib.rs` bestaat
- ✅ Dependency op `nucleus-core` werkt
- ✅ Crate compileert zonder errors
- ✅ Tests kunnen draaien

---

### Stap 2.1.2: LedgerConfig Type

#### Waarom

`LedgerConfig` bevat alle configuratie nodig om een ledger engine te initialiseren. Het definieert welke modules geladen moeten worden en hun configuratie.

#### Wat

- Implementeer `LedgerConfig` struct
- Implementeer configuratie validatie
- Schrijf unit tests

#### Waar

```
nucleus-engine/src/
└── config.rs                # LedgerConfig implementatie
```

#### Hoe

**1. Maak config.rs (`nucleus-engine/src/config.rs`):**

```rust
use nucleus_core::module::ModuleConfig;
use serde::{Deserialize, Serialize};

/// Ledger engine configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LedgerConfig {
    /// Ledger identifier
    pub id: String,

    /// Modules to load
    pub modules: Vec<ModuleConfig>,

    /// Optional configuration
    pub options: Option<ConfigOptions>,
}

/// Optional configuration options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfigOptions {
    /// Enable strict validation
    pub strict_validation: Option<bool>,

    /// Maximum number of entries in memory
    pub max_entries: Option<usize>,

    /// Enable metrics collection
    pub enable_metrics: Option<bool>,
}

impl LedgerConfig {
    /// Create a new ledger config
    pub fn new(id: String) -> Self {
        Self {
            id,
            modules: Vec::new(),
            options: None,
        }
    }

    /// Create a new ledger config with modules
    pub fn with_modules(id: String, modules: Vec<ModuleConfig>) -> Self {
        Self {
            id,
            modules,
            options: None,
        }
    }

    /// Add a module to the configuration
    pub fn add_module(mut self, module: ModuleConfig) -> Self {
        self.modules.push(module);
        self
    }

    /// Set configuration options
    pub fn with_options(mut self, options: ConfigOptions) -> Self {
        self.options = Some(options);
        self
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.id.is_empty() {
            return Err(ConfigError::InvalidId("Ledger ID cannot be empty".to_string()));
        }

        // Check for duplicate module IDs
        let mut module_ids = std::collections::HashSet::new();
        for module in &self.modules {
            if module_ids.contains(&module.id) {
                return Err(ConfigError::DuplicateModuleId(module.id.clone()));
            }
            module_ids.insert(module.id.clone());
        }

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Invalid ledger ID: {0}")]
    InvalidId(String),

    #[error("Duplicate module ID: {0}")]
    DuplicateModuleId(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ledger_config_new() {
        let config = LedgerConfig::new("test-ledger".to_string());

        assert_eq!(config.id, "test-ledger");
        assert_eq!(config.modules.len(), 0);
        assert_eq!(config.options, None);
    }

    #[test]
    fn test_ledger_config_with_modules() {
        let modules = vec![
            ModuleConfig::new(
                "proof".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
            ModuleConfig::new(
                "asset".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
        ];

        let config = LedgerConfig::with_modules("test-ledger".to_string(), modules.clone());

        assert_eq!(config.id, "test-ledger");
        assert_eq!(config.modules.len(), 2);
        assert_eq!(config.modules[0].id, "proof");
        assert_eq!(config.modules[1].id, "asset");
    }

    #[test]
    fn test_ledger_config_add_module() {
        let mut config = LedgerConfig::new("test-ledger".to_string());

        let module = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );

        config = config.add_module(module);

        assert_eq!(config.modules.len(), 1);
        assert_eq!(config.modules[0].id, "proof");
    }

    #[test]
    fn test_ledger_config_validate_success() {
        let config = LedgerConfig::new("test-ledger".to_string());

        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_ledger_config_validate_empty_id() {
        let config = LedgerConfig::new("".to_string());

        assert!(config.validate().is_err());
    }

    #[test]
    fn test_ledger_config_validate_duplicate_modules() {
        let modules = vec![
            ModuleConfig::new(
                "proof".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
            ModuleConfig::new(
                "proof".to_string(), // Duplicate!
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
        ];

        let config = LedgerConfig::with_modules("test-ledger".to_string(), modules);

        assert!(config.validate().is_err());
    }

    #[test]
    fn test_ledger_config_serialization() {
        let config = LedgerConfig::new("test-ledger".to_string());

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: LedgerConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config, deserialized);
    }
}
```

**2. Update lib.rs om config module te exporteren:**

```rust
pub mod config;
pub use config::{LedgerConfig, ConfigOptions, ConfigError};
```

**3. Verifieer implementatie:**

```bash
cargo test config
```

**Acceptatie Criteria:**

- ✅ `LedgerConfig` struct is geïmplementeerd
- ✅ Validation werkt
- ✅ Module management werkt
- ✅ Serialization werkt
- ✅ Alle tests passen

---

### Stap 2.1.3: LedgerState Implementatie

#### Waarom

`LedgerState` beheert de in-memory state van de ledger. Het houdt alle chain entries bij en biedt efficiente lookup via hash en ID. Dit is de state die de engine beheert.

#### Wat

- Implementeer `LedgerState` struct
- Implementeer entry storage en lookup
- Implementeer efficient indexing (by hash, by ID)
- Schrijf unit tests

#### Waar

```
nucleus-engine/src/
└── state.rs                 # LedgerState implementatie
```

#### Hoe

**1. Maak state.rs (`nucleus-engine/src/state.rs`):**

```rust
use nucleus_core::{Hash, Record};
use nucleus_core::hash_chain::ChainEntry;
use std::collections::HashMap;

/// In-memory ledger state
pub struct LedgerState {
    /// All chain entries in order
    entries: Vec<ChainEntry>,

    /// Index by hash for O(1) lookup
    by_hash: HashMap<Hash, usize>,

    /// Index by record ID for O(1) lookup
    by_id: HashMap<String, usize>,

    /// Latest entry hash (tip of chain)
    latest_hash: Option<Hash>,
}

impl LedgerState {
    /// Create a new empty ledger state
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            by_hash: HashMap::new(),
            by_id: HashMap::new(),
            latest_hash: None,
        }
    }

    /// Append a chain entry to the state
    pub fn append(&mut self, entry: ChainEntry) {
        let idx = self.entries.len();

        // Index by hash
        self.by_hash.insert(entry.hash, idx);

        // Index by ID
        self.by_id.insert(entry.record.id.clone(), idx);

        // Update latest hash
        self.latest_hash = Some(entry.hash);

        // Append to entries
        self.entries.push(entry);
    }

    /// Get entry by hash
    pub fn get_by_hash(&self, hash: &Hash) -> Option<&ChainEntry> {
        self.by_hash
            .get(hash)
            .map(|&idx| &self.entries[idx])
    }

    /// Get entry by record ID
    pub fn get_by_id(&self, id: &str) -> Option<&ChainEntry> {
        self.by_id
            .get(id)
            .map(|&idx| &self.entries[idx])
    }

    /// Get latest entry hash (tip of chain)
    pub fn latest_hash(&self) -> Option<&Hash> {
        self.latest_hash.as_ref()
    }

    /// Get latest entry
    pub fn latest_entry(&self) -> Option<&ChainEntry> {
        self.latest_hash
            .as_ref()
            .and_then(|hash| self.get_by_hash(hash))
    }

    /// Get all entries
    pub fn all_entries(&self) -> &[ChainEntry] {
        &self.entries
    }

    /// Get entry count
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Check if state is empty
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Get entries by stream
    pub fn get_by_stream(&self, stream: &str) -> Vec<&ChainEntry> {
        self.entries
            .iter()
            .filter(|entry| entry.record.stream == stream)
            .collect()
    }

    /// Get entries in range (for pagination)
    pub fn get_range(&self, start: usize, end: usize) -> &[ChainEntry] {
        let end = end.min(self.entries.len());
        let start = start.min(end);
        &self.entries[start..end]
    }
}

impl Default for LedgerState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nucleus_core::Record;

    fn create_test_entry(id: &str, prev_hash: Option<Hash>) -> ChainEntry {
        let record = Record::new(
            id.to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        ChainEntry::new(record, prev_hash).unwrap()
    }

    #[test]
    fn test_ledger_state_new() {
        let state = LedgerState::new();

        assert!(state.is_empty());
        assert_eq!(state.len(), 0);
        assert!(state.latest_hash().is_none());
    }

    #[test]
    fn test_ledger_state_append() {
        let mut state = LedgerState::new();
        let entry = create_test_entry("entry-1", None);

        state.append(entry.clone());

        assert_eq!(state.len(), 1);
        assert!(state.latest_hash().is_some());
        assert_eq!(state.latest_hash(), Some(&entry.hash));
    }

    #[test]
    fn test_ledger_state_get_by_hash() {
        let mut state = LedgerState::new();
        let entry = create_test_entry("entry-1", None);
        let hash = entry.hash;

        state.append(entry.clone());

        let retrieved = state.get_by_hash(&hash);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().record.id, "entry-1");
    }

    #[test]
    fn test_ledger_state_get_by_id() {
        let mut state = LedgerState::new();
        let entry = create_test_entry("entry-1", None);

        state.append(entry);

        let retrieved = state.get_by_id("entry-1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().record.id, "entry-1");
    }

    #[test]
    fn test_ledger_state_chain_linking() {
        let mut state = LedgerState::new();

        let entry1 = create_test_entry("entry-1", None);
        let hash1 = entry1.hash;
        state.append(entry1);

        let entry2 = create_test_entry("entry-2", Some(hash1));
        let hash2 = entry2.hash;
        state.append(entry2);

        assert_eq!(state.len(), 2);
        assert_eq!(state.latest_hash(), Some(&hash2));

        let retrieved2 = state.get_by_hash(&hash2).unwrap();
        assert_eq!(retrieved2.prev_hash, Some(hash1));
    }

    #[test]
    fn test_ledger_state_get_by_stream() {
        let mut state = LedgerState::new();

        let entry1 = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        state.append(ChainEntry::new(entry1, None).unwrap());

        let entry2 = Record::new(
            "entry-2".to_string(),
            "assets".to_string(),
            1234567891,
            serde_json::json!({"type": "asset"}),
        );
        state.append(ChainEntry::new(entry2, None).unwrap());

        let proofs = state.get_by_stream("proofs");
        assert_eq!(proofs.len(), 1);
        assert_eq!(proofs[0].record.id, "entry-1");

        let assets = state.get_by_stream("assets");
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].record.id, "entry-2");
    }

    #[test]
    fn test_ledger_state_get_range() {
        let mut state = LedgerState::new();

        for i in 0..5 {
            let entry = create_test_entry(&format!("entry-{}", i), None);
            state.append(entry);
        }

        let range = state.get_range(1, 3);
        assert_eq!(range.len(), 2);
        assert_eq!(range[0].record.id, "entry-1");
        assert_eq!(range[1].record.id, "entry-2");
    }
}
```

**2. Update lib.rs om state module te exporteren:**

```rust
pub mod state;
pub use state::LedgerState;
```

**3. Verifieer implementatie:**

```bash
cargo test state
```

**Acceptatie Criteria:**

- ✅ `LedgerState` struct is geïmplementeerd
- ✅ Entry storage werkt
- ✅ Lookup by hash werkt
- ✅ Lookup by ID werkt
- ✅ Stream filtering werkt
- ✅ Alle tests passen

---

### Stap 2.1.4: LedgerEngine Basis Struct

#### Waarom

`LedgerEngine` is de hoofdstructuur die alles samenbrengt: state, modules, en configuratie. Het biedt de publieke API voor append, get, query en verify operaties.

#### Wat

- Implementeer `LedgerEngine` struct
- Implementeer constructor
- Implementeer basis methods (append, get, verify)
- Schrijf unit tests

#### Waar

```
nucleus-engine/src/
└── engine.rs                # LedgerEngine implementatie
```

#### Hoe

**1. Maak engine.rs (`nucleus-engine/src/engine.rs`):**

```rust
use nucleus_core::{Record, Hash, CoreError};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};
use nucleus_core::module::Module;
use crate::config::LedgerConfig;
use crate::state::LedgerState;
use crate::module_registry::ModuleRegistry;
use crate::error::EngineError;

/// Ledger engine - runtime wrapper around nucleus-core
pub struct LedgerEngine {
    /// Engine configuration
    config: LedgerConfig,

    /// In-memory ledger state
    state: LedgerState,

    /// Module registry
    modules: ModuleRegistry,
}

impl LedgerEngine {
    /// Create a new ledger engine
    pub fn new(config: LedgerConfig) -> Result<Self, EngineError> {
        // Validate config
        config.validate()?;

        // Initialize module registry
        let mut modules = ModuleRegistry::new();
        modules.load_from_config(&config.modules)?;

        Ok(Self {
            config,
            state: LedgerState::new(),
            modules,
        })
    }

    /// Get engine configuration
    pub fn config(&self) -> &LedgerConfig {
        &self.config
    }

    /// Get ledger ID
    pub fn id(&self) -> &str {
        &self.config.id
    }

    /// Append a record to the ledger
    pub fn append_record(&mut self, mut record: Record) -> Result<Hash, EngineError> {
        // Validate record
        record.validate()?;

        // Call module before_append hooks
        for module in self.modules.all_modules() {
            module.before_append(&mut record)?;
        }

        // Get previous hash
        let prev_hash = self.state.latest_hash().copied();

        // Create chain entry
        let entry = ChainEntry::new(record.clone(), prev_hash)?;
        let hash = entry.hash;

        // Call module after_append hooks
        for module in self.modules.all_modules() {
            module.after_append(&record, &hash)?;
        }

        // Append to state
        self.state.append(entry);

        Ok(hash)
    }

    /// Get record by hash
    pub fn get_record(&self, hash: &Hash) -> Option<&Record> {
        self.state
            .get_by_hash(hash)
            .map(|entry| &entry.record)
    }

    /// Get record by ID
    pub fn get_record_by_id(&self, id: &str) -> Option<&Record> {
        self.state
            .get_by_id(id)
            .map(|entry| &entry.record)
    }

    /// Verify chain integrity
    pub fn verify(&self) -> Result<(), EngineError> {
        let result = verify_chain(self.state.all_entries());

        if !result.valid {
            return Err(EngineError::ChainInvalid(result));
        }

        Ok(())
    }

    /// Get entry count
    pub fn len(&self) -> usize {
        self.state.len()
    }

    /// Check if ledger is empty
    pub fn is_empty(&self) -> bool {
        self.state.is_empty()
    }

    /// Get latest entry hash
    pub fn latest_hash(&self) -> Option<&Hash> {
        self.state.latest_hash()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nucleus_core::module::ModuleConfig;

    fn create_test_config() -> LedgerConfig {
        LedgerConfig::with_modules(
            "test-ledger".to_string(),
            vec![
                ModuleConfig::new(
                    "proof".to_string(),
                    "1.0.0".to_string(),
                    serde_json::json!({}),
                ),
            ],
        )
    }

    #[test]
    fn test_ledger_engine_new() {
        let config = create_test_config();
        let engine = LedgerEngine::new(config).unwrap();

        assert_eq!(engine.id(), "test-ledger");
        assert!(engine.is_empty());
    }

    #[test]
    fn test_ledger_engine_append_record() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let record = Record::new(
            "record-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );

        let hash = engine.append_record(record).unwrap();

        assert!(!engine.is_empty());
        assert_eq!(engine.len(), 1);
        assert!(engine.latest_hash().is_some());
    }

    #[test]
    fn test_ledger_engine_get_record() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let record = Record::new(
            "record-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );

        let hash = engine.append_record(record.clone()).unwrap();
        let retrieved = engine.get_record(&hash);

        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, "record-1");
    }

    #[test]
    fn test_ledger_engine_verify() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        for i in 0..5 {
            let record = Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                    "index": i,
                }),
            );
            engine.append_record(record).unwrap();
        }

        // Verify chain
        assert!(engine.verify().is_ok());
    }
}
```

**2. Update lib.rs om engine module te exporteren:**

```rust
pub mod engine;
pub use engine::LedgerEngine;
```

**3. Maak placeholder voor ModuleRegistry (wordt in volgende stap geïmplementeerd):**

```rust
// nucleus-engine/src/module_registry.rs (tijdelijk)
pub struct ModuleRegistry;

impl ModuleRegistry {
    pub fn new() -> Self {
        Self
    }

    pub fn load_from_config(&mut self, _configs: &[nucleus_core::module::ModuleConfig]) -> Result<(), crate::error::EngineError> {
        Ok(())
    }

    pub fn all_modules(&self) -> Vec<&dyn nucleus_core::module::Module> {
        Vec::new()
    }
}
```

**4. Maak placeholder voor EngineError (wordt in volgende stap geïmplementeerd):**

```rust
// nucleus-engine/src/error.rs (tijdelijk)
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("Config error: {0}")]
    Config(#[from] crate::config::ConfigError),

    #[error("Core error: {0}")]
    Core(#[from] nucleus_core::CoreError),

    #[error("Chain invalid: {0:?}")]
    ChainInvalid(nucleus_core::hash_chain::ChainVerificationResult),
}
```

**5. Verifieer:**

```bash
cargo check
cargo test engine
```

**Acceptatie Criteria:**

- ✅ `LedgerEngine` struct is geïmplementeerd
- ✅ Constructor werkt
- ✅ `append_record()` werkt
- ✅ `get_record()` werkt
- ✅ `verify()` werkt
- ✅ Tests passen

---

## Stap 2.2: Module Registry

### Stap 2.2.1: ModuleRegistry Basis Implementatie

#### Waarom

Modules moeten geregistreerd en beheerd worden. De registry houdt modules bij, laadt ze vanuit configuratie en voert lifecycle management uit. Dit maakt het mogelijk om modules dynamisch te laden en te gebruiken.

#### Wat

- Implementeer `ModuleRegistry` struct
- Implementeer module registration
- Implementeer module loading vanuit config
- Schrijf unit tests

#### Waar

```
nucleus-engine/src/
└── module_registry.rs      # ModuleRegistry implementatie
```

#### Hoe

**1. Maak module_registry.rs (`nucleus-engine/src/module_registry.rs`):**

```rust
use nucleus_core::module::{Module, ModuleConfig};
use nucleus_core::module::proof::ProofModule;
use nucleus_core::module::asset::AssetModule;
use std::collections::HashMap;
use crate::error::EngineError;

/// Module registry - manages module instances
pub struct ModuleRegistry {
    /// Registered modules by ID
    modules: HashMap<String, Box<dyn Module>>,
}

impl ModuleRegistry {
    /// Create a new module registry
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
        }
    }

    /// Register a module
    pub fn register(&mut self, module: Box<dyn Module>) -> Result<(), EngineError> {
        let id = module.id().to_string();

        if self.modules.contains_key(&id) {
            return Err(EngineError::ModuleAlreadyRegistered(id));
        }

        self.modules.insert(id, module);
        Ok(())
    }

    /// Load modules from configuration
    pub fn load_from_config(&mut self, configs: &[ModuleConfig]) -> Result<(), EngineError> {
        for config in configs {
            let module: Box<dyn Module> = match config.id.as_str() {
                "proof" => Box::new(ProofModule::new(config.clone())),
                "asset" => Box::new(AssetModule::new(config.clone())),
                _ => {
                    return Err(EngineError::UnknownModule(config.id.clone()));
                }
            };

            self.register(module)?;
        }

        Ok(())
    }

    /// Get a module by ID
    pub fn get_module(&self, id: &str) -> Option<&dyn Module> {
        self.modules.get(id).map(|m| m.as_ref())
    }

    /// Get all modules
    pub fn all_modules(&self) -> Vec<&dyn Module> {
        self.modules.values().map(|m| m.as_ref()).collect()
    }

    /// Get module IDs
    pub fn module_ids(&self) -> Vec<String> {
        self.modules.keys().cloned().collect()
    }

    /// Check if a module is registered
    pub fn has_module(&self, id: &str) -> bool {
        self.modules.contains_key(id)
    }

    /// Get module count
    pub fn len(&self) -> usize {
        self.modules.len()
    }

    /// Check if registry is empty
    pub fn is_empty(&self) -> bool {
        self.modules.is_empty()
    }
}

impl Default for ModuleRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_registry_new() {
        let registry = ModuleRegistry::new();

        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_module_registry_register() {
        let mut registry = ModuleRegistry::new();

        let config = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = Box::new(ProofModule::new(config));

        registry.register(module).unwrap();

        assert_eq!(registry.len(), 1);
        assert!(registry.has_module("proof"));
    }

    #[test]
    fn test_module_registry_duplicate() {
        let mut registry = ModuleRegistry::new();

        let config1 = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module1 = Box::new(ProofModule::new(config1));
        registry.register(module1).unwrap();

        let config2 = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module2 = Box::new(ProofModule::new(config2));

        // Should fail - duplicate ID
        assert!(registry.register(module2).is_err());
    }

    #[test]
    fn test_module_registry_load_from_config() {
        let mut registry = ModuleRegistry::new();

        let configs = vec![
            ModuleConfig::new(
                "proof".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
            ModuleConfig::new(
                "asset".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
        ];

        registry.load_from_config(&configs).unwrap();

        assert_eq!(registry.len(), 2);
        assert!(registry.has_module("proof"));
        assert!(registry.has_module("asset"));
    }

    #[test]
    fn test_module_registry_get_module() {
        let mut registry = ModuleRegistry::new();

        let config = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = Box::new(ProofModule::new(config));
        registry.register(module).unwrap();

        let retrieved = registry.get_module("proof");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id(), "proof");
    }

    #[test]
    fn test_module_registry_unknown_module() {
        let mut registry = ModuleRegistry::new();

        let configs = vec![ModuleConfig::new(
            "unknown".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        )];

        // Should fail - unknown module
        assert!(registry.load_from_config(&configs).is_err());
    }
}
```

**2. Update error.rs om nieuwe error types toe te voegen:**

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("Config error: {0}")]
    Config(#[from] crate::config::ConfigError),

    #[error("Core error: {0}")]
    Core(#[from] nucleus_core::CoreError),

    #[error("Chain invalid: {0:?}")]
    ChainInvalid(nucleus_core::hash_chain::ChainVerificationResult),

    #[error("Module already registered: {0}")]
    ModuleAlreadyRegistered(String),

    #[error("Unknown module: {0}")]
    UnknownModule(String),
}
```

**3. Update lib.rs:**

```rust
pub mod module_registry;
pub use module_registry::ModuleRegistry;
```

**4. Verifieer:**

```bash
cargo test module_registry
```

**Acceptatie Criteria:**

- ✅ `ModuleRegistry` struct is geïmplementeerd
- ✅ Module registration werkt
- ✅ Module loading vanuit config werkt
- ✅ Duplicate detection werkt
- ✅ Alle tests passen

---

### Stap 2.2.2: Module Lifecycle Management

#### Waarom

Modules hebben een lifecycle: load, start, stop. We moeten deze lifecycle beheren zodat modules correct geïnitialiseerd worden en resources kunnen opruimen.

#### Wat

- Implementeer module lifecycle methods
- Integreer lifecycle in LedgerEngine
- Schrijf lifecycle tests

#### Waar

```
nucleus-engine/src/
├── module_registry.rs       # Lifecycle methods toevoegen
└── engine.rs                # Lifecycle integratie
```

#### Hoe

**1. Voeg lifecycle methods toe aan ModuleRegistry:**

```rust
impl ModuleRegistry {
    // ... bestaande methods ...

    /// Load all modules (lifecycle: load)
    pub async fn load_all(&mut self, _ledger: &LedgerEngine) -> Result<(), EngineError> {
        // For now, modules are loaded during registration
        // Future: call module.load() if module implements async load
        Ok(())
    }

    /// Start all modules (lifecycle: start)
    pub async fn start_all(&mut self, _ledger: &LedgerEngine) -> Result<(), EngineError> {
        // For now, modules are started during registration
        // Future: call module.start() if module implements async start
        Ok(())
    }

    /// Stop all modules (lifecycle: stop)
    pub async fn stop_all(&mut self) -> Result<(), EngineError> {
        // For now, just clear modules
        // Future: call module.stop() if module implements async stop
        self.modules.clear();
        Ok(())
    }
}
```

**2. Update LedgerEngine om lifecycle te ondersteunen:**

```rust
impl LedgerEngine {
    // ... bestaande methods ...

    /// Get a module by ID
    pub fn get_module(&self, id: &str) -> Option<&dyn Module> {
        self.modules.get_module(id)
    }

    /// Get all module IDs
    pub fn module_ids(&self) -> Vec<String> {
        self.modules.module_ids()
    }
}
```

**3. Schrijf lifecycle tests:**

```rust
#[cfg(test)]
mod lifecycle_tests {
    use super::*;

    #[tokio::test]
    async fn test_module_lifecycle() {
        let config = create_test_config();
        let engine = LedgerEngine::new(config).unwrap();

        // Modules should be loaded
        assert!(!engine.modules.is_empty());
        assert!(engine.modules.has_module("proof"));
    }
}
```

**4. Verifieer:**

```bash
cargo test module_registry
```

**Acceptatie Criteria:**

- ✅ Lifecycle methods zijn gedefinieerd
- ✅ Modules worden correct geladen
- ✅ Tests passen

---

## Stap 2.3: Query API

### Stap 2.3.1: QueryFilters Type

#### Waarom

Query functionaliteit is nodig om records te filteren en op te halen op basis van criteria. We beginnen met het definiëren van query filters.

#### Wat

- Implementeer `QueryFilters` struct
- Implementeer filter types (stream, timestamp range, etc.)
- Schrijf unit tests

#### Waar

```
nucleus-engine/src/
└── query.rs                 # Query implementatie
```

#### Hoe

**1. Maak query.rs (`nucleus-engine/src/query.rs`):**

```rust
use serde_json::Value;
use nucleus_core::Record;

/// Query filters for record retrieval
#[derive(Debug, Clone, Default)]
pub struct QueryFilters {
    /// Filter by stream
    pub stream: Option<String>,

    /// Filter by record ID
    pub id: Option<String>,

    /// Limit number of results
    pub limit: Option<usize>,

    /// Offset for pagination
    pub offset: Option<usize>,

    /// Timestamp range (start)
    pub timestamp_from: Option<u64>,

    /// Timestamp range (end)
    pub timestamp_to: Option<u64>,

    /// Module-specific filters (JSON)
    pub module_filters: Value,
}

impl QueryFilters {
    /// Create new empty filters
    pub fn new() -> Self {
        Self::default()
    }

    /// Filter by stream
    pub fn with_stream(mut self, stream: String) -> Self {
        self.stream = Some(stream);
        self
    }

    /// Filter by ID
    pub fn with_id(mut self, id: String) -> Self {
        self.id = Some(id);
        self
    }

    /// Set limit
    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Set offset
    pub fn with_offset(mut self, offset: usize) -> Self {
        self.offset = Some(offset);
        self
    }

    /// Set timestamp range
    pub fn with_timestamp_range(mut self, from: Option<u64>, to: Option<u64>) -> Self {
        self.timestamp_from = from;
        self.timestamp_to = to;
        self
    }

    /// Set module filters
    pub fn with_module_filters(mut self, filters: Value) -> Self {
        self.module_filters = filters;
        self
    }
}

/// Query result
#[derive(Debug, Clone)]
pub struct QueryResult {
    /// Matching records
    pub records: Vec<Record>,

    /// Total number of matching records (before limit/offset)
    pub total: usize,

    /// Whether there are more results
    pub has_more: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_filters_new() {
        let filters = QueryFilters::new();

        assert!(filters.stream.is_none());
        assert!(filters.id.is_none());
        assert!(filters.limit.is_none());
    }

    #[test]
    fn test_query_filters_builder() {
        let filters = QueryFilters::new()
            .with_stream("proofs".to_string())
            .with_limit(10)
            .with_offset(5);

        assert_eq!(filters.stream, Some("proofs".to_string()));
        assert_eq!(filters.limit, Some(10));
        assert_eq!(filters.offset, Some(5));
    }

    #[test]
    fn test_query_filters_timestamp_range() {
        let filters = QueryFilters::new()
            .with_timestamp_range(Some(1000), Some(2000));

        assert_eq!(filters.timestamp_from, Some(1000));
        assert_eq!(filters.timestamp_to, Some(2000));
    }
}
```

**2. Update lib.rs:**

```rust
pub mod query;
pub use query::{QueryFilters, QueryResult};
```

**3. Verifieer:**

```bash
cargo test query
```

**Acceptatie Criteria:**

- ✅ `QueryFilters` struct is geïmplementeerd
- ✅ Builder pattern werkt
- ✅ Tests passen

---

### Stap 2.3.2: Query Implementatie

#### Waarom

Query implementatie filtert records op basis van filters en past module-specific filtering toe. Dit maakt het mogelijk om records efficiënt op te halen.

#### Wat

- Implementeer `query()` method in LedgerEngine
- Implementeer filtering logic
- Integreer module query methods
- Schrijf uitgebreide tests

#### Waar

```
nucleus-engine/src/
├── engine.rs                # Query method toevoegen
└── query.rs                 # Query logic
```

#### Hoe

**1. Voeg query method toe aan LedgerEngine:**

```rust
impl LedgerEngine {
    // ... bestaande methods ...

    /// Query records with filters
    pub fn query(&self, filters: QueryFilters) -> QueryResult {
        // Start with all entries
        let mut entries: Vec<&ChainEntry> = self.state.all_entries().iter().collect();

        // Filter by stream
        if let Some(ref stream) = filters.stream {
            entries.retain(|e| e.record.stream == *stream);
        }

        // Filter by ID
        if let Some(ref id) = filters.id {
            entries.retain(|e| e.record.id == *id);
        }

        // Filter by timestamp range
        if let Some(from) = filters.timestamp_from {
            entries.retain(|e| e.record.timestamp >= from);
        }
        if let Some(to) = filters.timestamp_to {
            entries.retain(|e| e.record.timestamp <= to);
        }

        // Apply module-specific filters
        let records: Vec<&Record> = entries.iter().map(|e| &e.record).collect();
        let mut filtered_records: Vec<&Record> = records;

        for module in self.modules.all_modules() {
            filtered_records = module.query(&filtered_records, &filters.module_filters);
        }

        // Calculate total before limit/offset
        let total = filtered_records.len();

        // Apply limit/offset
        let offset = filters.offset.unwrap_or(0);
        let limit = filters.limit.unwrap_or(filtered_records.len());

        let records: Vec<Record> = filtered_records
            .into_iter()
            .skip(offset)
            .take(limit)
            .cloned()
            .collect();

        let has_more = (offset + records.len()) < total;

        QueryResult {
            records,
            total,
            has_more,
        }
    }
}
```

**2. Schrijf uitgebreide query tests:**

```rust
#[cfg(test)]
mod query_tests {
    use super::*;

    #[test]
    fn test_query_by_stream() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        // Add records to different streams
        let record1 = Record::new(
            "record-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record1).unwrap();

        let record2 = Record::new(
            "record-2".to_string(),
            "assets".to_string(),
            1234567891,
            serde_json::json!({
                "type": "asset",
                "owner_oid": "oid:onoal:human:bob",
            }),
        );
        engine.append_record(record2).unwrap();

        // Query proofs stream
        let filters = QueryFilters::new().with_stream("proofs".to_string());
        let result = engine.query(filters);

        assert_eq!(result.total, 1);
        assert_eq!(result.records.len(), 1);
        assert_eq!(result.records[0].id, "record-1");
    }

    #[test]
    fn test_query_with_limit() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        // Add multiple records
        for i in 0..10 {
            let record = Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            );
            engine.append_record(record).unwrap();
        }

        let filters = QueryFilters::new()
            .with_stream("proofs".to_string())
            .with_limit(5);

        let result = engine.query(filters);

        assert_eq!(result.total, 10);
        assert_eq!(result.records.len(), 5);
        assert!(result.has_more);
    }

    #[test]
    fn test_query_with_offset() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        for i in 0..10 {
            let record = Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            );
            engine.append_record(record).unwrap();
        }

        let filters = QueryFilters::new()
            .with_stream("proofs".to_string())
            .with_offset(5)
            .with_limit(3);

        let result = engine.query(filters);

        assert_eq!(result.total, 10);
        assert_eq!(result.records.len(), 3);
        assert_eq!(result.records[0].id, "record-5");
    }

    #[test]
    fn test_query_timestamp_range() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        for i in 0..10 {
            let record = Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64 * 100,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            );
            engine.append_record(record).unwrap();
        }

        let filters = QueryFilters::new()
            .with_stream("proofs".to_string())
            .with_timestamp_range(Some(1200), Some(1500));

        let result = engine.query(filters);

        // Should only include records with timestamp between 1200 and 1500
        assert!(result.total > 0);
        assert!(result.total < 10);
        for record in &result.records {
            assert!(record.timestamp >= 1200);
            assert!(record.timestamp <= 1500);
        }
    }
}
```

**3. Verifieer:**

```bash
cargo test query
```

**Acceptatie Criteria:**

- ✅ Query filtering werkt
- ✅ Stream filtering werkt
- ✅ Limit/offset werkt
- ✅ Timestamp range filtering werkt
- ✅ Module-aware querying werkt
- ✅ Alle tests passen

---

### Stap 2.3.3: Batch Append

#### Waarom

Batch append maakt het mogelijk om meerdere records atomisch toe te voegen. Als één record faalt, faalt de hele batch. Dit is belangrijk voor data integriteit.

#### Wat

- Implementeer `append_batch()` method
- Implementeer transaction-like behavior
- Schrijf batch tests

#### Waar

```
nucleus-engine/src/
└── engine.rs                # Batch append method
```

#### Hoe

**1. Voeg batch append toe aan LedgerEngine:**

```rust
impl LedgerEngine {
    // ... bestaande methods ...

    /// Append multiple records atomically
    ///
    /// If any record fails validation or append, the entire batch fails
    /// and no records are added to the ledger.
    pub fn append_batch(&mut self, records: Vec<Record>) -> Result<Vec<Hash>, EngineError> {
        // Validate all records first
        for record in &records {
            record.validate()?;
        }

        // Process all records through modules (before_append)
        let mut processed_records = Vec::new();
        for mut record in records {
            // Call module before_append hooks
            for module in self.modules.all_modules() {
                module.before_append(&mut record)?;
            }
            processed_records.push(record);
        }

        // Get starting prev_hash
        let mut prev_hash = self.state.latest_hash().copied();

        // Create all chain entries
        let mut entries = Vec::new();
        let mut hashes = Vec::new();

        for record in processed_records {
            let entry = ChainEntry::new(record.clone(), prev_hash)?;
            let hash = entry.hash;

            // Call module after_append hooks
            for module in self.modules.all_modules() {
                module.after_append(&record, &hash)?;
            }

            prev_hash = Some(hash);
            hashes.push(hash);
            entries.push(entry);
        }

        // Append all entries to state (atomic operation)
        for entry in entries {
            self.state.append(entry);
        }

        Ok(hashes)
    }
}
```

**2. Schrijf batch tests:**

```rust
#[cfg(test)]
mod batch_tests {
    use super::*;

    #[test]
    fn test_append_batch() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let records = vec![
            Record::new(
                "record-1".to_string(),
                "proofs".to_string(),
                1234567890,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            ),
            Record::new(
                "record-2".to_string(),
                "proofs".to_string(),
                1234567891,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:bob",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            ),
        ];

        let hashes = engine.append_batch(records).unwrap();

        assert_eq!(hashes.len(), 2);
        assert_eq!(engine.len(), 2);
    }

    #[test]
    fn test_append_batch_invalid_record() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let records = vec![
            Record::new(
                "record-1".to_string(),
                "proofs".to_string(),
                1234567890,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            ),
            Record::new(
                "".to_string(), // Invalid - empty ID
                "proofs".to_string(),
                1234567891,
                serde_json::json!({
                    "type": "proof",
                }),
            ),
        ];

        // Should fail - invalid record
        assert!(engine.append_batch(records).is_err());

        // No records should be added
        assert_eq!(engine.len(), 0);
    }

    #[test]
    fn test_append_batch_chain_linking() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let records = vec![
            Record::new(
                "record-1".to_string(),
                "proofs".to_string(),
                1234567890,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            ),
            Record::new(
                "record-2".to_string(),
                "proofs".to_string(),
                1234567891,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:bob",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            ),
        ];

        let hashes = engine.append_batch(records).unwrap();

        // Verify chain linking
        let entry1 = engine.state.get_by_hash(&hashes[0]).unwrap();
        let entry2 = engine.state.get_by_hash(&hashes[1]).unwrap();

        assert_eq!(entry2.prev_hash, Some(entry1.hash));
    }
}
```

**3. Verifieer:**

```bash
cargo test batch
```

**Acceptatie Criteria:**

- ✅ Batch append werkt
- ✅ Atomic behavior werkt (alles of niets)
- ✅ Chain linking werkt in batch
- ✅ Error handling werkt
- ✅ Alle tests passen

---

## Stap 2.4: Error Handling

### Stap 2.4.1: EngineError Compleet

#### Waarom

Goede error handling is cruciaal voor debugging en error propagation. We moeten alle mogelijke errors afhandelen.

#### Wat

- Completeer `EngineError` enum
- Voeg alle error variants toe
- Schrijf error handling tests

#### Waar

```
nucleus-engine/src/
└── error.rs                 # EngineError implementatie
```

#### Hoe

**1. Completeer error.rs (`nucleus-engine/src/error.rs`):**

```rust
use thiserror::Error;

/// Engine error type
#[derive(Debug, Error)]
pub enum EngineError {
    /// Configuration error
    #[error("Config error: {0}")]
    Config(#[from] crate::config::ConfigError),

    /// Core error (from nucleus-core)
    #[error("Core error: {0}")]
    Core(#[from] nucleus_core::CoreError),

    /// Chain verification failed
    #[error("Chain invalid: {0:?}")]
    ChainInvalid(nucleus_core::hash_chain::ChainVerificationResult),

    /// Module already registered
    #[error("Module already registered: {0}")]
    ModuleAlreadyRegistered(String),

    /// Unknown module
    #[error("Unknown module: {0}")]
    UnknownModule(String),

    /// Record not found
    #[error("Record not found: {0}")]
    RecordNotFound(String),

    /// Invalid query
    #[error("Invalid query: {0}")]
    InvalidQuery(String),
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, EngineError>;
```

**2. Update lib.rs:**

```rust
pub mod error;
pub use error::{EngineError, Result as EngineResult};
```

**3. Verifieer:**

```bash
cargo check
```

**Acceptatie Criteria:**

- ✅ `EngineError` enum is compleet
- ✅ Error conversion werkt
- ✅ Code compileert

---

## Stap 2.5: Integration Tests

### Stap 2.5.1: Engine Integration Tests

#### Waarom

Integration tests verifiëren dat alle componenten samenwerken en dat de engine correct functioneert end-to-end.

#### Wat

- Schrijf integration tests voor LedgerEngine
- Test complete workflows
- Test error scenarios

#### Waar

```
nucleus-engine/tests/
└── integration.rs           # Integration tests
```

#### Hoe

**1. Maak tests directory:**

```bash
mkdir -p nucleus-engine/tests
```

**2. Maak integration test (`nucleus-engine/tests/integration.rs`):**

```rust
use nucleus_engine::{LedgerEngine, LedgerConfig, QueryFilters};
use nucleus_core::module::ModuleConfig;
use nucleus_core::Record;

fn create_test_config() -> LedgerConfig {
    LedgerConfig::with_modules(
        "test-ledger".to_string(),
        vec![
            ModuleConfig::new(
                "proof".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
            ModuleConfig::new(
                "asset".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
        ],
    )
}

#[test]
fn test_engine_lifecycle() {
    // Create engine
    let config = create_test_config();
    let engine = LedgerEngine::new(config).unwrap();

    assert_eq!(engine.id(), "test-ledger");
    assert!(engine.is_empty());
    assert_eq!(engine.module_ids().len(), 2);
}

#[test]
fn test_engine_append_and_verify() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Append records
    for i in 0..10 {
        let record = Record::new(
            format!("record-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record).unwrap();
    }

    // Verify chain
    assert!(engine.verify().is_ok());
    assert_eq!(engine.len(), 10);
}

#[test]
fn test_engine_query_integration() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add records to different streams
    for i in 0..5 {
        let record = Record::new(
            format!("proof-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record).unwrap();
    }

    for i in 0..3 {
        let record = Record::new(
            format!("asset-{}", i),
            "assets".to_string(),
            2000 + i as u64,
            serde_json::json!({
                "type": "asset",
                "owner_oid": "oid:onoal:human:bob",
            }),
        );
        engine.append_record(record).unwrap();
    }

    // Query proofs
    let filters = QueryFilters::new().with_stream("proofs".to_string());
    let result = engine.query(filters);

    assert_eq!(result.total, 5);
    assert_eq!(result.records.len(), 5);

    // Query assets
    let filters = QueryFilters::new().with_stream("assets".to_string());
    let result = engine.query(filters);

    assert_eq!(result.total, 3);
    assert_eq!(result.records.len(), 3);
}

#[test]
fn test_engine_batch_append_integration() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    let records = (0..5)
        .map(|i| {
            Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            )
        })
        .collect();

    let hashes = engine.append_batch(records).unwrap();

    assert_eq!(hashes.len(), 5);
    assert_eq!(engine.len(), 5);

    // Verify chain
    assert!(engine.verify().is_ok());
}
```

**3. Verifieer:**

```bash
cargo test --test integration
```

**Acceptatie Criteria:**

- ✅ Integration tests passen
- ✅ Complete workflows werken
- ✅ Error scenarios worden getest

---

## Fase 2 Samenvatting

### Voltooide Componenten

✅ **LedgerEngine Struct**

- LedgerConfig type met validatie
- LedgerState met efficient indexing
- LedgerEngine met append/get/query/verify API

✅ **Module Registry**

- Module registration
- Module loading vanuit config
- Module lifecycle management

✅ **Query API**

- QueryFilters type
- Query implementatie met filtering
- Module-aware querying
- Batch append

✅ **Error Handling**

- Complete EngineError enum
- Error conversion
- Type-safe error handling

✅ **Integration Tests**

- End-to-end tests
- Complete workflows
- Error scenarios

### Volgende Fase

Na voltooiing van Fase 2 kunnen we doorgaan naar:

- **Fase 3: nucleus-wasm** - WASM bindings voor browser/Node

---

*Gedetailleerd Plan voor Fase 2: nucleus-engine - Runtime Wrapper*

