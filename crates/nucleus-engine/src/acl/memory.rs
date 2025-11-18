use super::trait_def::AclBackend;
use super::types::{Grant, CheckParams, RevokeParams};
use super::error::AclResult;
use std::collections::HashMap;

/// In-memory ACL implementation
///
/// Simple in-memory storage for ACL grants.
/// For production, consider using persistent storage.
pub struct InMemoryAcl {
    grants: HashMap<String, Grant>,
}

impl InMemoryAcl {
    pub fn new() -> Self {
        Self {
            grants: HashMap::new(),
        }
    }

    fn make_key(subject_oid: &str, resource_oid: &str, action: &str) -> String {
        format!("{}:{}:{}", subject_oid, resource_oid, action)
    }
}

impl Default for InMemoryAcl {
    fn default() -> Self {
        Self::new()
    }
}

impl AclBackend for InMemoryAcl {
    fn grant(&mut self, grant: Grant) -> AclResult<()> {
        let key = Self::make_key(&grant.subject_oid, &grant.resource_oid, &grant.action);
        self.grants.insert(key, grant);
        Ok(())
    }

    fn check(&self, params: &CheckParams) -> AclResult<bool> {
        let key = Self::make_key(&params.requester_oid, &params.resource_oid, &params.action);

        if let Some(grant) = self.grants.get(&key) {
            // Check expiration
            if let Some(expires_at) = grant.expires_at {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();

                if expires_at < now {
                    return Ok(false);
                }
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn revoke(&mut self, params: &RevokeParams) -> AclResult<()> {
        let key = Self::make_key(&params.subject_oid, &params.resource_oid, &params.action);
        self.grants.remove(&key);
        Ok(())
    }

    fn list_grants(&self, subject_oid: &str) -> AclResult<Vec<Grant>> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(self.grants
            .values()
            .filter(|g| {
                g.subject_oid == subject_oid &&
                g.expires_at.map_or(true, |exp| exp >= now)
            })
            .cloned()
            .collect())
    }

    fn clear(&mut self) -> AclResult<()> {
        self.grants.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grant_and_check() {
        let mut acl = InMemoryAcl::new();

        let grant = Grant {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
            granted_by: "oid:onoal:system:admin".into(),
            granted_at: 1234567890,
            expires_at: None,
            metadata: None,
        };

        acl.grant(grant).unwrap();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(allowed);
    }

    #[test]
    fn test_deny_without_grant() {
        let acl = InMemoryAcl::new();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:bob".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(!allowed);
    }

    #[test]
    fn test_revoke() {
        let mut acl = InMemoryAcl::new();

        let grant = Grant {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
            granted_by: "oid:onoal:system:admin".into(),
            granted_at: 1234567890,
            expires_at: None,
            metadata: None,
        };

        acl.grant(grant).unwrap();

        acl.revoke(&RevokeParams {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(!allowed);
    }

    #[test]
    fn test_expiration() {
        let mut acl = InMemoryAcl::new();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let grant = Grant {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
            granted_by: "oid:onoal:system:admin".into(),
            granted_at: now,
            expires_at: Some(now - 100), // Expired
            metadata: None,
        };

        acl.grant(grant).unwrap();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(!allowed);
    }
}

