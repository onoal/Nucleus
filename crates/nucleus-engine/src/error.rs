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

    /// Record error (from nucleus-core)
    #[error("Record error: {0}")]
    Record(#[from] nucleus_core::record::RecordError),

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
    
    /// Storage error
    #[error("Storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, EngineError>;

