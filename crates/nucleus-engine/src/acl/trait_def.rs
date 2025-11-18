use super::types::{Grant, CheckParams, RevokeParams};
use super::error::AclResult;

/// ACL Backend trait
///
/// Defines the interface for Access Control List implementations.
pub trait AclBackend: Send {
    /// Grant access to a resource
    fn grant(&mut self, grant: Grant) -> AclResult<()>;

    /// Check if access is allowed
    fn check(&self, params: &CheckParams) -> AclResult<bool>;

    /// Revoke access to a resource
    fn revoke(&mut self, params: &RevokeParams) -> AclResult<()>;

    /// List all grants for a subject
    fn list_grants(&self, subject_oid: &str) -> AclResult<Vec<Grant>>;

    /// Clear all grants (useful for testing)
    fn clear(&mut self) -> AclResult<()>;
}

