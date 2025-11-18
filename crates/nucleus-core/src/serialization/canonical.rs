use crate::{Record, Hash, CoreError};
use serde_json::{Value, Map};
use sha2::{Sha256, Digest};

/// Serialize record to canonical JSON form
///
/// Canonical form ensures:
/// - Keys sorted alphabetically
/// - No whitespace
/// - Consistent field ordering
pub fn serialize_canonical(record: &Record) -> Result<Vec<u8>, serde_json::Error> {
    let mut canonical = Map::new();

    // Add fields in canonical order (alphabetically)
    canonical.insert("id".to_string(), Value::String(record.id.clone()));
    canonical.insert("stream".to_string(), Value::String(record.stream.clone()));
    canonical.insert("timestamp".to_string(), Value::Number(record.timestamp.into()));
    canonical.insert("payload".to_string(), record.payload.clone());

    // Only include meta if present
    if let Some(ref meta) = record.meta {
        canonical.insert("meta".to_string(), meta.clone());
    }

    // Serialize with no whitespace (compact)
    serde_json::to_vec(&canonical)
}

/// Compute hash for a record using canonical serialization
pub fn compute_hash(record: &Record) -> Result<Hash, CoreError> {
    let canonical = serialize_canonical(record)?;
    let mut hasher = Sha256::new();
    hasher.update(&canonical);
    let hash_bytes = hasher.finalize();

    let mut hash_array = [0u8; 32];
    hash_array.copy_from_slice(&hash_bytes);

    Ok(Hash::from_bytes(hash_array))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_canonical_deterministic() {
        let record = Record::new(
            "test-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof", "subject_oid": "oid:onoal:human:alice"}),
        );

        let serialized1 = serialize_canonical(&record).unwrap();
        let serialized2 = serialize_canonical(&record).unwrap();

        // Should be identical
        assert_eq!(serialized1, serialized2);
    }

    #[test]
    fn test_compute_hash_deterministic() {
        let record = Record::new(
            "test-2".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let hash1 = compute_hash(&record).unwrap();
        let hash2 = compute_hash(&record).unwrap();

        // Should be identical
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_compute_hash_different_for_different_records() {
        let record1 = Record::new(
            "test-3".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let record2 = Record::new(
            "test-4".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let hash1 = compute_hash(&record1).unwrap();
        let hash2 = compute_hash(&record2).unwrap();

        // Different IDs should produce different hashes
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_compute_hash_includes_meta() {
        let record = Record::with_meta(
            "test-5".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
            serde_json::json!({"source": "api"}),
        );

        let hash_with_meta = compute_hash(&record).unwrap();

        let record_no_meta = Record::new(
            "test-5".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let hash_no_meta = compute_hash(&record_no_meta).unwrap();

        // Meta should affect hash
        assert_ne!(hash_with_meta, hash_no_meta);
    }
}

