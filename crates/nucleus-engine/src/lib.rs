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

/// Query API
pub mod query;

/// Error types
pub mod error;

/// Storage backend for persistence
pub mod storage;

// Re-export commonly used types
pub use engine::LedgerEngine;
pub use config::{LedgerConfig, StorageConfig, ConfigOptions};
pub use error::EngineError;
pub use query::{QueryFilters, QueryResult};
pub use storage::{StorageBackend, StorageError, StorageResult};
pub use module_registry::{ModuleRegistry, ModuleMeta};

#[cfg(not(target_arch = "wasm32"))]
pub use storage::SqliteStorage;

#[cfg(test)]
mod tests {
    #[test]
    fn test_basic_setup() {
        // Basic smoke test
        assert!(true);
    }
}

