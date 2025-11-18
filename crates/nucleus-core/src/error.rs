use thiserror::Error;

/// Core error type for nucleus-core
#[derive(Debug, Error)]
pub enum CoreError {
    /// Hash error
    #[error("Hash error: {0}")]
    Hash(#[from] crate::hash::HashError),

    /// Record validation error
    #[error("Record error: {0}")]
    Record(#[from] crate::record::RecordError),

    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Invalid record structure
    #[error("Invalid record: {0}")]
    InvalidRecord(String),

    /// Chain verification error
    #[error("Chain verification failed: {0}")]
    ChainVerification(String),

    /// Module error
    #[error("Module error: {0}")]
    Module(String),
}

