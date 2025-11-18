/// Module trait definition
pub mod trait_def;

/// Module configuration
pub mod config;

/// Module context for lifecycle operations
pub mod context;

/// Module error types
pub mod error;

/// Proof module implementation
pub mod proof;

/// Asset module implementation
pub mod asset;

pub use trait_def::{Module, ModuleState};
pub use config::ModuleConfig;
pub use context::ModuleContext;
pub use error::{ModuleError, ModuleResult};

