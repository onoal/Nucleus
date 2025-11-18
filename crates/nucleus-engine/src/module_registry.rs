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
}

