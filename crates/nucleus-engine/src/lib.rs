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

// Re-export commonly used types
pub use engine::LedgerEngine;
pub use config::LedgerConfig;
pub use error::EngineError;
pub use query::{QueryFilters, QueryResult};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_setup() {
        // Basic smoke test
        assert!(true);
    }
}

