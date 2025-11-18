use serde::{Deserialize, Serialize};

/// Module configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModuleConfig {
    /// Module identifier
    pub id: String,

    /// Module version
    pub version: String,

    /// Module-specific configuration (JSON)
    pub config: serde_json::Value,
}

impl ModuleConfig {
    /// Create a new module configuration
    pub fn new(id: String, version: String, config: serde_json::Value) -> Self {
        Self {
            id,
            version,
            config,
        }
    }
}

