use wasm_bindgen::prelude::*;
use nucleus_engine::{LedgerEngine, LedgerConfig};
use nucleus_core::{Hash, Record};
use serde_wasm_bindgen;
use serde_json;

/// WASM-wrapped LedgerEngine
#[wasm_bindgen]
pub struct WasmLedger {
    inner: LedgerEngine,
}

#[wasm_bindgen]
impl WasmLedger {
    /// Create a new ledger from configuration
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue) -> Result<WasmLedger, JsValue> {
        // Deserialize config from JS
        let config_json: serde_json::Value = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&format!("Config deserialization error: {}", e)))?;

        let config: LedgerConfig = serde_json::from_value(config_json)
            .map_err(|e| JsValue::from_str(&format!("Config error: {}", e)))?;

        // Create engine
        let engine = LedgerEngine::new(config)
            .map_err(|e| JsValue::from_str(&format!("Engine error: {}", e)))?;

        Ok(WasmLedger { inner: engine })
    }

    /// Get ledger ID
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.inner.id().to_string()
    }

    /// Append a record to the ledger
    #[wasm_bindgen]
    pub fn append_record(&mut self, record: JsValue) -> Result<String, JsValue> {
        // Deserialize record from JS
        let record_json: serde_json::Value = serde_wasm_bindgen::from_value(record)
            .map_err(|e| JsValue::from_str(&format!("Record deserialization error: {}", e)))?;

        let record: Record = serde_json::from_value(record_json)
            .map_err(|e| JsValue::from_str(&format!("Record error: {}", e)))?;

        // Append to engine
        let hash = self.inner.append_record(record)
            .map_err(|e| JsValue::from_str(&format!("Append error: {}", e)))?;

        // Return hash as hex string
        Ok(hash.to_hex())
    }

    /// Get record by hash
    #[wasm_bindgen]
    pub fn get_record(&self, hash: &str) -> Result<JsValue, JsValue> {
        // Parse hash from hex
        let hash_obj = Hash::from_hex(hash)
            .map_err(|e| JsValue::from_str(&format!("Invalid hash: {}", e)))?;

        // Get record
        let record = self.inner.get_record(&hash_obj)
            .ok_or_else(|| JsValue::from_str("Record not found"))?;

        // Serialize to JS
        let json = serde_json::to_value(record)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&format!("WASM bindgen error: {}", e)))
    }

    /// Get record by ID
    #[wasm_bindgen]
    pub fn get_record_by_id(&self, id: &str) -> Result<JsValue, JsValue> {
        let record = self.inner.get_record_by_id(id)
            .ok_or_else(|| JsValue::from_str("Record not found"))?;

        let json = serde_json::to_value(record)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&format!("WASM bindgen error: {}", e)))
    }

    /// Verify chain integrity
    #[wasm_bindgen]
    pub fn verify(&self) -> Result<(), JsValue> {
        self.inner.verify()
            .map_err(|e| JsValue::from_str(&format!("Verify error: {}", e)))?;
        Ok(())
    }

    /// Get entry count
    #[wasm_bindgen]
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    /// Check if ledger is empty
    #[wasm_bindgen]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// Get latest entry hash
    #[wasm_bindgen]
    pub fn latest_hash(&self) -> Option<String> {
        self.inner.latest_hash().map(|h| h.to_hex())
    }

    /// Query records with filters
    #[wasm_bindgen]
    pub fn query(&self, filters: JsValue) -> Result<JsValue, JsValue> {
        use nucleus_engine::QueryFilters;

        // Deserialize filters from JS
        let filters_json: serde_json::Value = serde_wasm_bindgen::from_value(filters)
            .map_err(|e| JsValue::from_str(&format!("Filters error: {}", e)))?;

        // Build QueryFilters
        let mut query_filters = QueryFilters::new();

        if let Some(stream) = filters_json.get("stream").and_then(|v| v.as_str()) {
            query_filters = query_filters.with_stream(stream.to_string());
        }

        if let Some(id) = filters_json.get("id").and_then(|v| v.as_str()) {
            query_filters = query_filters.with_id(id.to_string());
        }

        if let Some(limit) = filters_json.get("limit").and_then(|v| v.as_u64()) {
            query_filters = query_filters.with_limit(limit as usize);
        }

        if let Some(offset) = filters_json.get("offset").and_then(|v| v.as_u64()) {
            query_filters = query_filters.with_offset(offset as usize);
        }

        if let Some(from) = filters_json.get("timestamp_from").and_then(|v| v.as_u64()) {
            let to = filters_json.get("timestamp_to").and_then(|v| v.as_u64());
            query_filters = query_filters.with_timestamp_range(Some(from), to);
        }

        if let Some(module_filters) = filters_json.get("module_filters") {
            query_filters = query_filters.with_module_filters(module_filters.clone());
        }

        // Execute query
        let result = self.inner.query(query_filters);

        // Serialize result to JS
        let json = serde_json::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&format!("WASM bindgen error: {}", e)))
    }

    /// Append multiple records atomically
    #[wasm_bindgen]
    pub fn append_batch(&mut self, records: JsValue) -> Result<JsValue, JsValue> {
        // Deserialize records array from JS
        let records_json: serde_json::Value = serde_wasm_bindgen::from_value(records)
            .map_err(|e| JsValue::from_str(&format!("Records error: {}", e)))?;

        let records_array = records_json.as_array()
            .ok_or_else(|| JsValue::from_str("Records must be an array"))?;

        let mut rust_records = Vec::new();
        for record_json in records_array {
            let record: Record = serde_json::from_value(record_json.clone())
                .map_err(|e| JsValue::from_str(&format!("Record error: {}", e)))?;
            rust_records.push(record);
        }

        // Append batch
        let hashes = self.inner.append_batch(rust_records)
            .map_err(|e| JsValue::from_str(&format!("Batch append error: {}", e)))?;

        // Convert hashes to hex strings
        let hash_strings: Vec<String> = hashes.iter().map(|h| h.to_hex()).collect();

        // Serialize to JS
        let json = serde_json::to_value(&hash_strings)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&format!("WASM bindgen error: {}", e)))
    }
    
    /// Check if persistent storage is enabled
    ///
    /// Returns true if the ledger has persistent storage configured
    /// (SQLite, PostgreSQL, etc.), false if in-memory only.
    #[wasm_bindgen]
    pub fn has_storage(&self) -> bool {
        self.inner.has_storage()
    }
    
    /// Verify storage integrity (if storage is enabled)
    ///
    /// This performs full chain verification on persistent storage:
    /// - Loads all entries from storage
    /// - Recomputes hashes
    /// - Verifies chain links
    ///
    /// Returns Ok if:
    /// - Storage is not enabled (returns false)
    /// - Storage is enabled and integrity is valid (returns true)
    ///
    /// Returns Err if integrity check fails.
    #[wasm_bindgen]
    pub fn verify_storage(&self) -> Result<bool, JsValue> {
        self.inner.verify_storage()
            .map_err(|e| JsValue::from_str(&format!("Storage verify error: {}", e)))
    }
    
    /// List all registered module IDs
    ///
    /// Returns an array of module IDs that are loaded in this ledger.
    #[wasm_bindgen]
    pub fn list_modules(&self) -> JsValue {
        let ids = self.inner.module_ids();
        serde_wasm_bindgen::to_value(&ids).unwrap_or(JsValue::NULL)
    }
    
    /// Get module metadata (ID, version, state)
    ///
    /// Returns detailed information about all loaded modules including
    /// their current lifecycle state.
    #[wasm_bindgen]
    pub fn get_module_metadata(&self) -> JsValue {
        let meta = self.inner.module_metadata();
        
        // Convert to JS-friendly format
        let js_meta: Vec<serde_json::Value> = meta.iter().map(|m| {
            serde_json::json!({
                "id": m.id,
                "version": m.version,
                "state": format!("{:?}", m.state)
            })
        }).collect();
        
        serde_wasm_bindgen::to_value(&js_meta).unwrap_or(JsValue::NULL)
    }
    
    /// Get module state by ID
    ///
    /// Returns the current lifecycle state of a specific module.
    /// Returns null if module not found.
    #[wasm_bindgen]
    pub fn get_module_state(&self, id: &str) -> JsValue {
        match self.inner.module_state(id) {
            Some(state) => JsValue::from_str(&format!("{:?}", state)),
            None => JsValue::NULL,
        }
    }
}

