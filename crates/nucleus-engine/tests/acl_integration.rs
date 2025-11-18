//! ACL (Access Control List) Integration Tests
//!
//! Tests the full ACL flow:
//! 1. Grant access
//! 2. Check access (allow/deny)
//! 3. Revoke access
//! 4. List grants

use nucleus_core::RequestContext;
use nucleus_engine::{LedgerConfig, LedgerEngine, Grant, CheckParams, RevokeParams, AclConfig};
use nucleus_core::Record;

fn create_test_engine(acl_enabled: bool) -> LedgerEngine {
    let mut config = LedgerConfig::new("test-ledger".to_string());
    
    if acl_enabled {
        config = config.with_acl(AclConfig::InMemory);
    }
    
    LedgerEngine::new(config).expect("Failed to create test engine")
}

fn create_test_record(id: &str) -> Record {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    Record::with_meta(
        id.to_string(),
        "test".to_string(),
        timestamp,
        serde_json::json!({"test": "data"}),
        serde_json::json!({"test": "meta"}),
    )
}

#[test]
fn test_grant_and_check_access() {
    let mut engine = create_test_engine(true);
    
    // Create grant
    let grant = Grant {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
        granted_by: "oid:onoal:system:admin".to_string(),
        granted_at: 1234567890,
        expires_at: None,
        metadata: None,
    };
    
    // Grant access
    engine.grant(grant.clone()).expect("Grant should succeed");
    
    // Check access (should allow)
    let check = CheckParams {
        requester_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
    };
    
    let allowed = engine.check_access(check).expect("Check should succeed");
    assert!(allowed, "Access should be granted");
}

#[test]
fn test_check_access_denied() {
    let engine = create_test_engine(true);
    
    // Check access WITHOUT grant (should deny)
    let check = CheckParams {
        requester_oid: "oid:onoal:human:bob".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
    };
    
    let allowed = engine.check_access(check).expect("Check should succeed");
    assert!(!allowed, "Access should be denied (no grant)");
}

#[test]
fn test_revoke_access() {
    let mut engine = create_test_engine(true);
    
    // Grant access
    let grant = Grant {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
        granted_by: "oid:onoal:system:admin".to_string(),
        granted_at: 1234567890,
        expires_at: None,
        metadata: None,
    };
    
    engine.grant(grant.clone()).expect("Grant should succeed");
    
    // Check access (should allow)
    let check = CheckParams {
        requester_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
    };
    
    let allowed = engine.check_access(check.clone()).expect("Check should succeed");
    assert!(allowed, "Access should be granted");
    
    // Revoke access
    let revoke = RevokeParams {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
    };
    
    engine.revoke(revoke).expect("Revoke should succeed");
    
    // Check access again (should deny)
    let allowed = engine.check_access(check).expect("Check should succeed");
    assert!(!allowed, "Access should be denied after revoke");
}

#[test]
fn test_list_grants() {
    let mut engine = create_test_engine(true);
    
    // Grant multiple access
    let grant1 = Grant {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "read".to_string(),
        granted_by: "oid:onoal:system:admin".to_string(),
        granted_at: 1234567890,
        expires_at: None,
        metadata: None,
    };
    
    let grant2 = Grant {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
        granted_by: "oid:onoal:system:admin".to_string(),
        granted_at: 1234567890,
        expires_at: None,
        metadata: None,
    };
    
    engine.grant(grant1).expect("Grant 1 should succeed");
    engine.grant(grant2).expect("Grant 2 should succeed");
    
    // List grants
    let grants = engine.list_grants("oid:onoal:human:alice").expect("List should succeed");
    assert_eq!(grants.len(), 2, "Should have 2 grants");
    
    // Check that grants contain both read and write
    let actions: Vec<&str> = grants.iter().map(|g| g.action.as_str()).collect();
    assert!(actions.contains(&"read"), "Should have read grant");
    assert!(actions.contains(&"write"), "Should have write grant");
}

#[test]
fn test_append_with_acl_enforced() {
    let mut engine = create_test_engine(true);
    
    // Create context
    let context = RequestContext::new("oid:onoal:human:alice".to_string());
    
    // Try to append WITHOUT grant (should fail)
    let record = create_test_record("test-1");
    let result = engine.append_record(record.clone(), &context);
    assert!(result.is_err(), "Append should fail (no grant)");
    
    // Grant write access
    let grant = Grant {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
        granted_by: "oid:onoal:system:admin".to_string(),
        granted_at: 1234567890,
        expires_at: None,
        metadata: None,
    };
    
    engine.grant(grant).expect("Grant should succeed");
    
    // Try to append WITH grant (should succeed)
    let result = engine.append_record(record, &context);
    assert!(result.is_ok(), "Append should succeed (with grant)");
}

#[test]
fn test_acl_disabled_by_default() {
    // Create engine WITHOUT ACL
    let mut engine = create_test_engine(false);
    
    // Create context
    let context = RequestContext::new("oid:onoal:human:alice".to_string());
    
    // Append should succeed WITHOUT grant (ACL disabled)
    let record = create_test_record("test-1");
    let result = engine.append_record(record, &context);
    assert!(result.is_ok(), "Append should succeed (ACL disabled)");
}

#[test]
fn test_grant_expiration() {
    let mut engine = create_test_engine(true);
    
    // Grant with expiration in the past
    let grant = Grant {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
        granted_by: "oid:onoal:system:admin".to_string(),
        granted_at: 1234567890,
        expires_at: Some(1234567891), // Expired
        metadata: None,
    };
    
    engine.grant(grant).expect("Grant should succeed");
    
    // Check access (should deny because expired)
    let check = CheckParams {
        requester_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
    };
    
    let allowed = engine.check_access(check).expect("Check should succeed");
    assert!(!allowed, "Access should be denied (grant expired)");
}

#[test]
fn test_action_specificity() {
    let mut engine = create_test_engine(true);
    
    // Grant read access
    let grant = Grant {
        subject_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "read".to_string(),
        granted_by: "oid:onoal:system:admin".to_string(),
        granted_at: 1234567890,
        expires_at: None,
        metadata: None,
    };
    
    engine.grant(grant).expect("Grant should succeed");
    
    // Check read access (should allow)
    let check_read = CheckParams {
        requester_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "read".to_string(),
    };
    
    let allowed = engine.check_access(check_read).expect("Check should succeed");
    assert!(allowed, "Read access should be granted");
    
    // Check write access (should deny)
    let check_write = CheckParams {
        requester_oid: "oid:onoal:human:alice".to_string(),
        resource_oid: "oid:onoal:ledger:test-ledger".to_string(),
        action: "write".to_string(),
    };
    
    let allowed = engine.check_access(check_write).expect("Check should succeed");
    assert!(!allowed, "Write access should be denied (only read granted)");
}

