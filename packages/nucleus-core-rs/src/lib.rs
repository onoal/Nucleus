use wasm_bindgen::prelude::*;
use serde_json::Value;
use sha2::{Sha256, Digest};
use base64::Engine;

mod canonicalize;
use canonicalize::canonicalize_json;

/// Compute SHA-256 hash of a canonical JSON representation
/// Returns base64url-encoded hash string
#[wasm_bindgen]
pub fn compute_hash(record_without_hash: JsValue) -> Result<String, JsValue> {
    // Deserialize from JS
    let value: Value = serde_wasm_bindgen::from_value(record_without_hash)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse JSON: {}", e)))?;
    
    // Canonicalize
    let canonical_bytes = canonicalize_json(&value)
        .map_err(|e| JsValue::from_str(&format!("Canonicalization failed: {}", e)))?;
    
    // Hash with SHA-256
    let mut hasher = Sha256::new();
    hasher.update(&canonical_bytes);
    let hash_bytes = hasher.finalize();
    
    // Encode as base64url (RFC 4648 §5)
    let base64url_hash = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(hash_bytes);
    
    Ok(base64url_hash)
}

/// Canonicalize JSON (for testing/debugging)
/// Returns canonical JSON bytes
#[wasm_bindgen]
pub fn canonicalize(record_without_hash: JsValue) -> Result<Vec<u8>, JsValue> {
    let value: Value = serde_wasm_bindgen::from_value(record_without_hash)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse JSON: {}", e)))?;
    
    canonicalize_json(&value)
        .map_err(|e| JsValue::from_str(&format!("Canonicalization failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_canonicalize_sorts_keys() {
        let value = json!({
            "z": 1,
            "a": 2,
            "m": 3
        });
        
        let canonical = canonicalize_json(&value).unwrap();
        let canonical_str = String::from_utf8(canonical).unwrap();
        
        // Keys should be sorted alphabetically
        assert_eq!(canonical_str, r#"{"a":2,"m":3,"z":1}"#);
    }
    
    #[test]
    fn test_canonicalize_nested_objects() {
        let value = json!({
            "outer": {
                "z": 1,
                "a": 2
            },
            "array": [3, 2, 1]
        });
        
        let canonical = canonicalize_json(&value).unwrap();
        let canonical_str = String::from_utf8(canonical).unwrap();
        
        // Nested keys sorted, array order preserved
        assert_eq!(canonical_str, r#"{"array":[3,2,1],"outer":{"a":2,"z":1}}"#);
    }
    
    #[test]
    fn test_compute_hash_deterministic() {
        let value1 = json!({"b": 2, "a": 1});
        let value2 = json!({"a": 1, "b": 2});
        
        let hash1 = canonicalize_json(&value1)
            .and_then(|bytes| {
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD
                    .encode(hasher.finalize()))
            })
            .unwrap();
        
        let hash2 = canonicalize_json(&value2)
            .and_then(|bytes| {
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD
                    .encode(hasher.finalize()))
            })
            .unwrap();
        
        // Same content (different order) should produce same hash
        assert_eq!(hash1, hash2);
    }
}

