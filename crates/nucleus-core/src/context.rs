//! Request context for authentication and authorization
//!
//! Every ledger operation that mutates state or reads sensitive data
//! MUST include a request context with a requester OID.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Request context error
#[derive(Debug, Error)]
pub enum ContextError {
    /// Requester OID is missing
    #[error("Requester OID is required")]
    RequesterOidMissing,
    
    /// Invalid OID format
    #[error("Invalid OID format: {0}")]
    InvalidOid(String),
    
    /// Context validation failed
    #[error("Context validation failed: {0}")]
    ValidationFailed(String),
}

/// Request context for ledger operations
///
/// Contains information about who is making the request and when.
/// This is used for:
/// - Access control (UAL - Unified Access Layer)
/// - Audit logging
/// - Record attribution
///
/// # Important
///
/// The `requester_oid` is **REQUIRED** for all operations that:
/// - Mutate ledger state (append, batch append)
/// - Read sensitive data
/// - Perform administrative operations
///
/// Operations without context will be **REJECTED**.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RequestContext {
    /// OID of the entity making the request (REQUIRED)
    ///
    /// Format: `oid:onoal:{type}:{id}`
    /// Examples:
    /// - `oid:onoal:human:alice`
    /// - `oid:onoal:org:acme-corp`
    /// - `oid:onoal:service:api-gateway`
    pub requester_oid: String,
    
    /// Request timestamp (unix milliseconds)
    pub timestamp: u64,
    
    /// Optional additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

impl RequestContext {
    /// Create a new request context
    ///
    /// # Arguments
    ///
    /// * `requester_oid` - OID of the requester (format: `oid:onoal:{type}:{id}`)
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// use nucleus_core::context::RequestContext;
    ///
    /// let ctx = RequestContext::new("oid:onoal:human:alice".to_string());
    /// ```
    pub fn new(requester_oid: String) -> Self {
        Self {
            requester_oid,
            timestamp: Self::current_timestamp(),
            metadata: None,
        }
    }
    
    /// Create with custom timestamp
    pub fn with_timestamp(requester_oid: String, timestamp: u64) -> Self {
        Self {
            requester_oid,
            timestamp,
            metadata: None,
        }
    }
    
    /// Add metadata
    pub fn with_metadata(mut self, metadata: HashMap<String, serde_json::Value>) -> Self {
        self.metadata = Some(metadata);
        self
    }
    
    /// Set a metadata value
    pub fn set_metadata(&mut self, key: String, value: serde_json::Value) {
        self.metadata
            .get_or_insert_with(HashMap::new)
            .insert(key, value);
    }
    
    /// Get a metadata value
    pub fn get_metadata(&self, key: &str) -> Option<&serde_json::Value> {
        self.metadata.as_ref()?.get(key)
    }
    
    /// Validate the context
    ///
    /// Checks:
    /// - Requester OID is not empty
    /// - Requester OID has valid format (oid:onoal:{type}:{id})
    /// - Timestamp is reasonable (not in the future)
    ///
    /// # Returns
    ///
    /// - `Ok(())` if valid
    /// - `Err(ContextError)` if invalid
    pub fn validate(&self) -> Result<(), ContextError> {
        // Check requester OID is not empty
        if self.requester_oid.is_empty() {
            return Err(ContextError::RequesterOidMissing);
        }
        
        // Basic OID format validation
        if !self.requester_oid.starts_with("oid:onoal:") {
            return Err(ContextError::InvalidOid(
                format!("OID must start with 'oid:onoal:', got: {}", self.requester_oid)
            ));
        }
        
        // Check OID has at least 4 parts (oid:onoal:type:id)
        let parts: Vec<&str> = self.requester_oid.split(':').collect();
        if parts.len() < 4 {
            return Err(ContextError::InvalidOid(
                format!("OID must have format 'oid:onoal:{{type}}:{{id}}', got: {}", self.requester_oid)
            ));
        }
        
        // Timestamp validation (not too far in the future)
        let now = Self::current_timestamp();
        let future_threshold = now + 300_000; // 5 minutes
        if self.timestamp > future_threshold {
            return Err(ContextError::ValidationFailed(
                format!("Timestamp is too far in the future: {}", self.timestamp)
            ));
        }
        
        Ok(())
    }
    
    /// Get current timestamp (unix milliseconds)
    fn current_timestamp() -> u64 {
        #[cfg(not(target_arch = "wasm32"))]
        {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64
        }
        
        #[cfg(target_arch = "wasm32")]
        {
            // For WASM builds, timestamp is set to 0 by default.
            // The WASM bindings layer should fill in the actual timestamp
            // from the JavaScript Date.now() when creating the context.
            0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_new() {
        let ctx = RequestContext::new("oid:onoal:human:alice".to_string());
        
        assert_eq!(ctx.requester_oid, "oid:onoal:human:alice");
        assert!(ctx.timestamp > 0);
        assert!(ctx.metadata.is_none());
    }

    #[test]
    fn test_context_with_metadata() {
        let mut metadata = HashMap::new();
        metadata.insert("ip".to_string(), serde_json::json!("192.168.1.1"));
        
        let ctx = RequestContext::new("oid:onoal:human:alice".to_string())
            .with_metadata(metadata);
        
        assert!(ctx.metadata.is_some());
        assert_eq!(
            ctx.get_metadata("ip"),
            Some(&serde_json::json!("192.168.1.1"))
        );
    }

    #[test]
    fn test_context_validate_success() {
        let ctx = RequestContext::new("oid:onoal:human:alice".to_string());
        assert!(ctx.validate().is_ok());
        
        let ctx = RequestContext::new("oid:onoal:org:acme-corp".to_string());
        assert!(ctx.validate().is_ok());
        
        let ctx = RequestContext::new("oid:onoal:service:api-gateway".to_string());
        assert!(ctx.validate().is_ok());
    }

    #[test]
    fn test_context_validate_empty_oid() {
        let ctx = RequestContext::new("".to_string());
        assert!(matches!(ctx.validate(), Err(ContextError::RequesterOidMissing)));
    }

    #[test]
    fn test_context_validate_invalid_format() {
        let ctx = RequestContext::new("not-an-oid".to_string());
        assert!(matches!(ctx.validate(), Err(ContextError::InvalidOid(_))));
        
        let ctx = RequestContext::new("oid:wrong:format".to_string());
        assert!(matches!(ctx.validate(), Err(ContextError::InvalidOid(_))));
        
        let ctx = RequestContext::new("oid:onoal:human".to_string()); // Missing ID
        assert!(matches!(ctx.validate(), Err(ContextError::InvalidOid(_))));
    }

    #[test]
    fn test_context_validate_future_timestamp() {
        let far_future = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64 + 1_000_000; // Way in the future
        
        let ctx = RequestContext::with_timestamp(
            "oid:onoal:human:alice".to_string(),
            far_future
        );
        
        assert!(matches!(ctx.validate(), Err(ContextError::ValidationFailed(_))));
    }
}

