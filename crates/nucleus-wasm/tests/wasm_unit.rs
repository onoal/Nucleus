//! Unit tests for nucleus-wasm
//!
//! These tests verify WASM bindings compile and work correctly
//! without requiring a browser environment.

use nucleus_wasm::{WasmLedger, WasmRecord};
use wasm_bindgen::JsValue;

/// Helper to create a test ledger config
fn create_test_config() -> JsValue {
    let config = serde_json::json!({
        "id": "test-ledger",
        "modules": [
            {
                "id": "proof",
                "version": "1.0.0",
                "config": {}
            },
            {
                "id": "asset",
                "version": "1.0.0",
                "config": {}
            }
        ]
    });
    serde_wasm_bindgen::to_value(&config).unwrap()
}

/// Helper to create a test record
fn create_test_record(id: &str, stream: &str, timestamp: u64) -> JsValue {
    let record = serde_json::json!({
        "id": id,
        "stream": stream,
        "timestamp": timestamp,
        "payload": {
            "type": if stream == "proofs" { "proof" } else { "asset" },
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example"
        }
    });
    serde_wasm_bindgen::to_value(&record).unwrap()
}

/// Test: Create WasmLedger from config
#[test]
fn test_wasm_ledger_creation() {
    let config = create_test_config();
    let ledger = WasmLedger::new(config).unwrap();

    assert_eq!(ledger.id(), "test-ledger");
    assert!(ledger.is_empty());
    assert_eq!(ledger.len(), 0);
}

/// Test: Append record via WASM
#[test]
fn test_wasm_append_record() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    let record = create_test_record("proof-1", "proofs", 1000);
    let hash = ledger.append_record(record).unwrap();

    assert!(!hash.is_empty());
    assert_eq!(ledger.len(), 1);
    assert!(!ledger.is_empty());
}

/// Test: Get record by hash via WASM
#[test]
fn test_wasm_get_record_by_hash() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    let record = create_test_record("proof-1", "proofs", 1000);
    let hash = ledger.append_record(record).unwrap();

    let retrieved = ledger.get_record(&hash).unwrap();
    assert!(retrieved.is_object());
}

/// Test: Get record by ID via WASM
#[test]
fn test_wasm_get_record_by_id() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    let record = create_test_record("unique-id-123", "proofs", 1000);
    ledger.append_record(record).unwrap();

    let retrieved = ledger.get_record_by_id("unique-id-123").unwrap();
    assert!(retrieved.is_object());
}

/// Test: Query records via WASM
#[test]
fn test_wasm_query() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add multiple records
    for i in 0..5 {
        let record = create_test_record(&format!("proof-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record).unwrap();
    }

    // Query with filters
    let filters = serde_json::json!({
        "stream": "proofs",
        "limit": 3
    });
    let filters_js = serde_wasm_bindgen::to_value(&filters).unwrap();

    let result = ledger.query(filters_js).unwrap();
    assert!(result.is_object());
}

/// Test: Batch append via WASM
#[test]
fn test_wasm_batch_append() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Create batch of records as JSON array
    let mut records_json = Vec::new();
    for i in 0..5 {
        let record_json = serde_json::json!({
            "id": format!("batch-{}", i),
            "stream": "proofs",
            "timestamp": 1000 + i as u64,
            "payload": {
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example"
            }
        });
        records_json.push(record_json);
    }
    let records_js = serde_wasm_bindgen::to_value(&records_json).unwrap();

    let hashes = ledger.append_batch(records_js).unwrap();
    assert!(hashes.is_object());
    assert_eq!(ledger.len(), 5);
}

/// Test: Chain verification via WASM
#[test]
fn test_wasm_verify_chain() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add multiple records
    for i in 0..10 {
        let record = create_test_record(&format!("record-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record).unwrap();
    }

    // Verify chain
    ledger.verify().unwrap();
}

/// Test: Latest hash via WASM
#[test]
fn test_wasm_latest_hash() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Initially no hash
    assert!(ledger.latest_hash().is_none());

    // Add record
    let record = create_test_record("proof-1", "proofs", 1000);
    let hash1 = ledger.append_record(record).unwrap();

    // Latest hash should match
    let latest = ledger.latest_hash().unwrap();
    assert_eq!(latest, hash1);

    // Add another record
    let record2 = create_test_record("proof-2", "proofs", 1001);
    let hash2 = ledger.append_record(record2).unwrap();

    // Latest hash should be updated
    let latest2 = ledger.latest_hash().unwrap();
    assert_eq!(latest2, hash2);
    assert_ne!(latest2, hash1);
}

/// Test: WasmRecord creation
#[test]
fn test_wasm_record_creation() {
    let payload = serde_json::json!({
        "type": "proof",
        "subject_oid": "oid:onoal:human:alice"
    });
    let payload_js = serde_wasm_bindgen::to_value(&payload).unwrap();

    let record = WasmRecord::new(
        "test-1".to_string(),
        "proofs".to_string(),
        1000,
        payload_js,
    ).unwrap();

    // Validate record
    record.validate().unwrap();

    // Convert to JSON
    let json = record.to_json().unwrap();
    assert!(json.is_object());
}

/// Test: WasmRecord with metadata
#[test]
fn test_wasm_record_with_meta() {
    let payload = serde_json::json!({
        "type": "proof",
        "subject_oid": "oid:onoal:human:alice"
    });
    let payload_js = serde_wasm_bindgen::to_value(&payload).unwrap();

    let meta = serde_json::json!({
        "source": "api",
        "version": "1.0"
    });
    let meta_js = serde_wasm_bindgen::to_value(&meta).unwrap();

    let record = WasmRecord::with_meta(
        "test-2".to_string(),
        "proofs".to_string(),
        1000,
        payload_js,
        meta_js,
    ).unwrap();

    record.validate().unwrap();
}

/// Test: Error handling via WASM
#[test]
fn test_wasm_error_handling() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Try to append invalid record (empty ID)
    let invalid_record = serde_json::json!({
        "id": "",
        "stream": "proofs",
        "timestamp": 1000,
        "payload": {}
    });
    let invalid_js = serde_wasm_bindgen::to_value(&invalid_record).unwrap();

    let result = ledger.append_record(invalid_js);
    assert!(result.is_err());
}

/// Test: Large chain via WASM
#[test]
fn test_wasm_large_chain() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add 100 records
    for i in 0..100 {
        let record = create_test_record(&format!("record-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record).unwrap();
    }

    assert_eq!(ledger.len(), 100);

    // Verify chain
    ledger.verify().unwrap();

    // Get latest hash
    let latest = ledger.latest_hash().unwrap();
    assert!(!latest.is_empty());
}

/// Test: Mixed streams via WASM
#[test]
fn test_wasm_mixed_streams() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add proof records
    for i in 0..5 {
        let record = create_test_record(&format!("proof-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record).unwrap();
    }

    // Add asset records
    for i in 0..3 {
        let record = create_test_record(&format!("asset-{}", i), "assets", 2000 + i as u64);
        ledger.append_record(record).unwrap();
    }

    assert_eq!(ledger.len(), 8);

    // Query proofs
    let filters = serde_json::json!({
        "stream": "proofs"
    });
    let filters_js = serde_wasm_bindgen::to_value(&filters).unwrap();

    let result = ledger.query(filters_js).unwrap();
    assert!(result.is_object());
}

