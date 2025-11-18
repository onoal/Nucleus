use nucleus_core::module::ModuleConfig;
use serde::{Deserialize, Serialize};

/// Storage configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StorageConfig {
    /// No persistence (in-memory only)
    None,
    
    /// SQLite storage
    Sqlite {
        /// Path to SQLite database file
        path: String,
    },
    
    /// PostgreSQL storage (future)
    #[allow(dead_code)]
    Postgres {
        /// PostgreSQL connection string
        connection_string: String,
    },
}

/// ACL (Access Control List) configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AclConfig {
    /// No ACL (all operations allowed)
    None,
    
    /// In-memory ACL
    InMemory,
}

/// Ledger engine configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LedgerConfig {
    /// Ledger identifier
    pub id: String,

    /// Modules to load
    pub modules: Vec<ModuleConfig>,

    /// Optional configuration
    pub options: Option<ConfigOptions>,
    
    /// Storage configuration
    pub storage: StorageConfig,
    
    /// ACL configuration
    pub acl: AclConfig,
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
    /// Create a new ledger config (in-memory only, no ACL)
    pub fn new(id: String) -> Self {
        Self {
            id,
            modules: Vec::new(),
            options: None,
            storage: StorageConfig::None,
            acl: AclConfig::None,
        }
    }

    /// Create a new ledger config with modules (in-memory only, no ACL)
    pub fn with_modules(id: String, modules: Vec<ModuleConfig>) -> Self {
        Self {
            id,
            modules,
            options: None,
            storage: StorageConfig::None,
            acl: AclConfig::None,
        }
    }
    
    /// Create a new ledger config with SQLite storage
    pub fn with_sqlite_storage(id: String, path: impl Into<String>) -> Self {
        Self {
            id,
            modules: Vec::new(),
            options: None,
            storage: StorageConfig::Sqlite { path: path.into() },
            acl: AclConfig::None,
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
    
    /// Set storage configuration
    pub fn with_storage(mut self, storage: StorageConfig) -> Self {
        self.storage = storage;
        self
    }
    
    /// Set ACL configuration
    pub fn with_acl(mut self, acl: AclConfig) -> Self {
        self.acl = acl;
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
}

