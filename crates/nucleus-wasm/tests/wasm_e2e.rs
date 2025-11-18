//! E2E tests for nucleus-wasm
//!
//! These tests verify that the WASM bindings work correctly
//! and that the Rust engine can be used from JavaScript/TypeScript.

use wasm_bindgen_test::*;
use nucleus_wasm::{WasmLedger, WasmRecord};
use js_sys::Object;
use wasm_bindgen::JsValue;

wasm_bindgen_test_configure!(run_in_browser);

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

/// Helper to create a test context
fn create_test_context() -> JsValue {
    let context = serde_json::json!({
        "requester_oid": "oid:onoal:system:test",
        "metadata": null,
        "timestamp": 1234567890
    });
    serde_wasm_bindgen::to_value(&context).unwrap()
}

/// E2E Test: Create WasmLedger from config
#[wasm_bindgen_test]
fn test_wasm_ledger_creation() {
    let config = create_test_config();
    let ledger = WasmLedger::new(config).unwrap();

    assert_eq!(ledger.id(), "test-ledger");
    assert!(ledger.is_empty());
    assert_eq!(ledger.len(), 0);
}

/// E2E Test: Append record via WASM
#[wasm_bindgen_test]
fn test_wasm_append_record() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    let record = create_test_record("proof-1", "proofs", 1000);
    let hash = ledger.append_record(record, create_test_context()).unwrap();

    assert!(!hash.is_empty());
    assert_eq!(ledger.len(), 1);
    assert!(!ledger.is_empty());
}

/// E2E Test: Get record by hash via WASM
#[wasm_bindgen_test]
fn test_wasm_get_record_by_hash() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    let record = create_test_record("proof-1", "proofs", 1000);
    let hash = ledger.append_record(record, create_test_context()).unwrap();

    let retrieved = ledger.get_record(&hash).unwrap();
    
    // Verify it's a valid object
    assert!(retrieved.is_object());
    
    // Extract ID from the record
    let obj = Object::from(retrieved);
    let id = js_sys::Reflect::get(&obj, &JsValue::from_str("id")).unwrap();
    assert_eq!(id.as_string().unwrap(), "proof-1");
}

/// E2E Test: Get record by ID via WASM
#[wasm_bindgen_test]
fn test_wasm_get_record_by_id() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    let record = create_test_record("unique-id-123", "proofs", 1000);
    ledger.append_record(record, create_test_context()).unwrap();

    let retrieved = ledger.get_record_by_id("unique-id-123").unwrap();
    assert!(retrieved.is_object());

    let obj = Object::from(retrieved);
    let id = js_sys::Reflect::get(&obj, &JsValue::from_str("id")).unwrap();
    assert_eq!(id.as_string().unwrap(), "unique-id-123");
}

/// E2E Test: Query records via WASM
#[wasm_bindgen_test]
fn test_wasm_query() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add multiple records
    for i in 0..5 {
        let record = create_test_record(&format!("proof-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record, create_test_context()).unwrap();
    }

    // Query with filters
    let filters = serde_json::json!({
        "stream": "proofs",
        "limit": 3
    });
    let filters_js = serde_wasm_bindgen::to_value(&filters).unwrap();

    let result = ledger.query(filters_js).unwrap();
    assert!(result.is_object());

    let obj = Object::from(result);
    let total = js_sys::Reflect::get(&obj, &JsValue::from_str("total")).unwrap();
    assert_eq!(total.as_f64().unwrap(), 5.0);

    let records = js_sys::Reflect::get(&obj, &JsValue::from_str("records")).unwrap();
    let records_array = js_sys::Array::from(&records);
    assert_eq!(records_array.length(), 3);
}

/// E2E Test: Batch append via WASM
#[wasm_bindgen_test]
fn test_wasm_batch_append() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Create batch of records
    let mut records = Vec::new();
    for i in 0..5 {
        records.push(create_test_record(&format!("batch-{}", i), "proofs", 1000 + i as u64));
    }
    let records_array = js_sys::Array::new();
    for record in records {
        records_array.push(&record);
    }

    let hashes = ledger.append_batch(records_array.into(), create_test_context()).unwrap();
    assert!(hashes.is_object());

    let hashes_array = js_sys::Array::from(&hashes);
    assert_eq!(hashes_array.length(), 5);
    assert_eq!(ledger.len(), 5);
}

/// E2E Test: Chain verification via WASM
#[wasm_bindgen_test]
fn test_wasm_verify_chain() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add multiple records
    for i in 0..10 {
        let record = create_test_record(&format!("record-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record, create_test_context()).unwrap();
    }

    // Verify chain
    ledger.verify().unwrap();
}

/// E2E Test: Latest hash via WASM
#[wasm_bindgen_test]
fn test_wasm_latest_hash() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Initially no hash
    assert!(ledger.latest_hash().is_none());

    // Add record
    let record = create_test_record("proof-1", "proofs", 1000);
    let hash1 = ledger.append_record(record, create_test_context()).unwrap();

    // Latest hash should match
    let latest = ledger.latest_hash().unwrap();
    assert_eq!(latest, hash1);

    // Add another record
    let record2 = create_test_record("proof-2", "proofs", 1001);
    let hash2 = ledger.append_record(record2, create_test_context()).unwrap();

    // Latest hash should be updated
    let latest2 = ledger.latest_hash().unwrap();
    assert_eq!(latest2, hash2);
    assert_ne!(latest2, hash1);
}

/// E2E Test: WasmRecord creation
#[wasm_bindgen_test]
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

/// E2E Test: WasmRecord with metadata
#[wasm_bindgen_test]
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

/// E2E Test: Query with pagination via WASM
#[wasm_bindgen_test]
fn test_wasm_query_pagination() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add 20 records
    for i in 0..20 {
        let record = create_test_record(&format!("record-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record, create_test_context()).unwrap();
    }

    // Query with limit
    let filters = serde_json::json!({
        "stream": "proofs",
        "limit": 5,
        "offset": 0
    });
    let filters_js = serde_wasm_bindgen::to_value(&filters).unwrap();

    let result = ledger.query(filters_js).unwrap();
    let obj = Object::from(result);
    let total = js_sys::Reflect::get(&obj, &JsValue::from_str("total")).unwrap();
    assert_eq!(total.as_f64().unwrap(), 20.0);

    let records = js_sys::Reflect::get(&obj, &JsValue::from_str("records")).unwrap();
    let records_array = js_sys::Array::from(&records);
    assert_eq!(records_array.length(), 5);

    // Query with offset
    let filters2 = serde_json::json!({
        "stream": "proofs",
        "limit": 5,
        "offset": 10
    });
    let filters2_js = serde_wasm_bindgen::to_value(&filters2).unwrap();

    let result2 = ledger.query(filters2_js).unwrap();
    let obj2 = Object::from(result2);
    let records2 = js_sys::Reflect::get(&obj2, &JsValue::from_str("records")).unwrap();
    let records2_array = js_sys::Array::from(&records2);
    assert_eq!(records2_array.length(), 5);
}

/// E2E Test: Mixed streams via WASM
#[wasm_bindgen_test]
fn test_wasm_mixed_streams() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add proof records
    for i in 0..5 {
        let record = create_test_record(&format!("proof-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record, create_test_context()).unwrap();
    }

    // Add asset records
    for i in 0..3 {
        let record = create_test_record(&format!("asset-{}", i), "assets", 2000 + i as u64);
        ledger.append_record(record, create_test_context()).unwrap();
    }

    assert_eq!(ledger.len(), 8);

    // Query proofs
    let filters = serde_json::json!({
        "stream": "proofs"
    });
    let filters_js = serde_wasm_bindgen::to_value(&filters).unwrap();

    let result = ledger.query(filters_js).unwrap();
    let obj = Object::from(result);
    let total = js_sys::Reflect::get(&obj, &JsValue::from_str("total")).unwrap();
    assert_eq!(total.as_f64().unwrap(), 5.0);
}

/// E2E Test: Error handling via WASM
#[wasm_bindgen_test]
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

    let result = ledger.append_record(invalid_js, create_test_context());
    assert!(result.is_err());
}

/// E2E Test: Large chain via WASM
#[wasm_bindgen_test]
fn test_wasm_large_chain() {
    let config = create_test_config();
    let mut ledger = WasmLedger::new(config).unwrap();

    // Add 100 records
    for i in 0..100 {
        let record = create_test_record(&format!("record-{}", i), "proofs", 1000 + i as u64);
        ledger.append_record(record, create_test_context()).unwrap();
    }

    assert_eq!(ledger.len(), 100);

    // Verify chain
    ledger.verify().unwrap();

    // Get latest hash
    let latest = ledger.latest_hash().unwrap();
    assert!(!latest.is_empty());
}

