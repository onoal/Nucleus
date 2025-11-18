//! Storage-related error types

use thiserror::Error;

/// Storage-related errors
#[derive(Debug, Error)]
pub enum StorageError {
    /// Database error
    #[error("Database error: {0}")]
    Database(String),

    /// Entry not found
    #[error("Entry not found: {0}")]
    NotFound(String),

    /// Integrity check failed
    #[error("Integrity check failed: {0}")]
    IntegrityFailed(String),

    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(String),

    /// Deserialization error
    #[error("Deserialization error: {0}")]
    Deserialization(String),

    /// Invalid data
    #[error("Invalid data: {0}")]
    InvalidData(String),

    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Storage result type
pub type StorageResult<T> = Result<T, StorageError>;

