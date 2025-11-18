use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Ledger record - represents a single entry in the ledger
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Record {
    /// Unique identifier for this record
    pub id: String,

    /// Stream type (e.g., "proofs", "assets", "consent")
    pub stream: String,

    /// Unix timestamp in milliseconds
    pub timestamp: u64,

    /// Record payload (JSON value)
    pub payload: Value,

    /// Optional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<Value>,
}

impl Record {
    /// Create a new record
    pub fn new(id: String, stream: String, timestamp: u64, payload: Value) -> Self {
        Self {
            id,
            stream,
            timestamp,
            payload,
            meta: None,
        }
    }

    /// Create a new record with metadata
    pub fn with_meta(
        id: String,
        stream: String,
        timestamp: u64,
        payload: Value,
        meta: Value,
    ) -> Self {
        Self {
            id,
            stream,
            timestamp,
            payload,
            meta: Some(meta),
        }
    }

    /// Validate record
    pub fn validate(&self) -> Result<(), RecordError> {
        if self.id.is_empty() {
            return Err(RecordError::InvalidId("ID cannot be empty".to_string()));
        }

        if self.stream.is_empty() {
            return Err(RecordError::InvalidStream("Stream cannot be empty".to_string()));
        }

        if self.timestamp == 0 {
            return Err(RecordError::InvalidTimestamp("Timestamp cannot be zero".to_string()));
        }

        if !self.payload.is_object() && !self.payload.is_array() {
            return Err(RecordError::InvalidPayload("Payload must be object or array".to_string()));
        }

        Ok(())
    }

    /// Get a reference to a field in the payload
    pub fn get_payload_field(&self, key: &str) -> Option<&Value> {
        self.payload.get(key)
    }

    /// Set a field in the payload
    pub fn set_payload_field(&mut self, key: String, value: Value) {
        if let Some(obj) = self.payload.as_object_mut() {
            obj.insert(key, value);
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RecordError {
    #[error("Invalid ID: {0}")]
    InvalidId(String),

    #[error("Invalid stream: {0}")]
    InvalidStream(String),

    #[error("Invalid timestamp: {0}")]
    InvalidTimestamp(String),

    #[error("Invalid payload: {0}")]
    InvalidPayload(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_new() {
        let record = Record::new(
            "test-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        assert_eq!(record.id, "test-1");
        assert_eq!(record.stream, "proofs");
        assert_eq!(record.timestamp, 1234567890);
        assert!(record.meta.is_none());
    }

    #[test]
    fn test_record_with_meta() {
        let record = Record::with_meta(
            "test-2".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
            serde_json::json!({"source": "api"}),
        );

        assert!(record.meta.is_some());
        assert_eq!(record.meta.as_ref().unwrap().get("source"), Some(&serde_json::json!("api")));
    }

    #[test]
    fn test_record_validate_success() {
        let record = Record::new(
            "test-3".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        assert!(record.validate().is_ok());
    }

    #[test]
    fn test_record_validate_empty_id() {
        let record = Record::new(
            "".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        assert!(record.validate().is_err());
    }

    #[test]
    fn test_record_serialization() {
        let record = Record::new(
            "test-4".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let json = serde_json::to_string(&record).unwrap();
        let deserialized: Record = serde_json::from_str(&json).unwrap();

        assert_eq!(record, deserialized);
    }
}

