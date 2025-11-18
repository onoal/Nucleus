use crate::{Record, Hash, CoreError};
use serde_json::Value;
use super::context::ModuleContext;
use super::error::ModuleError;

/// Module lifecycle state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModuleState {
    /// Module is registered but not initialized
    Registered,
    /// Module is initialized
    Initialized,
    /// Module is started (active)
    Started,
    /// Module is stopped
    Stopped,
}

/// Module trait - defines the interface for ledger modules
///
/// # Lifecycle
///
/// Modules follow this lifecycle:
/// 1. `register()` - Module is registered with the registry
/// 2. `init()` - Module performs initialization (setup, validate config)
/// 3. `start()` - Module starts operations (can now process records)
/// 4. Runtime operations (before_append, after_append, validate, query)
/// 5. `stop()` - Module stops operations (cleanup, flush)
///
/// # Thread Safety
///
/// Modules must be `Send` but not `Sync`. Each ledger engine owns its modules
/// and should not share them across threads.
pub trait Module: Send {
    /// Module identifier (must be unique per ledger)
    fn id(&self) -> &str;

    /// Module version (semver recommended)
    fn version(&self) -> &str;

    /// Initialize module
    ///
    /// Called once after module is registered but before start.
    /// Use this to:
    /// - Validate configuration
    /// - Setup internal state
    /// - Prepare resources
    ///
    /// # Errors
    ///
    /// Return `ModuleError::InitFailed` if initialization fails.
    /// The module will not be started if init fails.
    fn init(&mut self, ctx: &ModuleContext) -> Result<(), ModuleError> {
        let _ = ctx;
        Ok(())
    }

    /// Start module
    ///
    /// Called after init, before the module can process records.
    /// Use this to:
    /// - Start background tasks
    /// - Open connections
    /// - Begin processing
    ///
    /// # Errors
    ///
    /// Return `ModuleError::StartFailed` if start fails.
    /// The engine will fail to start if any module fails to start.
    fn start(&mut self, ctx: &ModuleContext) -> Result<(), ModuleError> {
        let _ = ctx;
        Ok(())
    }

    /// Stop module
    ///
    /// Called when the engine is shutting down.
    /// Use this to:
    /// - Stop background tasks
    /// - Close connections
    /// - Flush buffers
    ///
    /// # Errors
    ///
    /// Errors are logged but don't prevent shutdown (best-effort).
    fn stop(&mut self, ctx: &ModuleContext) -> Result<(), ModuleError> {
        let _ = ctx;
        Ok(())
    }

    /// Process record before append
    ///
    /// Can modify record or return error to prevent append.
    /// Called for every record before it's added to the ledger.
    ///
    /// # Important
    ///
    /// Only called when module state is `Started`.
    fn before_append(&self, record: &mut Record) -> Result<(), CoreError>;

    /// Process record after append
    ///
    /// Can perform side effects (logging, notifications, etc.)
    /// Called after record is successfully added to the ledger.
    ///
    /// # Important
    ///
    /// Only called when module state is `Started`.
    fn after_append(&self, record: &Record, hash: &Hash) -> Result<(), CoreError>;

    /// Validate record
    ///
    /// Should return error if record is invalid for this module.
    /// Called during record validation before append.
    fn validate(&self, record: &Record) -> Result<(), CoreError>;

    /// Query records (module-specific filtering)
    ///
    /// Returns filtered list of records based on module-specific filters.
    /// Called during query operations.
    fn query<'a>(&self, records: &'a [Record], filters: &Value) -> Vec<&'a Record>;
}

