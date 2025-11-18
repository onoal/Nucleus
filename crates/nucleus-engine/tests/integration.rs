use nucleus_engine::{LedgerEngine, LedgerConfig, QueryFilters};
use nucleus_core::module::ModuleConfig;
use nucleus_core::Record;

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

#[test]
fn test_engine_lifecycle() {
    // Create engine
    let config = create_test_config();
    let engine = LedgerEngine::new(config).unwrap();

    assert_eq!(engine.id(), "test-ledger");
    assert!(engine.is_empty());
    assert_eq!(engine.module_ids().len(), 2);
}

#[test]
fn test_engine_append_and_verify() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Append records
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
        engine.append_record(record).unwrap();
    }

    // Verify chain
    assert!(engine.verify().is_ok());
    assert_eq!(engine.len(), 10);
}

#[test]
fn test_engine_query_integration() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add records to different streams
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
        engine.append_record(record).unwrap();
    }

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
        engine.append_record(record).unwrap();
    }

    // Query proofs
    let filters = QueryFilters::new().with_stream("proofs".to_string());
    let result = engine.query(filters);

    assert_eq!(result.total, 5);
    assert_eq!(result.records.len(), 5);

    // Query assets
    let filters = QueryFilters::new().with_stream("assets".to_string());
    let result = engine.query(filters);

    assert_eq!(result.total, 3);
    assert_eq!(result.records.len(), 3);
}

#[test]
fn test_engine_batch_append_integration() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    let records = (0..5)
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

    let hashes = engine.append_batch(records).unwrap();

    assert_eq!(hashes.len(), 5);
    assert_eq!(engine.len(), 5);

    // Verify chain
    assert!(engine.verify().is_ok());
}

