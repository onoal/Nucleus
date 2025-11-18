use crate::{Record, Hash, CoreError};
use crate::module::{Module, ModuleConfig};
use serde_json::Value;

/// Proof module - handles proof records
pub struct ProofModule {
    config: ModuleConfig,
}

impl ProofModule {
    /// Create a new proof module
    pub fn new(config: ModuleConfig) -> Self {
        Self { config }
    }
}

impl Module for ProofModule {
    fn id(&self) -> &str {
        &self.config.id
    }

    fn version(&self) -> &str {
        &self.config.version
    }

    fn before_append(&self, record: &mut Record) -> Result<(), CoreError> {
        // Only validate if this is a proof record
        if record.stream != "proofs" {
            return Ok(()); // Not our concern, skip validation
        }

        // Ensure required fields
        if !record.payload.get("subject_oid").is_some() {
            return Err(CoreError::InvalidRecord(
                "Proof record must have 'subject_oid'".to_string()
            ));
        }

        if !record.payload.get("issuer_oid").is_some() {
            return Err(CoreError::InvalidRecord(
                "Proof record must have 'issuer_oid'".to_string()
            ));
        }

        Ok(())
    }

    fn after_append(&self, _record: &Record, _hash: &Hash) -> Result<(), CoreError> {
        // No post-processing needed for proof module
        Ok(())
    }

    fn validate(&self, record: &Record) -> Result<(), CoreError> {
        // Create mutable copy for validation
        let mut record_copy = record.clone();
        self.before_append(&mut record_copy)
    }

    fn query<'a>(&self, records: &'a [Record], filters: &Value) -> Vec<&'a Record> {
        records
            .iter()
            .filter(|r| r.stream == "proofs")
            .filter(|r| {
                // Apply filters
                if let Some(subject_oid) = filters.get("subject_oid").and_then(|v| v.as_str()) {
                    if r.payload.get("subject_oid").and_then(|v| v.as_str()) != Some(subject_oid) {
                        return false;
                    }
                }

                if let Some(issuer_oid) = filters.get("issuer_oid").and_then(|v| v.as_str()) {
                    if r.payload.get("issuer_oid").and_then(|v| v.as_str()) != Some(issuer_oid) {
                        return false;
                    }
                }

                true
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_module_new() {
        let config = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = ProofModule::new(config);

        assert_eq!(module.id(), "proof");
        assert_eq!(module.version(), "1.0.0");
    }

    #[test]
    fn test_proof_module_validate_success() {
        let config = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = ProofModule::new(config);

        let record = Record::new(
            "proof-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );

        assert!(module.validate(&record).is_ok());
    }

    #[test]
    fn test_proof_module_validate_missing_fields() {
        let config = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = ProofModule::new(config);

        let record = Record::new(
            "proof-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({
                "type": "proof",
                // Missing subject_oid and issuer_oid
            }),
        );

        assert!(module.validate(&record).is_err());
    }

    #[test]
    fn test_proof_module_query() {
        let config = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = ProofModule::new(config);

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

        let records = vec![record1, record2];
        let filters = serde_json::json!({
            "subject_oid": "oid:onoal:human:alice"
        });

        let results = module.query(&records, &filters);
        assert_eq!(results.len(), 1);
    }
}

