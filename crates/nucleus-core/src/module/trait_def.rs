use crate::{Record, Hash, CoreError};
use serde_json::Value;

/// Module trait - defines the interface for ledger modules
pub trait Module: Send + Sync {
    /// Module identifier
    fn id(&self) -> &str;

    /// Module version
    fn version(&self) -> &str;

    /// Process record before append
    /// Can modify record or return error to prevent append
    fn before_append(&self, record: &mut Record) -> Result<(), CoreError>;

    /// Process record after append
    /// Can perform side effects (logging, notifications, etc.)
    fn after_append(&self, record: &Record, hash: &Hash) -> Result<(), CoreError>;

    /// Validate record
    /// Should return error if record is invalid for this module
    fn validate(&self, record: &Record) -> Result<(), CoreError>;

    /// Query records (module-specific filtering)
    /// Returns filtered list of records
    fn query<'a>(&self, records: &'a [Record], filters: &Value) -> Vec<&'a Record>;
}

