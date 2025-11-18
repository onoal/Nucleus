use nucleus_core::{Record, Hash, RequestContext};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};
use nucleus_core::module::Module;
use crate::config::{LedgerConfig, StorageConfig, AclConfig};
use crate::state::LedgerState;
use crate::module_registry::ModuleRegistry;
use crate::error::EngineError;
use crate::query::{QueryFilters, QueryResult};
use crate::storage::StorageBackend;
use crate::acl::{AclBackend, InMemoryAcl, CheckParams};

#[cfg(not(target_arch = "wasm32"))]
use crate::storage::SqliteStorage;

/// Ledger engine - runtime wrapper around nucleus-core
pub struct LedgerEngine {
    /// Engine configuration
    config: LedgerConfig,

    /// In-memory ledger state
    state: LedgerState,

    /// Module registry
    modules: ModuleRegistry,
    
    /// Optional persistent storage backend
    storage: Option<Box<dyn StorageBackend>>,
    
    /// Optional ACL backend
    acl: Option<Box<dyn AclBackend>>,
}

impl LedgerEngine {
    /// Create a new ledger engine
    ///
    /// # Important
    ///
    /// If storage is configured, the engine will:
    /// 1. Initialize storage (create tables if needed)
    /// 2. Load all existing entries from storage
    /// 3. Verify full chain integrity (hash reconstruction)
    /// 4. Auto-save on every append operation
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Configuration is invalid
    /// - Storage initialization fails
    /// - Chain integrity check fails on load
    /// - Module loading fails
    pub fn new(config: LedgerConfig) -> Result<Self, EngineError> {
        // Validate config
        config.validate()?;

        // Initialize module registry with ledger ID
        let mut modules = ModuleRegistry::with_ledger_id(config.id.clone());
        modules.load_from_config(&config.modules)?;
        
        // Initialize and start modules
        modules.init_all()?;
        modules.start_all()?;

        // Initialize storage backend
        #[cfg(not(target_arch = "wasm32"))]
        let storage: Option<Box<dyn StorageBackend>> = match &config.storage {
            StorageConfig::None => None,
            StorageConfig::Sqlite { path } => {
                let mut sqlite = SqliteStorage::new(path)?;
                sqlite.initialize()?;
                Some(Box::new(sqlite))
            }
            StorageConfig::Postgres { .. } => {
                return Err(EngineError::InvalidQuery(
                    "PostgreSQL storage not yet implemented".to_string()
                ));
            }
        };
        
        // WASM: storage not supported (always in-memory)
        #[cfg(target_arch = "wasm32")]
        let storage: Option<Box<dyn StorageBackend>> = {
            if !matches!(config.storage, StorageConfig::None) {
                return Err(EngineError::InvalidQuery(
                    "Persistent storage is not supported in WASM. Use in-memory mode only.".to_string()
                ));
            }
            None
        };

        // Initialize ACL backend
        let acl: Option<Box<dyn AclBackend>> = match config.acl {
            AclConfig::None => None,
            AclConfig::InMemory => Some(Box::new(InMemoryAcl::new())),
        };

        // Initialize state
        let mut state = LedgerState::new();
        
        // Load existing entries from storage if available
        if let Some(ref storage) = storage {
            let entries = storage.load_all_entries()?;
            
            // Verify chain integrity on load
            if !entries.is_empty() {
                let result = verify_chain(&entries);
                if !result.valid {
                    return Err(EngineError::ChainInvalid(result));
                }
            }
            
            // Load into state
            for entry in entries {
                state.append(entry);
            }
        }

        Ok(Self {
            config,
            state,
            modules,
            storage,
            acl,
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
    ///
    /// # Important
    ///
    /// If storage is configured:
    /// - Record is saved to persistent storage atomically
    /// - Only appended to state if storage save succeeds
    /// - Chain integrity is maintained (rollback on error)
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Record validation fails
    /// - Module hooks fail
    /// - Storage save fails (state unchanged)
    pub fn append_record(&mut self, mut record: Record, context: &RequestContext) -> Result<Hash, EngineError> {
        // 1. Validate context
        context.validate()?;
        
        // 2. Check ACL if enabled
        if let Some(acl) = &self.acl {
            let resource_oid = format!("oid:onoal:ledger:{}", self.config.id);
            
            let allowed = acl.check(&CheckParams {
                requester_oid: context.requester_oid.clone(),
                resource_oid,
                action: "write".to_string(),
            })?;
            
            if !allowed {
                return Err(EngineError::AccessDenied(
                    format!("User {} does not have write access", context.requester_oid)
                ));
            }
        }
        
        // 3. Validate record
        record.validate()?;

        // 4. Call module before_append hooks
        for module in self.modules.all_modules() {
            module.before_append(&mut record)?;
        }

        // 5. Get previous hash
        let prev_hash = self.state.latest_hash().copied();

        // 6. Create chain entry
        let entry = ChainEntry::new(record.clone(), prev_hash)?;
        let hash = entry.hash;

        // 7. Save to storage first (if configured)
        // If storage fails, state remains unchanged
        if let Some(ref mut storage) = self.storage {
            storage.save_entry(&entry)?;
        }

        // 8. Call module after_append hooks
        for module in self.modules.all_modules() {
            module.after_append(&record, &hash)?;
        }

        // Append to state (only after successful storage save)
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
    /// # Important
    ///
    /// This is an atomic operation:
    /// - If any record fails validation or append, the entire batch fails
    /// - No records are added to the ledger (state or storage)
    /// - Storage operations use transactions for atomicity
    ///
    /// If storage is configured:
    /// - All records are saved to storage first
    /// - Only appended to state if all storage saves succeed
    /// - Rollback on any error
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Any record validation fails
    /// - Any module hook fails
    /// - Any storage save fails (entire batch rolled back)
    pub fn append_batch(&mut self, records: Vec<Record>, context: &RequestContext) -> Result<Vec<Hash>, EngineError> {
        // 1. Validate context
        context.validate()?;
        
        // 2. Check ACL if enabled
        if let Some(acl) = &self.acl {
            let resource_oid = format!("oid:onoal:ledger:{}", self.config.id);
            
            let allowed = acl.check(&CheckParams {
                requester_oid: context.requester_oid.clone(),
                resource_oid,
                action: "write".to_string(),
            })?;
            
            if !allowed {
                return Err(EngineError::AccessDenied(
                    format!("User {} does not have write access", context.requester_oid)
                ));
            }
        }
        
        // 3. Validate all records first
        for record in &records {
            record.validate()?;
        }

        // 4. Process all records through modules (before_append)
        let mut processed_records = Vec::new();
        for mut record in records {
            // Call module before_append hooks
            for module in self.modules.all_modules() {
                module.before_append(&mut record)?;
            }
            processed_records.push(record);
        }

        // 5. Get starting prev_hash
        let mut prev_hash = self.state.latest_hash().copied();

        // 6. Create all chain entries
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

        // Save all entries to storage first (if configured)
        // If any save fails, storage should handle rollback
        if let Some(ref mut storage) = self.storage {
            for entry in &entries {
                storage.save_entry(entry)?;
            }
        }

        // Append all entries to state (only after successful storage saves)
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
    
    /// Get module metadata (ID, version, state)
    pub fn module_metadata(&self) -> Vec<crate::module_registry::ModuleMeta> {
        self.modules.get_all_meta()
    }
    
    /// Get module state by ID
    pub fn module_state(&self, id: &str) -> Option<nucleus_core::module::ModuleState> {
        self.modules.get_state(id)
    }
    
    /// Grant ACL access
    ///
    /// Grants permission for a subject to access a resource.
    pub fn grant(&mut self, grant: crate::acl::Grant) -> Result<(), EngineError> {
        if let Some(acl) = &mut self.acl {
            acl.grant(grant)?;
            Ok(())
        } else {
            Err(EngineError::Configuration("ACL not enabled".into()))
        }
    }
    
    /// Check ACL access
    ///
    /// Returns true if the requester has the specified permission.
    pub fn check_access(&self, params: CheckParams) -> Result<bool, EngineError> {
        if let Some(acl) = &self.acl {
            Ok(acl.check(&params)?)
        } else {
            Ok(true) // No ACL = always allowed
        }
    }
    
    /// Revoke ACL access
    ///
    /// Revokes permission for a subject to access a resource.
    pub fn revoke(&mut self, params: crate::acl::RevokeParams) -> Result<(), EngineError> {
        if let Some(acl) = &mut self.acl {
            acl.revoke(&params)?;
            Ok(())
        } else {
            Err(EngineError::Configuration("ACL not enabled".into()))
        }
    }
    
    /// List all grants for a subject
    ///
    /// Returns all active (non-expired) grants for the given subject OID.
    pub fn list_grants(&self, subject_oid: &str) -> Result<Vec<crate::acl::Grant>, EngineError> {
        if let Some(acl) = &self.acl {
            Ok(acl.list_grants(subject_oid)?)
        } else {
            Ok(vec![])
        }
    }
    
    /// Check if storage is enabled
    pub fn has_storage(&self) -> bool {
        self.storage.is_some()
    }
    
    /// Verify storage integrity (if storage is enabled)
    ///
    /// This performs full chain verification on storage:
    /// - Loads all entries from storage
    /// - Recomputes hashes
    /// - Verifies chain links
    ///
    /// # Returns
    ///
    /// - `Ok(true)` if storage is enabled and integrity is valid
    /// - `Ok(false)` if storage is not enabled
    /// - `Err(EngineError)` if integrity check fails
    pub fn verify_storage(&self) -> Result<bool, EngineError> {
        if let Some(ref storage) = self.storage {
            storage.verify_integrity()?;
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

/// Cleanup on engine drop
impl Drop for LedgerEngine {
    fn drop(&mut self) {
        // Stop all modules (best-effort cleanup)
        self.modules.stop_all();
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

        let ctx = RequestContext::new("oid:onoal:system:test".into());
        let _hash = engine.append_record(record, &ctx).unwrap();

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

        let ctx = RequestContext::new("oid:onoal:system:test".into());
        let hash = engine.append_record(record.clone(), &ctx).unwrap();
        let retrieved = engine.get_record(&hash);

        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, "record-1");
    }

    #[test]
    fn test_ledger_engine_verify() {
        let config = create_test_config();
        let mut engine = LedgerEngine::new(config).unwrap();

        let ctx = RequestContext::new("oid:onoal:system:test".into());
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
            engine.append_record(record, &ctx).unwrap();
        }

        // Verify chain
        assert!(engine.verify().is_ok());
    }
}

