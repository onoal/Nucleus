//! Integration tests for storage persistence
//!
//! These tests verify the critical "save → restart → load" flow.

use nucleus_engine::{LedgerConfig, LedgerEngine};
use nucleus_core::{Record, RequestContext};
use serde_json::json;
use std::fs;
use std::path::Path;

/// Helper to create test record
fn create_test_record(id: &str, stream: &str, timestamp: u64) -> Record {
    Record {
        id: id.to_string(),
        stream: stream.to_string(),
        timestamp,
        payload: json!({
            "type": "test",
            "data": format!("Test data for {}", id)
        }),
        meta: None,
    }
}

/// Helper to create test context
fn create_test_context() -> RequestContext {
    RequestContext::new("oid:onoal:system:test".to_string())
}

/// Helper to clean up test database
fn cleanup_test_db(path: &str) {
    let _ = fs::remove_file(path);
    let wal_path = format!("{}-wal", path);
    let shm_path = format!("{}-shm", path);
    let _ = fs::remove_file(wal_path);
    let _ = fs::remove_file(shm_path);
}

#[test]
fn test_storage_save_and_reload() {
    let db_path = "./test_data/test_save_reload.db";
    cleanup_test_db(db_path);

    // Create parent directory
    if let Some(parent) = Path::new(db_path).parent() {
        fs::create_dir_all(parent).unwrap();
    }

    // Phase 1: Create ledger, add entries, verify
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let mut engine = LedgerEngine::new(config).expect("Failed to create engine");

        // Verify storage is enabled
        assert!(engine.has_storage());

        // Add some records
        let record1 = create_test_record("rec-1", "proofs", 1000);
        let hash1 = engine.append_record(record1, &create_test_context()).expect("Failed to append record 1");

        let record2 = create_test_record("rec-2", "proofs", 1001);
        let hash2 = engine.append_record(record2, &create_test_context()).expect("Failed to append record 2");

        let record3 = create_test_record("rec-3", "assets", 1002);
        let hash3 = engine.append_record(record3, &create_test_context()).expect("Failed to append record 3");

        // Verify in-memory state
        assert_eq!(engine.len(), 3);
        assert!(engine.get_record(&hash1).is_some());
        assert!(engine.get_record(&hash2).is_some());
        assert!(engine.get_record(&hash3).is_some());

        // Verify chain integrity
        engine.verify().expect("Chain verification failed");

        // Verify storage integrity
        assert!(engine.verify_storage().expect("Storage verification failed"));
    }

    // Phase 2: Restart - Create new engine instance, verify data persisted
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let engine = LedgerEngine::new(config).expect("Failed to reload engine");

        // Verify storage is enabled
        assert!(engine.has_storage());

        // Verify all records loaded
        assert_eq!(engine.len(), 3);

        // Verify records by ID
        let rec1 = engine.get_record_by_id("rec-1").expect("Record 1 not found");
        assert_eq!(rec1.id, "rec-1");
        assert_eq!(rec1.stream, "proofs");
        assert_eq!(rec1.timestamp, 1000);

        let rec2 = engine.get_record_by_id("rec-2").expect("Record 2 not found");
        assert_eq!(rec2.id, "rec-2");

        let rec3 = engine.get_record_by_id("rec-3").expect("Record 3 not found");
        assert_eq!(rec3.id, "rec-3");
        assert_eq!(rec3.stream, "assets");

        // Verify chain integrity after reload
        engine.verify().expect("Chain verification failed after reload");

        // Verify storage integrity
        assert!(engine.verify_storage().expect("Storage verification failed after reload"));
    }

    // Cleanup
    cleanup_test_db(db_path);
}

#[test]
fn test_storage_append_after_reload() {
    let db_path = "./test_data/test_append_after_reload.db";
    cleanup_test_db(db_path);

    // Create parent directory
    if let Some(parent) = Path::new(db_path).parent() {
        fs::create_dir_all(parent).unwrap();
    }

    let first_hash;

    // Phase 1: Create ledger, add initial record
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let mut engine = LedgerEngine::new(config).expect("Failed to create engine");

        let record1 = create_test_record("rec-1", "proofs", 1000);
        first_hash = engine.append_record(record1, &create_test_context()).expect("Failed to append record 1");

        assert_eq!(engine.len(), 1);
    }

    // Phase 2: Reload and append more records
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let mut engine = LedgerEngine::new(config).expect("Failed to reload engine");

        // Verify first record loaded
        assert_eq!(engine.len(), 1);
        assert!(engine.get_record(&first_hash).is_some());

        // Append more records (should link to existing chain)
        let record2 = create_test_record("rec-2", "proofs", 1001);
        let hash2 = engine.append_record(record2, &create_test_context()).expect("Failed to append record 2");

        let record3 = create_test_record("rec-3", "proofs", 1002);
        let _hash3 = engine.append_record(record3, &create_test_context()).expect("Failed to append record 3");

        // Verify total count
        assert_eq!(engine.len(), 3);

        // Verify chain integrity (links should be preserved)
        engine.verify().expect("Chain verification failed after append");

        // Verify second record exists
        assert!(engine.get_record(&hash2).is_some());
    }

    // Phase 3: Final reload to verify all 3 records persisted
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let engine = LedgerEngine::new(config).expect("Failed to reload engine");

        assert_eq!(engine.len(), 3);

        // Verify all records by ID
        assert!(engine.get_record_by_id("rec-1").is_some());
        assert!(engine.get_record_by_id("rec-2").is_some());
        assert!(engine.get_record_by_id("rec-3").is_some());

        // Final chain verification
        engine.verify().expect("Final chain verification failed");
    }

    // Cleanup
    cleanup_test_db(db_path);
}

#[test]
fn test_storage_batch_append_and_reload() {
    let db_path = "./test_data/test_batch_reload.db";
    cleanup_test_db(db_path);

    // Create parent directory
    if let Some(parent) = Path::new(db_path).parent() {
        fs::create_dir_all(parent).unwrap();
    }

    // Phase 1: Batch append
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let mut engine = LedgerEngine::new(config).expect("Failed to create engine");

        let records = vec![
            create_test_record("batch-1", "proofs", 2000),
            create_test_record("batch-2", "proofs", 2001),
            create_test_record("batch-3", "assets", 2002),
            create_test_record("batch-4", "assets", 2003),
            create_test_record("batch-5", "proofs", 2004),
        ];

        let hashes = engine.append_batch(records, &create_test_context()).expect("Batch append failed");
        assert_eq!(hashes.len(), 5);
        assert_eq!(engine.len(), 5);

        // Verify chain
        engine.verify().expect("Chain verification failed");
    }

    // Phase 2: Reload and verify all batch entries
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let engine = LedgerEngine::new(config).expect("Failed to reload engine");

        assert_eq!(engine.len(), 5);

        // Verify all records exist
        for i in 1..=5 {
            let id = format!("batch-{}", i);
            assert!(
                engine.get_record_by_id(&id).is_some(),
                "Record {} not found after reload",
                id
            );
        }

        // Verify chain integrity
        engine.verify().expect("Chain verification failed after batch reload");
    }

    // Cleanup
    cleanup_test_db(db_path);
}

#[test]
fn test_in_memory_no_storage() {
    // Create in-memory engine (no storage)
    let config = LedgerConfig::new("test-ledger".to_string());
    let mut engine = LedgerEngine::new(config).expect("Failed to create engine");

    // Verify storage is NOT enabled
    assert!(!engine.has_storage());

    // Add records
    let record1 = create_test_record("mem-1", "proofs", 3000);
    let _hash1 = engine.append_record(record1, &create_test_context()).expect("Failed to append record");

    assert_eq!(engine.len(), 1);

    // Verify storage methods work but return false
    assert!(!engine.verify_storage().expect("Storage verify should return false"));
}

#[test]
fn test_empty_storage_reload() {
    let db_path = "./test_data/test_empty_reload.db";
    cleanup_test_db(db_path);

    // Create parent directory
    if let Some(parent) = Path::new(db_path).parent() {
        fs::create_dir_all(parent).unwrap();
    }

    // Phase 1: Create empty ledger
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let engine = LedgerEngine::new(config).expect("Failed to create engine");

        assert!(engine.has_storage());
        assert_eq!(engine.len(), 0);
        assert!(engine.is_empty());
    }

    // Phase 2: Reload empty ledger (should not fail)
    {
        let config = LedgerConfig::with_sqlite_storage("test-ledger".to_string(), db_path);
        let engine = LedgerEngine::new(config).expect("Failed to reload empty engine");

        assert!(engine.has_storage());
        assert_eq!(engine.len(), 0);
        assert!(engine.is_empty());
    }

    // Cleanup
    cleanup_test_db(db_path);
}

