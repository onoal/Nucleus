use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};
use nucleus_core::serialization::compute_hash;

/// E2E Test: Complete workflow from record creation to chain verification
#[test]
fn test_complete_workflow() {
    // Create records
    let record1 = Record::new(
        "proof-1".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );

    let record2 = Record::new(
        "proof-2".to_string(),
        "proofs".to_string(),
        1234567891,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:bob",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );

    // Compute hashes
    let hash1 = compute_hash(&record1).unwrap();
    let hash2 = compute_hash(&record2).unwrap();

    assert_ne!(hash1, hash2);

    // Create chain
    let entry1 = ChainEntry::genesis(record1).unwrap();
    let entry2 = ChainEntry::new(record2, Some(entry1.hash)).unwrap();

    // Verify chain
    let result = verify_chain(&[entry1, entry2]);
    assert!(result.valid);
    assert_eq!(result.entries_checked, 2);
    assert_eq!(result.errors.len(), 0);
}

/// E2E Test: Chain with many entries
#[test]
fn test_chain_with_many_entries() {
    let mut entries = Vec::new();
    let mut prev_hash: Option<Hash> = None;

    for i in 0..1000 {
        let record = Record::new(
            format!("proof-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
                "index": i,
            }),
        );
        let entry = ChainEntry::new(record, prev_hash).unwrap();
        prev_hash = Some(entry.hash);
        entries.push(entry);
    }

    let result = verify_chain(&entries);
    assert!(result.valid);
    assert_eq!(result.entries_checked, 1000);
    assert_eq!(result.errors.len(), 0);
}

/// E2E Test: Chain detects corruption
#[test]
fn test_chain_detects_corruption() {
    let record1 = Record::new(
        "proof-1".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );
    let mut entry1 = ChainEntry::genesis(record1).unwrap();

    // Corrupt the hash
    entry1.hash = Hash::from_bytes([0xFFu8; 32]);

    let result = verify_chain(&[entry1]);
    assert!(!result.valid);
    assert_eq!(result.hash_mismatches, 1);
    assert!(!result.errors.is_empty());
}

/// E2E Test: Chain detects broken link
#[test]
fn test_chain_detects_broken_link() {
    let entry1 = ChainEntry::genesis(
        Record::new(
            "proof-1".to_string(),
            "proofs".to_string(),
            1000,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        )
    ).unwrap();

    let entry2 = ChainEntry::new(
        Record::new(
            "proof-2".to_string(),
            "proofs".to_string(),
            2000,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:bob",
                "issuer_oid": "oid:onoal:org:example",
            }),
        ),
        Some(Hash::from_bytes([0x99u8; 32])), // Wrong prev_hash
    ).unwrap();

    let result = verify_chain(&[entry1, entry2]);
    assert!(!result.valid);
    assert_eq!(result.chain_link_errors, 1);
}

/// E2E Test: Canonical serialization determinism
#[test]
fn test_canonical_serialization_determinism() {
    let record = Record::new(
        "test-record".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );

    // Compute hash multiple times - should be identical
    let hash1 = compute_hash(&record).unwrap();
    let hash2 = compute_hash(&record).unwrap();
    let hash3 = compute_hash(&record).unwrap();

    assert_eq!(hash1, hash2);
    assert_eq!(hash2, hash3);
}

/// E2E Test: Hash chain integrity across multiple operations
#[test]
fn test_hash_chain_integrity() {
    let mut entries = Vec::new();
    let mut prev_hash: Option<Hash> = None;

    // Create a chain of 100 entries
    for i in 0..100 {
        let record = Record::new(
            format!("entry-{}", i),
            "proofs".to_string(),
            1000 + i as u64 * 10,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
                "sequence": i,
            }),
        );

        let entry = ChainEntry::new(record, prev_hash).unwrap();
        
        // Verify each entry's hash is correct
        assert!(entry.verify_hash().is_ok());
        
        // Verify prev_hash link
        if let Some(ref prev) = prev_hash {
            assert_eq!(entry.prev_hash, Some(*prev));
        } else {
            assert_eq!(entry.prev_hash, None);
        }

        prev_hash = Some(entry.hash);
        entries.push(entry);
    }

    // Verify entire chain
    let result = verify_chain(&entries);
    assert!(result.valid);
    assert_eq!(result.entries_checked, 100);
}

/// E2E Test: Different record types in same chain
#[test]
fn test_mixed_record_types() {
    let mut entries = Vec::new();
    let mut prev_hash: Option<Hash> = None;

    // Add proof record
    let proof_record = Record::new(
        "proof-1".to_string(),
        "proofs".to_string(),
        1000,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );
    let entry = ChainEntry::new(proof_record, prev_hash).unwrap();
    prev_hash = Some(entry.hash);
    entries.push(entry);

    // Add asset record
    let asset_record = Record::new(
        "asset-1".to_string(),
        "assets".to_string(),
        2000,
        serde_json::json!({
            "type": "asset",
            "owner_oid": "oid:onoal:human:alice",
        }),
    );
    let entry = ChainEntry::new(asset_record, prev_hash).unwrap();
    prev_hash = Some(entry.hash);
    entries.push(entry);

    // Verify chain
    let result = verify_chain(&entries);
    assert!(result.valid);
    assert_eq!(result.entries_checked, 2);
}

/// E2E Test: Record with metadata
#[test]
fn test_record_with_metadata() {
    let record = Record::with_meta(
        "record-1".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
        }),
        serde_json::json!({
            "source": "api",
            "version": "1.0",
        }),
    );

    assert!(record.validate().is_ok());
    assert!(record.meta.is_some());

    let hash = compute_hash(&record).unwrap();
    
    // Hash should be different from record without meta
    let record_no_meta = Record::new(
        "record-1".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
        }),
    );
    let hash_no_meta = compute_hash(&record_no_meta).unwrap();
    
    assert_ne!(hash, hash_no_meta);
}

