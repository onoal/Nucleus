use crate::{Record, Hash, CoreError};
use crate::module::{Module, ModuleConfig};
use serde_json::Value;

/// Asset module - handles asset records
pub struct AssetModule {
    config: ModuleConfig,
}

impl AssetModule {
    /// Create a new asset module
    pub fn new(config: ModuleConfig) -> Self {
        Self { config }
    }
}

impl Module for AssetModule {
    fn id(&self) -> &str {
        &self.config.id
    }

    fn version(&self) -> &str {
        &self.config.version
    }

    fn before_append(&self, record: &mut Record) -> Result<(), CoreError> {
        // Only validate if this is an asset record
        if record.stream != "assets" {
            return Ok(()); // Not our concern, skip validation
        }

        // Validate required fields
        if !record.payload.get("owner_oid").is_some() {
            return Err(CoreError::InvalidRecord(
                "Asset record must have 'owner_oid'".to_string()
            ));
        }

        Ok(())
    }

    fn after_append(&self, _record: &Record, _hash: &Hash) -> Result<(), CoreError> {
        Ok(())
    }

    fn validate(&self, record: &Record) -> Result<(), CoreError> {
        let mut record_copy = record.clone();
        self.before_append(&mut record_copy)
    }

    fn query<'a>(&self, records: &'a [Record], filters: &Value) -> Vec<&'a Record> {
        records
            .iter()
            .filter(|r| r.stream == "assets")
            .filter(|r| {
                if let Some(owner_oid) = filters.get("owner_oid").and_then(|v| v.as_str()) {
                    if r.payload.get("owner_oid").and_then(|v| v.as_str()) != Some(owner_oid) {
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
    fn test_asset_module_new() {
        let config = ModuleConfig::new(
            "asset".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = AssetModule::new(config);

        assert_eq!(module.id(), "asset");
        assert_eq!(module.version(), "1.0.0");
    }

    #[test]
    fn test_asset_module_validate_success() {
        let config = ModuleConfig::new(
            "asset".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = AssetModule::new(config);

        let record = Record::new(
            "asset-1".to_string(),
            "assets".to_string(),
            1234567890,
            serde_json::json!({
                "type": "asset",
                "owner_oid": "oid:onoal:human:alice",
            }),
        );

        assert!(module.validate(&record).is_ok());
    }

    #[test]
    fn test_asset_module_query() {
        let config = ModuleConfig::new(
            "asset".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = AssetModule::new(config);

        let record1 = Record::new(
            "asset-1".to_string(),
            "assets".to_string(),
            1234567890,
            serde_json::json!({
                "type": "asset",
                "owner_oid": "oid:onoal:human:alice",
            }),
        );

        let record2 = Record::new(
            "asset-2".to_string(),
            "assets".to_string(),
            1234567891,
            serde_json::json!({
                "type": "asset",
                "owner_oid": "oid:onoal:human:bob",
            }),
        );

        let records = vec![record1, record2];
        let filters = serde_json::json!({
            "owner_oid": "oid:onoal:human:alice"
        });

        let results = module.query(&records, &filters);
        assert_eq!(results.len(), 1);
    }
}

