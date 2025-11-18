use wasm_bindgen::prelude::*;
use nucleus_core::Record;
use serde_wasm_bindgen;
use serde_json;

/// WASM-friendly record helper
#[wasm_bindgen]
pub struct WasmRecord {
    inner: Record,
}

#[wasm_bindgen]
impl WasmRecord {
    /// Create a new record
    #[wasm_bindgen(constructor)]
    pub fn new(
        id: String,
        stream: String,
        timestamp: u64,
        payload: JsValue,
    ) -> Result<WasmRecord, JsValue> {
        let payload_json: serde_json::Value = serde_wasm_bindgen::from_value(payload)
            .map_err(|e| JsValue::from_str(&format!("Payload error: {}", e)))?;

        let record = Record::new(id, stream, timestamp, payload_json);

        Ok(WasmRecord { inner: record })
    }

    /// Create a new record with metadata
    #[wasm_bindgen]
    pub fn with_meta(
        id: String,
        stream: String,
        timestamp: u64,
        payload: JsValue,
        meta: JsValue,
    ) -> Result<WasmRecord, JsValue> {
        let payload_json: serde_json::Value = serde_wasm_bindgen::from_value(payload)
            .map_err(|e| JsValue::from_str(&format!("Payload error: {}", e)))?;

        let meta_json: serde_json::Value = serde_wasm_bindgen::from_value(meta)
            .map_err(|e| JsValue::from_str(&format!("Meta error: {}", e)))?;

        let record = Record::with_meta(id, stream, timestamp, payload_json, meta_json);

        Ok(WasmRecord { inner: record })
    }

    /// Validate record
    #[wasm_bindgen]
    pub fn validate(&self) -> Result<(), JsValue> {
        self.inner.validate()
            .map_err(|e| JsValue::from_str(&format!("Validation error: {}", e)))?;
        Ok(())
    }

    /// Get record as JSON
    #[wasm_bindgen]
    pub fn to_json(&self) -> Result<JsValue, JsValue> {
        let json = serde_json::to_value(&self.inner)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;
        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&format!("WASM bindgen error: {}", e)))
    }

    /// Get inner record (for internal use)
    pub(crate) fn into_inner(self) -> Record {
        self.inner
    }
}

impl From<Record> for WasmRecord {
    fn from(record: Record) -> Self {
        Self { inner: record }
    }
}

impl From<WasmRecord> for Record {
    fn from(wasm_record: WasmRecord) -> Self {
        wasm_record.inner
    }
}

