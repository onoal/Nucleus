use nucleus_core::module::{Module, ModuleConfig, ModuleContext, ModuleState};
use nucleus_core::module::proof::ProofModule;
use nucleus_core::module::asset::AssetModule;
use std::collections::HashMap;
use crate::error::EngineError;

/// Module metadata
#[derive(Debug, Clone)]
pub struct ModuleMeta {
    /// Module ID
    pub id: String,
    /// Module version
    pub version: String,
    /// Current lifecycle state
    pub state: ModuleState,
}

/// Module registry - manages module instances and lifecycle
///
/// The registry is owned by each `LedgerEngine` instance (per-ledger scope).
/// It manages:
/// - Module registration
/// - Lifecycle (init → start → stop)
/// - Module retrieval
///
/// # Lifecycle
///
/// 1. `register()` - Register modules
/// 2. `init_all()` - Initialize all modules
/// 3. `start_all()` - Start all modules
/// 4. Runtime operations
/// 5. `stop_all()` - Stop all modules (cleanup)
pub struct ModuleRegistry {
    /// Registered modules by ID
    modules: HashMap<String, Box<dyn Module>>,
    /// Module metadata (state tracking)
    meta: HashMap<String, ModuleMeta>,
    /// Ledger ID (for context)
    ledger_id: String,
}

impl ModuleRegistry {
    /// Create a new module registry
    pub fn new() -> Self {
        Self::with_ledger_id("default".to_string())
    }

    /// Create a new module registry with ledger ID
    pub fn with_ledger_id(ledger_id: String) -> Self {
        Self {
            modules: HashMap::new(),
            meta: HashMap::new(),
            ledger_id,
        }
    }

    /// Register a module
    ///
    /// Adds a module to the registry in `Registered` state.
    /// The module must be initialized and started before use.
    ///
    /// # Errors
    ///
    /// Returns error if module ID is already registered.
    pub fn register(&mut self, module: Box<dyn Module>) -> Result<(), EngineError> {
        let id = module.id().to_string();
        let version = module.version().to_string();

        if self.modules.contains_key(&id) {
            return Err(EngineError::ModuleAlreadyRegistered(id));
        }

        // Store metadata
        self.meta.insert(id.clone(), ModuleMeta {
            id: id.clone(),
            version,
            state: ModuleState::Registered,
        });

        self.modules.insert(id, module);
        Ok(())
    }

    /// Initialize all modules
    ///
    /// Calls `init()` on all registered modules.
    /// Modules move from `Registered` to `Initialized` state.
    ///
    /// # Errors
    ///
    /// If any module fails to initialize, the entire operation fails.
    /// Already initialized modules are skipped.
    pub fn init_all(&mut self) -> Result<(), EngineError> {
        for (id, module) in &mut self.modules {
            let meta = self.meta.get(id).ok_or_else(|| {
                EngineError::UnknownModule(id.clone())
            })?;

            // Skip if already initialized or started
            if meta.state == ModuleState::Initialized || meta.state == ModuleState::Started {
                continue;
            }

            // Create context
            let ctx = ModuleContext::new(
                self.ledger_id.clone(),
                serde_json::json!({}), // TODO: Pass module config
            );

            // Initialize module
            module.init(&ctx).map_err(|e| {
                EngineError::UnknownModule(format!("Module '{}' init failed: {}", id, e))
            })?;

            // Update state
            if let Some(meta) = self.meta.get_mut(id) {
                meta.state = ModuleState::Initialized;
            }
        }

        Ok(())
    }

    /// Start all modules
    ///
    /// Calls `start()` on all initialized modules.
    /// Modules move from `Initialized` to `Started` state.
    ///
    /// # Errors
    ///
    /// If any module fails to start, the entire operation fails.
    /// Modules that are not initialized will be skipped.
    pub fn start_all(&mut self) -> Result<(), EngineError> {
        for (id, module) in &mut self.modules {
            let meta = self.meta.get(id).ok_or_else(|| {
                EngineError::UnknownModule(id.clone())
            })?;

            // Skip if not initialized or already started
            if meta.state != ModuleState::Initialized {
                continue;
            }

            // Create context
            let ctx = ModuleContext::new(
                self.ledger_id.clone(),
                serde_json::json!({}),
            );

            // Start module
            module.start(&ctx).map_err(|e| {
                EngineError::UnknownModule(format!("Module '{}' start failed: {}", id, e))
            })?;

            // Update state
            if let Some(meta) = self.meta.get_mut(id) {
                meta.state = ModuleState::Started;
            }
        }

        Ok(())
    }

    /// Stop all modules
    ///
    /// Calls `stop()` on all started modules.
    /// This is a best-effort operation - errors are logged but don't fail.
    ///
    /// Modules move from `Started` to `Stopped` state.
    pub fn stop_all(&mut self) {
        for (id, module) in &mut self.modules {
            let meta = match self.meta.get(id) {
                Some(m) => m,
                None => continue,
            };

            // Skip if not started
            if meta.state != ModuleState::Started {
                continue;
            }

            // Create context
            let ctx = ModuleContext::new(
                self.ledger_id.clone(),
                serde_json::json!({}),
            );

            // Stop module (best-effort)
            if let Err(e) = module.stop(&ctx) {
                eprintln!("Warning: Module '{}' stop failed: {}", id, e);
            }

            // Update state
            if let Some(meta) = self.meta.get_mut(id) {
                meta.state = ModuleState::Stopped;
            }
        }
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

    /// Get module state
    pub fn get_state(&self, id: &str) -> Option<ModuleState> {
        self.meta.get(id).map(|m| m.state)
    }

    /// Get all module metadata
    pub fn get_all_meta(&self) -> Vec<ModuleMeta> {
        self.meta.values().cloned().collect()
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

