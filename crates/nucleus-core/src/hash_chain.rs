use crate::{Record, Hash, CoreError};
use crate::serialization::compute_hash;

/// Chain entry - links a record to the previous entry via hash
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChainEntry {
    /// The record
    pub record: Record,

    /// Hash of this entry
    pub hash: Hash,

    /// Hash of previous entry (None for genesis)
    pub prev_hash: Option<Hash>,
}

impl ChainEntry {
    /// Create a new chain entry
    pub fn new(record: Record, prev_hash: Option<Hash>) -> Result<Self, CoreError> {
        // Validate record first
        record.validate()?;

        // Compute hash
        let hash = compute_hash(&record)?;

        Ok(Self {
            record,
            hash,
            prev_hash,
        })
    }

    /// Create a genesis entry (first in chain)
    pub fn genesis(record: Record) -> Result<Self, CoreError> {
        Self::new(record, None)
    }

    /// Verify this entry's hash matches computed hash
    pub fn verify_hash(&self) -> Result<(), ChainError> {
        let computed = compute_hash(&self.record)
            .map_err(|e| ChainError::Core(e))?;

        if computed != self.hash {
            return Err(ChainError::HashMismatch {
                entry_id: self.record.id.clone(),
                expected: computed,
                actual: self.hash,
            });
        }

        Ok(())
    }
}

/// Chain verification result
#[derive(Debug)]
pub struct ChainVerificationResult {
    /// Whether the chain is valid
    pub valid: bool,

    /// Number of entries checked
    pub entries_checked: usize,

    /// List of errors found
    pub errors: Vec<ChainError>,

    /// Statistics
    pub hash_mismatches: usize,
    pub chain_link_errors: usize,
    pub timestamp_errors: usize,
}

impl ChainVerificationResult {
    pub fn new() -> Self {
        Self {
            valid: true,
            entries_checked: 0,
            errors: Vec::new(),
            hash_mismatches: 0,
            chain_link_errors: 0,
            timestamp_errors: 0,
        }
    }
}

impl Default for ChainVerificationResult {
    fn default() -> Self {
        Self::new()
    }
}

/// Verify a chain of entries
pub fn verify_chain(entries: &[ChainEntry]) -> ChainVerificationResult {
    let mut result = ChainVerificationResult::new();
    result.entries_checked = entries.len();

    if entries.is_empty() {
        return result;
    }

    let mut prev_hash: Option<Hash> = None;

    for (idx, entry) in entries.iter().enumerate() {
        // 1. Verify hash matches computed hash
        if let Err(e) = entry.verify_hash() {
            result.valid = false;
            match &e {
                ChainError::HashMismatch { .. } => {
                    result.hash_mismatches += 1;
                }
                _ => {}
            }
            result.errors.push(e);
            continue; // Continue checking other entries
        }

        // 2. Verify chain link
        if let Some(ref prev) = prev_hash {
            if entry.prev_hash != Some(*prev) {
                result.valid = false;
                result.errors.push(ChainError::ChainLinkBroken {
                    entry_id: entry.record.id.clone(),
                });
                result.chain_link_errors += 1;
            }
        } else if entry.prev_hash.is_some() {
            // First entry should have no prev_hash (genesis)
            result.valid = false;
            result.errors.push(ChainError::ChainLinkBroken {
                entry_id: entry.record.id.clone(),
            });
            result.chain_link_errors += 1;
        }

        // 3. Verify timestamp ordering
        if idx > 0 {
            let prev_timestamp = entries[idx - 1].record.timestamp;
            if entry.record.timestamp < prev_timestamp {
                result.valid = false;
                result.errors.push(ChainError::TimestampOutOfOrder {
                    entry_id: entry.record.id.clone(),
                });
                result.timestamp_errors += 1;
            }
        }

        prev_hash = Some(entry.hash);
    }

    result
}

#[derive(Debug, thiserror::Error)]
pub enum ChainError {
    #[error("Hash mismatch at entry {entry_id}: expected {expected}, got {actual}")]
    HashMismatch {
        entry_id: String,
        expected: Hash,
        actual: Hash,
    },

    #[error("Chain link broken at entry {entry_id}")]
    ChainLinkBroken {
        entry_id: String,
    },

    #[error("Timestamp out of order at entry {entry_id}")]
    TimestampOutOfOrder {
        entry_id: String,
    },

    #[error("Core error: {0}")]
    Core(CoreError),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_entry_new() {
        let record = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let entry = ChainEntry::new(record.clone(), None).unwrap();

        assert_eq!(entry.record.id, "entry-1");
        assert!(entry.prev_hash.is_none());
    }

    #[test]
    fn test_chain_entry_genesis() {
        let record = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let entry = ChainEntry::genesis(record).unwrap();

        assert!(entry.prev_hash.is_none());
    }

    #[test]
    fn test_chain_entry_with_prev_hash() {
        let record = Record::new(
            "entry-2".to_string(),
            "proofs".to_string(),
            1234567891,
            serde_json::json!({"type": "proof"}),
        );

        let prev_hash = Hash::from_bytes([1u8; 32]);
        let entry = ChainEntry::new(record, Some(prev_hash)).unwrap();

        assert_eq!(entry.prev_hash, Some(Hash::from_bytes([1u8; 32])));
    }

    #[test]
    fn test_chain_entry_verify_hash() {
        let record = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let entry = ChainEntry::new(record, None).unwrap();

        // Should verify successfully
        assert!(entry.verify_hash().is_ok());
    }

    #[test]
    fn test_verify_chain_valid() {
        let mut entries = Vec::new();
        let mut prev_hash = None;

        for i in 0..5 {
            let record = Record::new(
                format!("entry-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({"index": i}),
            );

            let entry = ChainEntry::new(record, prev_hash).unwrap();
            prev_hash = Some(entry.hash);
            entries.push(entry);
        }

        let result = verify_chain(&entries);

        assert!(result.valid);
        assert_eq!(result.entries_checked, 5);
    }

    #[test]
    fn test_verify_chain_hash_mismatch() {
        let record = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let mut entry = ChainEntry::new(record, None).unwrap();
        // Corrupt the hash
        entry.hash = Hash::from_bytes([0xFFu8; 32]);

        let result = verify_chain(&[entry]);

        assert!(!result.valid);
        assert_eq!(result.hash_mismatches, 1);
    }

    #[test]
    fn test_verify_chain_link_broken() {
        let entry1 = ChainEntry::new(
            Record::new(
                "entry-1".to_string(),
                "proofs".to_string(),
                1000,
                serde_json::json!({"type": "proof"}),
            ),
            None,
        ).unwrap();

        let entry2 = ChainEntry::new(
            Record::new(
                "entry-2".to_string(),
                "proofs".to_string(),
                2000,
                serde_json::json!({"type": "proof"}),
            ),
            Some(Hash::from_bytes([0x99u8; 32])), // Wrong prev_hash
        ).unwrap();

        let result = verify_chain(&[entry1, entry2]);

        assert!(!result.valid);
        assert_eq!(result.chain_link_errors, 1);
    }

    #[test]
    fn test_verify_chain_timestamp_out_of_order() {
        let entry1 = ChainEntry::new(
            Record::new(
                "entry-1".to_string(),
                "proofs".to_string(),
                2000,
                serde_json::json!({"type": "proof"}),
            ),
            None,
        ).unwrap();

        let entry2 = ChainEntry::new(
            Record::new(
                "entry-2".to_string(),
                "proofs".to_string(),
                1000, // Earlier timestamp
                serde_json::json!({"type": "proof"}),
            ),
            Some(entry1.hash),
        ).unwrap();

        let result = verify_chain(&[entry1, entry2]);

        assert!(!result.valid);
        assert_eq!(result.timestamp_errors, 1);
    }
}

