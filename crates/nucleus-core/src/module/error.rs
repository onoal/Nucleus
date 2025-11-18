//! Module-specific error types

use thiserror::Error;

/// Module-specific errors
#[derive(Debug, Error)]
pub enum ModuleError {
    /// Initialization failed
    #[error("Module initialization failed: {0}")]
    InitFailed(String),
    
    /// Start failed
    #[error("Module start failed: {0}")]
    StartFailed(String),
    
    /// Stop failed
    #[error("Module stop failed: {0}")]
    StopFailed(String),
    
    /// Configuration error
    #[error("Module configuration error: {0}")]
    ConfigError(String),
    
    /// Module not found
    #[error("Module not found: {0}")]
    NotFound(String),
    
    /// Module already registered
    #[error("Module already registered: {0}")]
    AlreadyRegistered(String),
    
    /// Invalid state
    #[error("Invalid module state: {0}")]
    InvalidState(String),
    
    /// Operation failed
    #[error("Module operation failed: {0}")]
    OperationFailed(String),
}

/// Module result type
pub type ModuleResult<T> = Result<T, ModuleError>;

