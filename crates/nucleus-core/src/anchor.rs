use crate::Hash;

/// Anchor - represents a checkpoint in the chain
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Anchor {
    /// Anchor identifier
    pub id: String,

    /// Hash of the latest entry at anchor point
    pub hash: Hash,

    /// Timestamp when anchor was created
    pub timestamp: u64,

    /// Number of entries up to this anchor
    pub entry_count: u64,
}

impl Anchor {
    /// Create a new anchor
    pub fn new(id: String, hash: Hash, timestamp: u64, entry_count: u64) -> Self {
        Self {
            id,
            hash,
            timestamp,
            entry_count,
        }
    }

    /// Validate anchor
    pub fn validate(&self) -> Result<(), AnchorError> {
        if self.id.is_empty() {
            return Err(AnchorError::InvalidId("ID cannot be empty".to_string()));
        }

        if self.timestamp == 0 {
            return Err(AnchorError::InvalidTimestamp("Timestamp cannot be zero".to_string()));
        }

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AnchorError {
    #[error("Invalid anchor ID: {0}")]
    InvalidId(String),

    #[error("Invalid timestamp: {0}")]
    InvalidTimestamp(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anchor_new() {
        let hash = Hash::from_bytes([1u8; 32]);
        let anchor = Anchor::new(
            "anchor-1".to_string(),
            hash,
            1234567890,
            100,
        );

        assert_eq!(anchor.id, "anchor-1");
        assert_eq!(anchor.hash, hash);
        assert_eq!(anchor.timestamp, 1234567890);
        assert_eq!(anchor.entry_count, 100);
    }

    #[test]
    fn test_anchor_validate() {
        let hash = Hash::from_bytes([1u8; 32]);
        let anchor = Anchor::new(
            "anchor-1".to_string(),
            hash,
            1234567890,
            200,
        );

        assert!(anchor.validate().is_ok());
    }
}

