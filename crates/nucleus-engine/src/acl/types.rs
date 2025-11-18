use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// ACL Grant
///
/// Represents a permission grant for a subject to access a resource.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Grant {
    /// Subject OID (who has access)
    pub subject_oid: String,

    /// Resource OID (what they can access)
    pub resource_oid: String,

    /// Action/permission (e.g., "read", "write", "admin")
    pub action: String,

    /// Who granted this access
    pub granted_by: String,

    /// When this grant was created (unix timestamp in seconds)
    pub granted_at: u64,

    /// Optional expiration (unix timestamp in seconds)
    pub expires_at: Option<u64>,

    /// Optional metadata
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Check parameters
///
/// Used to check if a requester has access to a resource.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckParams {
    /// Requester OID (who is requesting access)
    pub requester_oid: String,

    /// Resource OID (what they want to access)
    pub resource_oid: String,

    /// Action/permission (e.g., "read", "write", "admin")
    pub action: String,
}

/// Revoke parameters
///
/// Used to revoke access from a subject.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokeParams {
    /// Subject OID (whose access to revoke)
    pub subject_oid: String,

    /// Resource OID (what to revoke access to)
    pub resource_oid: String,

    /// Action/permission to revoke
    pub action: String,
}

