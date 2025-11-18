//! Module context for lifecycle operations

use std::collections::HashMap;
use serde_json::Value;

/// Context passed to modules during lifecycle operations
///
/// This context provides modules with:
/// - Ledger configuration
/// - Module-specific configuration
/// - Shared state (if needed)
#[derive(Debug, Clone)]
pub struct ModuleContext {
    /// Ledger identifier
    pub ledger_id: String,
    
    /// Module-specific configuration
    pub module_config: Value,
    
    /// Shared context data (for cross-module communication)
    pub shared: HashMap<String, Value>,
}

impl ModuleContext {
    /// Create a new module context
    pub fn new(ledger_id: String, module_config: Value) -> Self {
        Self {
            ledger_id,
            module_config,
            shared: HashMap::new(),
        }
    }
    
    /// Get a value from shared context
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.shared.get(key)
    }
    
    /// Set a value in shared context
    pub fn set(&mut self, key: String, value: Value) {
        self.shared.insert(key, value);
    }
}

