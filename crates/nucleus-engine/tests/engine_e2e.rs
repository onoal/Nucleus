use nucleus_engine::{LedgerEngine, LedgerConfig, QueryFilters};
use nucleus_core::module::ModuleConfig;
use nucleus_core::{Record, RequestContext};

fn create_test_config() -> LedgerConfig {
    LedgerConfig::with_modules(
        "test-ledger".to_string(),
        vec![
            ModuleConfig::new(
                "proof".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
            ModuleConfig::new(
                "asset".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
        ],
    )
}

fn create_test_context() -> RequestContext {
    RequestContext::new("oid:onoal:system:test".to_string())
}

/// E2E Test: Complete engine lifecycle
#[test]
fn test_engine_complete_lifecycle() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // 1. Start with empty ledger
    assert!(engine.is_empty());
    assert_eq!(engine.len(), 0);
    assert_eq!(engine.module_ids().len(), 2);

    // 2. Append records
    let mut hashes = Vec::new();
    for i in 0..10 {
        let record = Record::new(
            format!("record-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        let hash = engine.append_record(record, &create_test_context()).unwrap();
        hashes.push(hash);
    }

    // 3. Verify state
    assert_eq!(engine.len(), 10);
    assert!(!engine.is_empty());

    // 4. Retrieve records
    for (i, hash) in hashes.iter().enumerate() {
        let record = engine.get_record(hash).unwrap();
        assert_eq!(record.id, format!("record-{}", i));
    }

    // 5. Verify chain integrity
    engine.verify().unwrap();
}

/// E2E Test: Query operations
#[test]
fn test_engine_query_operations() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add records to different streams
    for i in 0..10 {
        let stream = if i < 5 { "proofs" } else { "assets" };
        let record = Record::new(
            format!("{}-{}", stream, i),
            stream.to_string(),
            1000 + i as u64,
            if stream == "proofs" {
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                })
            } else {
                serde_json::json!({
                    "type": "asset",
                    "owner_oid": "oid:onoal:human:bob",
                })
            },
        );
        engine.append_record(record, &create_test_context()).unwrap();
    }

    // Query proofs
    let filters = QueryFilters::new().with_stream("proofs".to_string());
    let result = engine.query(filters);
    assert_eq!(result.total, 5);
    assert_eq!(result.records.len(), 5);
    assert!(!result.has_more);

    // Query assets
    let filters = QueryFilters::new().with_stream("assets".to_string());
    let result = engine.query(filters);
    assert_eq!(result.total, 5);
    assert_eq!(result.records.len(), 5);
}

/// E2E Test: Query with pagination
#[test]
fn test_engine_query_pagination() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add 20 records
    for i in 0..20 {
        let record = Record::new(
            format!("record-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record, &create_test_context()).unwrap();
    }

    // Query with limit
    let filters = QueryFilters::new()
        .with_stream("proofs".to_string())
        .with_limit(5);
    let result = engine.query(filters);
    assert_eq!(result.total, 20);
    assert_eq!(result.records.len(), 5);
    assert!(result.has_more);

    // Query with offset
    let filters = QueryFilters::new()
        .with_stream("proofs".to_string())
        .with_offset(10)
        .with_limit(5);
    let result = engine.query(filters);
    assert_eq!(result.total, 20);
    assert_eq!(result.records.len(), 5);
    assert!(result.has_more);
    assert_eq!(result.records[0].id, "record-10");
}

/// E2E Test: Batch append atomicity
#[test]
fn test_engine_batch_atomicity() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Create valid batch
    let records: Vec<Record> = (0..5)
        .map(|i| {
            Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            )
        })
        .collect();

    let hashes = engine.append_batch(records, &create_test_context()).unwrap();
    assert_eq!(hashes.len(), 5);
    assert_eq!(engine.len(), 5);

    // Verify all records are linked correctly
    engine.verify().unwrap();

    // Verify chain linking
    // Chain integrity is verified by verify() call above
    // All records are correctly linked as part of the batch operation
}

/// E2E Test: Batch append failure (invalid record)
#[test]
fn test_engine_batch_failure() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    let records = vec![
        Record::new(
            "record-1".to_string(),
            "proofs".to_string(),
            1000,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        ),
        Record::new(
            "".to_string(), // Invalid - empty ID
            "proofs".to_string(),
            1001,
            serde_json::json!({
                "type": "proof",
            }),
        ),
    ];

    // Batch should fail
    assert!(engine.append_batch(records, &create_test_context()).is_err());

    // No records should be added
    assert_eq!(engine.len(), 0);
}

/// E2E Test: Module validation
#[test]
fn test_engine_module_validation() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Valid proof record
    let valid_record = Record::new(
        "proof-1".to_string(),
        "proofs".to_string(),
        1000,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );
    assert!(engine.append_record(valid_record, &create_test_context()).is_ok());

    // Invalid proof record (missing required fields)
    let invalid_record = Record::new(
        "proof-2".to_string(),
        "proofs".to_string(),
        1001,
        serde_json::json!({
            "type": "proof",
            // Missing subject_oid and issuer_oid
        }),
    );
    assert!(engine.append_record(invalid_record, &create_test_context()).is_err());
}

/// E2E Test: Query with timestamp range
#[test]
fn test_engine_query_timestamp_range() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add records with different timestamps
    for i in 0..10 {
        let record = Record::new(
            format!("record-{}", i),
            "proofs".to_string(),
            1000 + i as u64 * 100,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record, &create_test_context()).unwrap();
    }

    // Query with timestamp range
    let filters = QueryFilters::new()
        .with_stream("proofs".to_string())
        .with_timestamp_range(Some(1200), Some(1500));
    let result = engine.query(filters);

    assert!(result.total > 0);
    assert!(result.total < 10);
    
    // All results should be in range
    for record in &result.records {
        assert!(record.timestamp >= 1200);
        assert!(record.timestamp <= 1500);
    }
}

/// E2E Test: Large chain verification
#[test]
fn test_engine_large_chain() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add 1000 records
    for i in 0..1000 {
        let record = Record::new(
            format!("record-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
                "index": i,
            }),
        );
        engine.append_record(record, &create_test_context()).unwrap();
    }

    assert_eq!(engine.len(), 1000);

    // Verify chain
    engine.verify().unwrap();

    // Get latest hash
    let latest_hash = engine.latest_hash().unwrap();
    assert!(!latest_hash.to_hex().is_empty());
}

/// E2E Test: Get record by ID
#[test]
fn test_engine_get_by_id() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    let record = Record::new(
        "unique-id-123".to_string(),
        "proofs".to_string(),
        1000,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );
    engine.append_record(record, &create_test_context()).unwrap();

    // Get by ID
    let retrieved = engine.get_record_by_id("unique-id-123");
    assert!(retrieved.is_some());
    assert_eq!(retrieved.unwrap().id, "unique-id-123");

    // Non-existent ID
    let not_found = engine.get_record_by_id("non-existent");
    assert!(not_found.is_none());
}

/// E2E Test: Mixed streams and modules
#[test]
fn test_engine_mixed_streams() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add proof records
    for i in 0..5 {
        let record = Record::new(
            format!("proof-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record, &create_test_context()).unwrap();
    }

    // Add asset records
    for i in 0..3 {
        let record = Record::new(
            format!("asset-{}", i),
            "assets".to_string(),
            2000 + i as u64,
            serde_json::json!({
                "type": "asset",
                "owner_oid": "oid:onoal:human:bob",
            }),
        );
        engine.append_record(record, &create_test_context()).unwrap();
    }

    assert_eq!(engine.len(), 8);

    // Query each stream
    let proof_result = engine.query(QueryFilters::new().with_stream("proofs".to_string()));
    assert_eq!(proof_result.total, 5);

    let asset_result = engine.query(QueryFilters::new().with_stream("assets".to_string()));
    assert_eq!(asset_result.total, 3);

    // Verify chain
    engine.verify().unwrap();
}

