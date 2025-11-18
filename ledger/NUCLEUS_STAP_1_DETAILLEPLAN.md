# Nucleus Engine – Stap 1: Project Setup & Basis Types (Gedetailleerd Plan)

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor **Stap 1.1: Project Setup & Basis Types**. Elke sub-stap bevat:
- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

---

## Stap 1.1.1: Workspace Setup

### Waarom
We beginnen met een Rust workspace zodat we meerdere crates kunnen beheren (nucleus-core, nucleus-engine, nucleus-wasm, etc.) in één repository. Dit maakt dependency management en development eenvoudiger.

### Wat
- Maak `nucleus/` directory aan
- Maak `Cargo.toml` workspace configuratie
- Setup basis workspace structuur

### Waar
```
nucleus/
└── Cargo.toml              # Workspace root configuratie
```

### Hoe

**1. Maak directory structuur:**
```bash
mkdir -p nucleus
cd nucleus
```

**2. Maak workspace Cargo.toml (`nucleus/Cargo.toml`):**
```toml
[workspace]
members = [
    "nucleus-core",
    "nucleus-engine",
    "nucleus-wasm",
    "nucleus-server",
]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
authors = ["Onoal Team"]
license = "MIT"
repository = "https://github.com/onoal/nucleus"
description = "Nucleus Engine - Canonical ledger engine"

[workspace.dependencies]
# Shared dependencies across all crates
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
sha2 = "0.10"
hex = "0.4"

[workspace.dev-dependencies]
criterion = "0.5"
```

**3. Verifieer workspace:**
```bash
cargo check
```

**Acceptatie Criteria:**
- ✅ `nucleus/Cargo.toml` bestaat
- ✅ Workspace compileert zonder errors
- ✅ `cargo check` werkt

---

## Stap 1.1.2: nucleus-core Crate Setup

### Waarom
`nucleus-core` is de pure engine crate zonder I/O dependencies. Dit is de fundament waar alles op gebouwd wordt. We beginnen met de basis crate structuur.

### Wat
- Maak `nucleus-core/` directory
- Maak `Cargo.toml` voor nucleus-core
- Maak basis `src/lib.rs`
- Setup basis module structuur

### Waar
```
nucleus-core/
├── Cargo.toml
└── src/
    └── lib.rs              # Public API entry point
```

### Hoe

**1. Maak crate directory:**
```bash
mkdir -p nucleus-core/src
cd nucleus-core
```

**2. Maak Cargo.toml (`nucleus-core/Cargo.toml`):**
```toml
[package]
name = "nucleus-core"
version.workspace = true
edition.workspace = true
authors.workspace = true
license.workspace = true
description = "Nucleus Core - Pure ledger engine (no I/O)"

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
sha2 = { workspace = true }
hex = { workspace = true }

[dev-dependencies]
criterion = { workspace = true }

[lib]
name = "nucleus_core"
path = "src/lib.rs"
```

**3. Maak basis lib.rs (`nucleus-core/src/lib.rs`):**
```rust
//! Nucleus Core - Pure ledger engine
//!
//! This crate contains the canonical ledger engine implementation.
//! It has no I/O dependencies and can run in any environment.

/// Record types and structures
pub mod record;

/// Hash types and utilities
pub mod hash;

/// Anchor types and anchoring logic
pub mod anchor;

/// Error types
pub mod error;

// Re-export commonly used types
pub use record::Record;
pub use hash::Hash;
pub use error::CoreError;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_setup() {
        // Basic smoke test
        assert!(true);
    }
}
```

**4. Verifieer crate:**
```bash
cargo check
cargo test
```

**Acceptatie Criteria:**
- ✅ `nucleus-core/Cargo.toml` bestaat
- ✅ `nucleus-core/src/lib.rs` bestaat
- ✅ Crate compileert zonder errors
- ✅ Tests kunnen draaien

---

## Stap 1.1.3: Hash Type Implementatie

### Waarom
Hash is een fundamenteel type voor de ledger. Het representeert SHA-256 hashes en moet type-safe zijn. We beginnen met Hash omdat het gebruikt wordt door andere types.

### Wat
- Implementeer `Hash` struct
- Implementeer conversie methods (bytes ↔ hex)
- Implementeer `PartialEq`, `Eq`, `Hash` traits
- Schrijf unit tests

### Waar
```
nucleus-core/src/
└── hash.rs                  # Hash type implementatie
```

### Hoe

**1. Maak hash.rs (`nucleus-core/src/hash.rs`):**
```rust
use std::fmt;
use hex;

/// SHA-256 hash (32 bytes)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Hash([u8; 32]);

impl Hash {
    /// Create a Hash from 32 bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }
    
    /// Create a Hash from a byte slice (must be exactly 32 bytes)
    pub fn from_slice(slice: &[u8]) -> Result<Self, HashError> {
        if slice.len() != 32 {
            return Err(HashError::InvalidLength(slice.len()));
        }
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(slice);
        Ok(Self(bytes))
    }
    
    /// Get hash as byte array reference
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
    
    /// Convert hash to hex string
    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }
    
    /// Create hash from hex string
    pub fn from_hex(hex_str: &str) -> Result<Self, HashError> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| HashError::InvalidHex(e.to_string()))?;
        Self::from_slice(&bytes)
    }
    
    /// Zero hash (all zeros)
    pub fn zero() -> Self {
        Self([0u8; 32])
    }
}

impl fmt::Display for Hash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

impl serde::Serialize for Hash {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_hex())
    }
}

impl<'de> serde::Deserialize<'de> for Hash {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let hex_str = String::deserialize(deserializer)?;
        Hash::from_hex(&hex_str)
            .map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum HashError {
    #[error("Invalid hash length: expected 32, got {0}")]
    InvalidLength(usize),
    
    #[error("Invalid hex string: {0}")]
    InvalidHex(String),
}
```

**2. Update lib.rs om hash module te exporteren:**
```rust
pub mod hash;
pub use hash::Hash;
```

**3. Schrijf tests (`nucleus-core/src/hash.rs` - onderaan):**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_from_bytes() {
        let bytes = [1u8; 32];
        let hash = Hash::from_bytes(bytes);
        assert_eq!(hash.as_bytes(), &bytes);
    }

    #[test]
    fn test_hash_from_slice() {
        let bytes = [2u8; 32];
        let hash = Hash::from_slice(&bytes).unwrap();
        assert_eq!(hash.as_bytes(), &bytes);
    }

    #[test]
    fn test_hash_from_slice_invalid_length() {
        let bytes = [3u8; 31]; // Wrong length
        assert!(Hash::from_slice(&bytes).is_err());
    }

    #[test]
    fn test_hash_to_hex() {
        let bytes = [0xABu8; 32];
        let hash = Hash::from_bytes(bytes);
        let hex = hash.to_hex();
        assert_eq!(hex.len(), 64); // 32 bytes = 64 hex chars
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_hash_from_hex() {
        let hex_str = "ab".repeat(32); // 64 chars
        let hash = Hash::from_hex(&hex_str).unwrap();
        assert_eq!(hash.to_hex(), hex_str);
    }

    #[test]
    fn test_hash_equality() {
        let bytes = [5u8; 32];
        let hash1 = Hash::from_bytes(bytes);
        let hash2 = Hash::from_bytes(bytes);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_hash_inequality() {
        let hash1 = Hash::from_bytes([1u8; 32]);
        let hash2 = Hash::from_bytes([2u8; 32]);
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_hash_zero() {
        let zero = Hash::zero();
        assert_eq!(zero.as_bytes(), &[0u8; 32]);
    }

    #[test]
    fn test_hash_serialization() {
        let hash = Hash::from_bytes([0x42u8; 32]);
        let json = serde_json::to_string(&hash).unwrap();
        let deserialized: Hash = serde_json::from_str(&json).unwrap();
        assert_eq!(hash, deserialized);
    }
}
```

**4. Verifieer implementatie:**
```bash
cargo test hash
```

**Acceptatie Criteria:**
- ✅ `Hash` struct is geïmplementeerd
- ✅ Alle conversie methods werken
- ✅ Serialization werkt
- ✅ Alle tests passen

---

## Stap 1.1.4: Record Type Implementatie

### Waarom
Record is het kern type van de ledger. Het representeert een ledger entry met id, stream, timestamp, payload en metadata. Dit is de basis waar alle andere functionaliteit op bouwt.

### Wat
- Implementeer `Record` struct
- Implementeer serialization/deserialization
- Implementeer validation
- Schrijf unit tests

### Waar
```
nucleus-core/src/
└── record.rs                # Record type implementatie
```

### Hoe

**1. Maak record.rs (`nucleus-core/src/record.rs`):**
```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Ledger record - represents a single entry in the ledger
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Record {
    /// Unique identifier for this record
    pub id: String,
    
    /// Stream type (e.g., "proofs", "assets", "consent")
    pub stream: String,
    
    /// Unix timestamp in milliseconds
    pub timestamp: u64,
    
    /// Record payload (JSON value)
    pub payload: Value,
    
    /// Optional metadata
    pub meta: Option<Value>,
}

impl Record {
    /// Create a new record
    pub fn new(
        id: String,
        stream: String,
        timestamp: u64,
        payload: Value,
    ) -> Self {
        Self {
            id,
            stream,
            timestamp,
            payload,
            meta: None,
        }
    }
    
    /// Create a new record with metadata
    pub fn with_meta(
        id: String,
        stream: String,
        timestamp: u64,
        payload: Value,
        meta: Value,
    ) -> Self {
        Self {
            id,
            stream,
            timestamp,
            payload,
            meta: Some(meta),
        }
    }
    
    /// Validate record
    pub fn validate(&self) -> Result<(), RecordError> {
        if self.id.is_empty() {
            return Err(RecordError::InvalidId("ID cannot be empty".to_string()));
        }
        
        if self.stream.is_empty() {
            return Err(RecordError::InvalidStream("Stream cannot be empty".to_string()));
        }
        
        if self.timestamp == 0 {
            return Err(RecordError::InvalidTimestamp("Timestamp cannot be zero".to_string()));
        }
        
        if !self.payload.is_object() && !self.payload.is_array() {
            return Err(RecordError::InvalidPayload("Payload must be object or array".to_string()));
        }
        
        Ok(())
    }
    
    /// Get a reference to a field in the payload
    pub fn get_payload_field(&self, key: &str) -> Option<&Value> {
        self.payload.get(key)
    }
    
    /// Set a field in the payload
    pub fn set_payload_field(&mut self, key: String, value: Value) {
        if let Some(obj) = self.payload.as_object_mut() {
            obj.insert(key, value);
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RecordError {
    #[error("Invalid ID: {0}")]
    InvalidId(String),
    
    #[error("Invalid stream: {0}")]
    InvalidStream(String),
    
    #[error("Invalid timestamp: {0}")]
    InvalidTimestamp(String),
    
    #[error("Invalid payload: {0}")]
    InvalidPayload(String),
}
```

**2. Update lib.rs om record module te exporteren:**
```rust
pub mod record;
pub use record::{Record, RecordError};
```

**3. Schrijf tests (`nucleus-core/src/record.rs` - onderaan):**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_new() {
        let record = Record::new(
            "test-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        
        assert_eq!(record.id, "test-1");
        assert_eq!(record.stream, "proofs");
        assert_eq!(record.timestamp, 1234567890);
        assert_eq!(record.meta, None);
    }

    #[test]
    fn test_record_with_meta() {
        let record = Record::with_meta(
            "test-2".to_string(),
            "assets".to_string(),
            1234567890,
            serde_json::json!({"type": "asset"}),
            serde_json::json!({"source": "api"}),
        );
        
        assert!(record.meta.is_some());
        assert_eq!(record.meta.as_ref().unwrap().get("source").unwrap().as_str(), Some("api"));
    }

    #[test]
    fn test_record_validation_success() {
        let record = Record::new(
            "test-3".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        
        assert!(record.validate().is_ok());
    }

    #[test]
    fn test_record_validation_empty_id() {
        let record = Record::new(
            "".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        
        assert!(record.validate().is_err());
    }

    #[test]
    fn test_record_validation_empty_stream() {
        let record = Record::new(
            "test-4".to_string(),
            "".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        
        assert!(record.validate().is_err());
    }

    #[test]
    fn test_record_validation_zero_timestamp() {
        let record = Record::new(
            "test-5".to_string(),
            "proofs".to_string(),
            0,
            serde_json::json!({"type": "proof"}),
        );
        
        assert!(record.validate().is_err());
    }

    #[test]
    fn test_record_get_payload_field() {
        let record = Record::new(
            "test-6".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof", "subject": "oid:onoal:human:alice"}),
        );
        
        assert_eq!(record.get_payload_field("type").unwrap().as_str(), Some("proof"));
        assert_eq!(record.get_payload_field("subject").unwrap().as_str(), Some("oid:onoal:human:alice"));
        assert!(record.get_payload_field("nonexistent").is_none());
    }

    #[test]
    fn test_record_serialization() {
        let record = Record::new(
            "test-7".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        
        let json = serde_json::to_string(&record).unwrap();
        let deserialized: Record = serde_json::from_str(&json).unwrap();
        
        assert_eq!(record, deserialized);
    }
}
```

**4. Verifieer implementatie:**
```bash
cargo test record
```

**Acceptatie Criteria:**
- ✅ `Record` struct is geïmplementeerd
- ✅ Validation werkt
- ✅ Serialization werkt
- ✅ Alle tests passen

---

## Stap 1.1.5: Error Types Implementatie

### Waarom
Goede error handling is cruciaal. We gebruiken `thiserror` voor ergonomic error types die automatisch kunnen converteren tussen error types. Dit maakt error propagation eenvoudig.

### Wat
- Implementeer `CoreError` enum
- Implementeer error conversion traits
- Schrijf error handling tests

### Waar
```
nucleus-core/src/
└── error.rs                # Error types implementatie
```

### Hoe

**1. Maak error.rs (`nucleus-core/src/error.rs`):**
```rust
use thiserror::Error;

/// Core error type for nucleus-core
#[derive(Debug, Error)]
pub enum CoreError {
    /// Hash computation or validation error
    #[error("Hash error: {0}")]
    Hash(#[from] crate::hash::HashError),
    
    /// Record validation error
    #[error("Record error: {0}")]
    Record(#[from] crate::record::RecordError),
    
    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    /// Invalid record structure
    #[error("Invalid record: {0}")]
    InvalidRecord(String),
    
    /// Chain verification error
    #[error("Chain verification failed: {0}")]
    ChainVerification(String),
    
    /// Module error
    #[error("Module error: {0}")]
    Module(String),
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, CoreError>;
```

**2. Update hash.rs om HashError te exporteren:**
```rust
// In hash.rs, maak HashError pub
pub use HashError; // Al gedaan in vorige stap
```

**3. Update record.rs om RecordError te exporteren:**
```rust
// In record.rs, maak RecordError pub
pub use RecordError; // Al gedaan in vorige stap
```

**4. Update lib.rs om error module te exporteren:**
```rust
pub mod error;
pub use error::{CoreError, Result as CoreResult};
```

**5. Schrijf tests (`nucleus-core/src/error.rs` - onderaan):**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::hash::HashError;
    use crate::record::RecordError;

    #[test]
    fn test_hash_error_conversion() {
        let hash_err = HashError::InvalidLength(31);
        let core_err: CoreError = hash_err.into();
        
        assert!(matches!(core_err, CoreError::Hash(_)));
        assert!(core_err.to_string().contains("Hash error"));
    }

    #[test]
    fn test_record_error_conversion() {
        let record_err = RecordError::InvalidId("test".to_string());
        let core_err: CoreError = record_err.into();
        
        assert!(matches!(core_err, CoreError::Record(_)));
        assert!(core_err.to_string().contains("Record error"));
    }

    #[test]
    fn test_serialization_error_conversion() {
        let invalid_json = "invalid json";
        let serde_err = serde_json::from_str::<serde_json::Value>(invalid_json).unwrap_err();
        let core_err: CoreError = serde_err.into();
        
        assert!(matches!(core_err, CoreError::Serialization(_)));
        assert!(core_err.to_string().contains("Serialization error"));
    }

    #[test]
    fn test_custom_errors() {
        let invalid_record = CoreError::InvalidRecord("test".to_string());
        assert!(invalid_record.to_string().contains("Invalid record"));
        
        let chain_err = CoreError::ChainVerification("test".to_string());
        assert!(chain_err.to_string().contains("Chain verification failed"));
        
        let module_err = CoreError::Module("test".to_string());
        assert!(module_err.to_string().contains("Module error"));
    }
}
```

**6. Verifieer implementatie:**
```bash
cargo test error
```

**Acceptatie Criteria:**
- ✅ `CoreError` enum is geïmplementeerd
- ✅ Error conversion werkt (via `#[from]`)
- ✅ Alle tests passen
- ✅ Error messages zijn informatief

---

## Stap 1.1.6: Anchor Type (Basis)

### Waarom
Anchors zijn checkpoints in de chain voor verificatie. We beginnen met een basis Anchor type dat later uitgebreid kan worden.

### Wat
- Implementeer `Anchor` struct
- Implementeer basis anchoring logic
- Schrijf unit tests

### Waar
```
nucleus-core/src/
└── anchor.rs                # Anchor type implementatie
```

### Hoe

**1. Maak anchor.rs (`nucleus-core/src/anchor.rs`):**
```rust
use crate::{Hash, Record};
use serde::{Deserialize, Serialize};

/// Anchor - a checkpoint in the chain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Anchor {
    /// Anchor identifier
    pub id: String,
    
    /// Hash of the latest entry at anchor point
    pub hash: Hash,
    
    /// Timestamp when anchor was created
    pub timestamp: u64,
    
    /// Number of entries up to this anchor
    pub entry_count: u64,
}

impl Anchor {
    /// Create a new anchor
    pub fn new(
        id: String,
        hash: Hash,
        timestamp: u64,
        entry_count: u64,
    ) -> Self {
        Self {
            id,
            hash,
            timestamp,
            entry_count,
        }
    }
    
    /// Validate anchor
    pub fn validate(&self) -> Result<(), AnchorError> {
        if self.id.is_empty() {
            return Err(AnchorError::InvalidId("ID cannot be empty".to_string()));
        }
        
        if self.timestamp == 0 {
            return Err(AnchorError::InvalidTimestamp("Timestamp cannot be zero".to_string()));
        }
        
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AnchorError {
    #[error("Invalid anchor ID: {0}")]
    InvalidId(String),
    
    #[error("Invalid timestamp: {0}")]
    InvalidTimestamp(String),
}
```

**2. Update lib.rs om anchor module te exporteren:**
```rust
pub mod anchor;
pub use anchor::{Anchor, AnchorError};
```

**3. Update error.rs om AnchorError te ondersteunen:**
```rust
// In error.rs, voeg toe:
/// Anchor error
#[error("Anchor error: {0}")]
Anchor(#[from] crate::anchor::AnchorError),
```

**4. Schrijf tests (`nucleus-core/src/anchor.rs` - onderaan):**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anchor_new() {
        let hash = Hash::from_bytes([1u8; 32]);
        let anchor = Anchor::new(
            "anchor-1".to_string(),
            hash,
            1234567890,
            100,
        );
        
        assert_eq!(anchor.id, "anchor-1");
        assert_eq!(anchor.hash, hash);
        assert_eq!(anchor.timestamp, 1234567890);
        assert_eq!(anchor.entry_count, 100);
    }

    #[test]
    fn test_anchor_validation_success() {
        let hash = Hash::from_bytes([2u8; 32]);
        let anchor = Anchor::new(
            "anchor-2".to_string(),
            hash,
            1234567890,
            200,
        );
        
        assert!(anchor.validate().is_ok());
    }

    #[test]
    fn test_anchor_validation_empty_id() {
        let hash = Hash::from_bytes([3u8; 32]);
        let anchor = Anchor::new(
            "".to_string(),
            hash,
            1234567890,
            300,
        );
        
        assert!(anchor.validate().is_err());
    }

    #[test]
    fn test_anchor_validation_zero_timestamp() {
        let hash = Hash::from_bytes([4u8; 32]);
        let anchor = Anchor::new(
            "anchor-3".to_string(),
            hash,
            0,
            400,
        );
        
        assert!(anchor.validate().is_err());
    }

    #[test]
    fn test_anchor_serialization() {
        let hash = Hash::from_bytes([5u8; 32]);
        let anchor = Anchor::new(
            "anchor-4".to_string(),
            hash,
            1234567890,
            500,
        );
        
        let json = serde_json::to_string(&anchor).unwrap();
        let deserialized: Anchor = serde_json::from_str(&json).unwrap();
        
        assert_eq!(anchor, deserialized);
    }
}
```

**5. Verifieer implementatie:**
```bash
cargo test anchor
```

**Acceptatie Criteria:**
- ✅ `Anchor` struct is geïmplementeerd
- ✅ Validation werkt
- ✅ Serialization werkt
- ✅ Alle tests passen

---

## Stap 1.1.7: Integration Test Setup

### Waarom
Integration tests verifiëren dat alle componenten samenwerken. We beginnen met een basis integration test setup.

### Wat
- Maak `tests/` directory
- Schrijf eerste integration test
- Verifieer dat alles samenwerkt

### Waar
```
nucleus-core/
└── tests/
    └── integration.rs       # Integration tests
```

### Hoe

**1. Maak tests directory:**
```bash
mkdir -p nucleus-core/tests
```

**2. Maak integration test (`nucleus-core/tests/integration.rs`):**
```rust
use nucleus_core::{Record, Hash, Anchor, CoreError};

#[test]
fn test_record_hash_integration() {
    // Create a record
    let record = Record::new(
        "test-integration-1".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({"type": "proof", "subject": "oid:onoal:human:alice"}),
    );
    
    // Validate record
    assert!(record.validate().is_ok());
    
    // Verify record fields
    assert_eq!(record.id, "test-integration-1");
    assert_eq!(record.stream, "proofs");
    assert!(record.get_payload_field("subject").is_some());
}

#[test]
fn test_hash_record_integration() {
    // Create a record
    let record = Record::new(
        "test-integration-2".to_string(),
        "assets".to_string(),
        1234567890,
        serde_json::json!({"type": "asset", "owner": "oid:onoal:human:bob"}),
    );
    
    // Create anchor with hash
    let hash = Hash::from_bytes([0x42u8; 32]);
    let anchor = Anchor::new(
        "anchor-integration-1".to_string(),
        hash,
        1234567890,
        1,
    );
    
    // Validate both
    assert!(record.validate().is_ok());
    assert!(anchor.validate().is_ok());
    
    // Verify anchor references hash
    assert_eq!(anchor.hash, hash);
}

#[test]
fn test_serialization_roundtrip() {
    // Create record
    let original = Record::new(
        "test-integration-3".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({"type": "proof"}),
    );
    
    // Serialize
    let json = serde_json::to_string(&original).unwrap();
    
    // Deserialize
    let deserialized: Record = serde_json::from_str(&json).unwrap();
    
    // Verify equality
    assert_eq!(original, deserialized);
}
```

**3. Verifieer tests:**
```bash
cargo test --test integration
```

**Acceptatie Criteria:**
- ✅ Integration tests directory bestaat
- ✅ Eerste integration test werkt
- ✅ Alle componenten werken samen
- ✅ Tests passen

---

## Stap 1.1.8: Documentation & README

### Waarom
Goede documentatie helpt developers om de code te begrijpen en te gebruiken. We beginnen met basis documentatie.

### Wat
- Schrijf README voor nucleus-core
- Documenteer public API
- Voeg usage voorbeelden toe

### Waar
```
nucleus-core/
├── README.md                # Crate documentation
└── src/
    └── lib.rs              # API documentation (doc comments)
```

### Hoe

**1. Maak README.md (`nucleus-core/README.md`):**
```markdown
# nucleus-core

Pure ledger engine implementation - no I/O dependencies.

## Overview

`nucleus-core` is the canonical ledger engine. It contains:

- **Record** - Ledger entry type
- **Hash** - SHA-256 hash type
- **Anchor** - Chain checkpoint type
- **Error types** - Comprehensive error handling

## Usage

```rust
use nucleus_core::{Record, Hash, Anchor};

// Create a record
let record = Record::new(
    "record-1".to_string(),
    "proofs".to_string(),
    1234567890,
    serde_json::json!({"type": "proof"}),
);

// Validate
record.validate().unwrap();

// Create hash
let hash = Hash::from_bytes([0u8; 32]);

// Create anchor
let anchor = Anchor::new(
    "anchor-1".to_string(),
    hash,
    1234567890,
    1,
);
```

## Architecture

This crate has no I/O dependencies and can run in any environment:
- WebAssembly
- Embedded systems
- Server environments

## License

MIT
```

**2. Voeg doc comments toe aan lib.rs:**
```rust
//! Nucleus Core - Pure ledger engine
//!
//! This crate contains the canonical ledger engine implementation.
//! It has no I/O dependencies and can run in any environment.
//!
//! # Example
//!
//! ```rust
//! use nucleus_core::{Record, Hash};
//!
//! let record = Record::new(
//!     "record-1".to_string(),
//!     "proofs".to_string(),
//!     1234567890,
//!     serde_json::json!({"type": "proof"}),
//! );
//!
//! record.validate().unwrap();
//! ```

// ... rest of code
```

**3. Verifieer documentatie:**
```bash
cargo doc --open
```

**Acceptatie Criteria:**
- ✅ README.md bestaat
- ✅ API documentation is compleet
- ✅ Usage voorbeelden werken
- ✅ `cargo doc` genereert documentatie

---

## Samenvatting Stap 1.1

### Voltooide Componenten

✅ **Workspace Setup**
- Rust workspace geconfigureerd
- Basis crate structuur

✅ **Hash Type**
- Type-safe hash implementatie
- Hex conversion
- Serialization

✅ **Record Type**
- Complete record struct
- Validation
- Payload manipulation

✅ **Error Types**
- Comprehensive error handling
- Error conversion
- Type-safe errors

✅ **Anchor Type**
- Basis anchor implementatie
- Validation

✅ **Integration Tests**
- Test setup
- Component integration

✅ **Documentation**
- README
- API docs

### Volgende Stap

Na voltooiing van Stap 1.1 kunnen we doorgaan naar:
- **Stap 1.2: Canonical Serialization** - Deterministic JSON serialization voor hash computation

---

*Gedetailleerd Plan voor Stap 1.1 - Project Setup & Basis Types*

