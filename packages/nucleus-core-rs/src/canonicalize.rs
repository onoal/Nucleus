use serde_json::{Value, Map};
use std::io::Write;

/// Canonicalize JSON according to JCS (RFC 8785) style
/// 
/// Rules:
/// - Object keys sorted lexicographically (UTF-8 byte order)
/// - No whitespace
/// - Unicode escape sequences normalized
/// - Numbers in standard JSON representation
pub fn canonicalize_json(value: &Value) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    write_canonical(&mut buffer, value)
        .map_err(|e| format!("Failed to write canonical JSON: {}", e))?;
    Ok(buffer)
}

fn write_canonical<W: Write>(writer: &mut W, value: &Value) -> std::io::Result<()> {
    match value {
        Value::Null => write!(writer, "null"),
        Value::Bool(b) => write!(writer, "{}", b),
        Value::Number(n) => {
            // Use serde_json's number formatting (already canonical)
            write!(writer, "{}", n)
        }
        Value::String(s) => {
            // Write JSON-escaped string
            write!(writer, "\"{}\"", escape_json_string(s))
        }
        Value::Array(arr) => {
            write!(writer, "[")?;
            for (i, item) in arr.iter().enumerate() {
                if i > 0 {
                    write!(writer, ",")?;
                }
                write_canonical(writer, item)?;
            }
            write!(writer, "]")
        }
        Value::Object(obj) => {
            write_canonical_object(writer, obj)
        }
    }
}

fn write_canonical_object<W: Write>(writer: &mut W, obj: &Map<String, Value>) -> std::io::Result<()> {
    write!(writer, "{{")?;
    
    // Sort keys lexicographically
    let mut keys: Vec<&String> = obj.keys().collect();
    keys.sort();
    
    for (i, key) in keys.iter().enumerate() {
        if i > 0 {
            write!(writer, ",")?;
        }
        
        // Write key
        write!(writer, "\"{}\":", escape_json_string(key))?;
        
        // Write value
        if let Some(value) = obj.get(*key) {
            write_canonical(writer, value)?;
        }
    }
    
    write!(writer, "}}")
}

/// Escape string for JSON (handles quotes, backslashes, control chars)
fn escape_json_string(s: &str) -> String {
    let mut result = String::new();
    
    for ch in s.chars() {
        match ch {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            '\u{0008}' => result.push_str("\\b"),
            '\u{000C}' => result.push_str("\\f"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            c if c.is_control() => {
                // Unicode escape for control characters
                result.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => result.push(c),
        }
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_null() {
        let value = json!(null);
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), "null");
    }
    
    #[test]
    fn test_boolean() {
        let value = json!(true);
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), "true");
    }
    
    #[test]
    fn test_number() {
        let value = json!(42);
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), "42");
        
        let value = json!(3.14159);
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), "3.14159");
    }
    
    #[test]
    fn test_string() {
        let value = json!("hello world");
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), r#""hello world""#);
    }
    
    #[test]
    fn test_string_escaping() {
        let value = json!("hello \"world\"");
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), r#""hello \"world\"""#);
        
        let value = json!("line1\nline2");
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), r#""line1\nline2""#);
    }
    
    #[test]
    fn test_array() {
        let value = json!([1, 2, 3]);
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), "[1,2,3]");
        
        // Array order is preserved
        let value = json!([3, 1, 2]);
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), "[3,1,2]");
    }
    
    #[test]
    fn test_object_key_sorting() {
        let value = json!({
            "z": 1,
            "a": 2,
            "m": 3
        });
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(String::from_utf8(canonical).unwrap(), r#"{"a":2,"m":3,"z":1}"#);
    }
    
    #[test]
    fn test_nested_objects() {
        let value = json!({
            "outer": {
                "z": 1,
                "a": 2
            },
            "array": [3, 2, 1]
        });
        let canonical = canonicalize_json(&value).unwrap();
        assert_eq!(
            String::from_utf8(canonical).unwrap(),
            r#"{"array":[3,2,1],"outer":{"a":2,"z":1}}"#
        );
    }
    
    #[test]
    fn test_no_whitespace() {
        let value = json!({
            "key1": "value1",
            "key2": [1, 2, 3],
            "key3": {
                "nested": true
            }
        });
        let canonical = canonicalize_json(&value).unwrap();
        let canonical_str = String::from_utf8(canonical).unwrap();
        
        // No spaces or newlines
        assert!(!canonical_str.contains(' '));
        assert!(!canonical_str.contains('\n'));
        assert!(!canonical_str.contains('\t'));
    }
    
    #[test]
    fn test_deterministic() {
        // Same content, different key order
        let value1 = json!({
            "b": 2,
            "a": 1,
            "c": 3
        });
        let value2 = json!({
            "c": 3,
            "a": 1,
            "b": 2
        });
        
        let canonical1 = canonicalize_json(&value1).unwrap();
        let canonical2 = canonicalize_json(&value2).unwrap();
        
        assert_eq!(canonical1, canonical2);
    }
}

