use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};
use nucleus_core::module::Module;
use crate::config::LedgerConfig;
use crate::state::LedgerState;
use crate::module_registry::ModuleRegistry;
use crate::error::EngineError;
use crate::query::{QueryFilters, QueryResult};

/// Ledger engine - runtime wrapper around nucleus-core
pub struct LedgerEngine {
    /// Engine configuration
    config: LedgerConfig,

    /// In-memory ledger state
    state: LedgerState,

    /// Module registry
    modules: ModuleRegistry,
}

impl LedgerEngine {
    /// Create a new ledger engine
    pub fn new(config: LedgerConfig) -> Result<Self, EngineError> {
        // Validate config
        config.validate()?;

        // Initialize module registry
        let mut modules = ModuleRegistry::new();
        modules.load_from_config(&config.modules)?;

        Ok(Self {
            config,
            state: LedgerState::new(),
            modules,
        })
    }

    /// Get engine configuration
    pub fn config(&self) -> &LedgerConfig {
        &self.config
    }

    /// Get ledger ID
    pub fn id(&self) -> &str {
        &self.config.id
    }

    /// Append a record to the ledger
    pub fn append_record(&mut self, mut record: Record) -> Result<Hash, EngineError> {
        // Validate record
        record.validate()?;

        // Call module before_append hooks
        for module in self.modules.all_modules() {
            module.before_append(&mut record)?;
        }

        // Get previous hash
        let prev_hash = self.state.latest_hash().copied();

        // Create chain entry
        let entry = ChainEntry::new(record.clone(), prev_hash)?;
        let hash = entry.hash;

        // Call module after_append hooks
        for module in self.modules.all_modules() {
            module.after_append(&record, &hash)?;
        }

        // Append to state
        self.state.append(entry);

        Ok(hash)
    }

    /// Get record by hash
    pub fn get_record(&self, hash: &Hash) -> Option<&Record> {
        self.state
            .get_by_hash(hash)
            .map(|entry| &entry.record)
    }

    /// Get record by ID
    pub fn get_record_by_id(&self, id: &str) -> Option<&Record> {
        self.state
            .get_by_id(id)
            .map(|entry| &entry.record)
    }

    /// Query records with filters
    pub fn query(&self, filters: QueryFilters) -> QueryResult {
        // Start with all entries
        let mut entries: Vec<&ChainEntry> = self.state.all_entries().iter().collect();

        // Filter by stream
        if let Some(ref stream) = filters.stream {
            entries.retain(|e| e.record.stream == *stream);
        }

        // Filter by ID
        if let Some(ref id) = filters.id {
            entries.retain(|e| e.record.id == *id);
        }

        // Filter by timestamp range
        if let Some(from) = filters.timestamp_from {
            entries.retain(|e| e.record.timestamp >= from);
        }
        if let Some(to) = filters.timestamp_to {
            entries.retain(|e| e.record.timestamp <= to);
        }

        // Apply module-specific filters
        // First convert to owned records for module query
        let mut records: Vec<Record> = entries.iter().map(|e| e.record.clone()).collect();

        // Only apply module filters if we have module filters or if we need module-specific filtering
        if !filters.module_filters.is_null() && !filters.module_filters.as_object().map(|o| o.is_empty()).unwrap_or(true) {
            for module in self.modules.all_modules() {
                let filtered_refs = module.query(records.as_slice(), &filters.module_filters);
                // Convert back to owned records
                records = filtered_refs.into_iter().cloned().collect();
            }
        }

        // Calculate total before limit/offset
        let total = records.len();

        // Apply limit/offset
        let offset = filters.offset.unwrap_or(0);
        let limit = filters.limit.unwrap_or(records.len());

        let records: Vec<Record> = records
            .into_iter()
            .skip(offset)
            .take(limit)
            .collect();

        let has_more = (offset + records.len()) < total;

        QueryResult {
            records,
            total,
            has_more,
        }
    }

    /// Append multiple records atomically
    ///
    /// If any record fails validation or append, the entire batch fails
    /// and no records are added to the ledger.
    pub fn append_batch(&mut self, records: Vec<Record>) -> Result<Vec<Hash>, EngineError> {
        // Validate all records first
        for record in &records {
            record.validate()?;
        }

        // Process all records through modules (before_append)
        let mut processed_records = Vec::new();
        for mut record in records {
            // Call module before_append hooks
            for module in self.modules.all_modules() {
                module.before_append(&mut record)?;
            }
            processed_records.push(record);
        }

        // Get starting prev_hash
        let mut prev_hash = self.state.latest_hash().copied();

        // Create all chain entries
        let mut entries = Vec::new();
        let mut hashes = Vec::new();

        for record in processed_records {
            let entry = ChainEntry::new(record.clone(), prev_hash)?;
            let hash = entry.hash;

            // Call module after_append hooks
            for module in self.modules.all_modules() {
                module.after_append(&record, &hash)?;
            }

            prev_hash = Some(hash);
            hashes.push(hash);
            entries.push(entry);
        }

        // Append all entries to state (atomic operation)
        for entry in entries {
            self.state.append(entry);
        }

        Ok(hashes)
    }

    /// Verify chain integrity
    pub fn verify(&self) -> Result<(), EngineError> {
        let result = verify_chain(self.state.all_entries());

        if !result.valid {
            return Err(EngineError::ChainInvalid(result));
        }

        Ok(())
    }

    /// Get entry count
    pub fn len(&self) -> usize {
        self.state.len()
    }

    /// Check if ledger is empty
    pub fn is_empty(&self) -> bool {
        self.state.is_empty()
    }

    /// Get latest entry hash
    pub fn latest_hash(&self) -> Option<&Hash> {
        self.state.latest_hash()
    }

    /// Get a module by ID
    pub fn get_module(&self, id: &str) -> Option<&dyn Module> {
        self.modules.get_module(id)
    }

    /// Get all module IDs
    pub fn module_ids(&self) -> Vec<String> {
        self.modules.module_ids()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nucleus_core::module::ModuleConfig;

    fn create_test_config() -> LedgerConfig {
        LedgerConfig::with_modules(
            "test-ledger".to_string(),
            vec![
                ModuleConfig::new(
                    "proof".to_string(),
                    "1.0.0".to_string(),
                    serde_json::json!({}),
                ),
            ],
        )
    }

    #[test]
    fn test_ledger_engine_new() {
        let config = create_test_config();
        let engine = LedgerEngine::new(config).unwrap();

        assert_eq!(engine.id(), "test-ledger");
        assert!(engine.is_empty());
    }

    #[test]
    fn test_ledger_engine_append_record() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let record = Record::new(
            "record-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );

        let hash = engine.append_record(record).unwrap();

        assert!(!engine.is_empty());
        assert_eq!(engine.len(), 1);
        assert!(engine.latest_hash().is_some());
    }

    #[test]
    fn test_ledger_engine_get_record() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let record = Record::new(
            "record-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );

        let hash = engine.append_record(record.clone()).unwrap();
        let retrieved = engine.get_record(&hash);

        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, "record-1");
    }

    #[test]
    fn test_ledger_engine_verify() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        for i in 0..5 {
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
            engine.append_record(record).unwrap();
        }

        // Verify chain
        assert!(engine.verify().is_ok());
    }
}

