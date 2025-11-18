//! Nucleus Core - Pure ledger engine
//!
//! This crate contains the canonical ledger engine implementation.
//! It has no I/O dependencies and can run in any environment.

/// Record types and structures
pub mod record;

/// Hash types and utilities
pub mod hash;

/// Anchor types and anchoring logic
pub mod anchor;

/// Error types
pub mod error;

/// Serialization utilities
pub mod serialization;

/// Hash chain implementation
pub mod hash_chain;

/// Module system
pub mod module;

// Re-export commonly used types
pub use record::Record;
pub use hash::Hash;
pub use error::CoreError;
pub use serialization::{serialize_canonical, compute_hash};
pub use hash_chain::{ChainEntry, ChainVerificationResult, verify_chain, ChainError};
pub use module::{Module, ModuleConfig};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_setup() {
        // Basic smoke test
        assert!(true);
    }
}

