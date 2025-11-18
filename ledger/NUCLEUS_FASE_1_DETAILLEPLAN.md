# Nucleus Engine – Fase 1: nucleus-core (Gedetailleerd Plan)

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor **Fase 1: nucleus-core – Pure Engine (Week 1-4)**. Elke stap bevat:

- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

---

## Stap 1.1: Project Setup & Basis Types

### Stap 1.1.1: Workspace Setup

#### Waarom

We beginnen met een Rust workspace zodat we meerdere crates kunnen beheren (nucleus-core, nucleus-engine, nucleus-wasm, etc.) in één repository. Dit maakt dependency management en development eenvoudiger.

#### Wat

- Maak `nucleus/` directory aan
- Maak `Cargo.toml` workspace configuratie
- Setup basis workspace structuur

#### Waar

```
nucleus/
└── Cargo.toml              # Workspace root configuratie
```

#### Hoe

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

### Stap 1.1.2: nucleus-core Crate Setup

#### Waarom

`nucleus-core` is de pure engine crate zonder I/O dependencies. Dit is de fundament waar alles op gebouwd wordt. We beginnen met de basis crate structuur.

#### Wat

- Maak `nucleus-core/` directory
- Maak `Cargo.toml` voor nucleus-core
- Maak basis `src/lib.rs`
- Setup basis module structuur

#### Waar

```
nucleus-core/
├── Cargo.toml
└── src/
    └── lib.rs              # Public API entry point
```

#### Hoe

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

### Stap 1.1.3: Hash Type Implementatie

#### Waarom

Hash is een fundamenteel type voor de ledger. Het representeert SHA-256 hashes en moet type-safe zijn. We beginnen met Hash omdat het gebruikt wordt door andere types.

#### Wat

- Implementeer `Hash` struct
- Implementeer conversie methods (bytes ↔ hex)
- Implementeer `PartialEq`, `Eq`, `Hash` traits
- Schrijf unit tests

#### Waar

```
nucleus-core/src/
└── hash.rs                  # Hash type implementatie
```

#### Hoe

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
    fn test_hash_to_hex() {
        let bytes = [0xABu8; 32];
        let hash = Hash::from_bytes(bytes);
        let hex = hash.to_hex();
        assert_eq!(hex.len(), 64); // 32 bytes = 64 hex chars
    }

    #[test]
    fn test_hash_from_hex() {
        let hex_str = "ab".repeat(32); // 64 chars
        let hash = Hash::from_hex(&hex_str).unwrap();
        assert_eq!(hash.to_hex(), hex_str);
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

**2. Update lib.rs om hash module te exporteren:**

```rust
pub mod hash;
pub use hash::{Hash, HashError};
```

**3. Verifieer implementatie:**

```bash
cargo test hash
```

**Acceptatie Criteria:**

- ✅ `Hash` struct is geïmplementeerd
- ✅ Alle conversie methods werken
- ✅ Serialization werkt
- ✅ Alle tests passen

---

### Stap 1.1.4: Record Type Implementatie

#### Waarom

Record is het kern type van de ledger. Het representeert een ledger entry met id, stream, timestamp, payload en metadata. Dit is de basis waar alle andere functionaliteit op bouwt.

#### Wat

- Implementeer `Record` struct
- Implementeer serialization/deserialization
- Implementeer validation
- Schrijf unit tests

#### Waar

```
nucleus-core/src/
└── record.rs                # Record type implementatie
```

#### Hoe

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

**2. Update lib.rs om record module te exporteren:**

```rust
pub mod record;
pub use record::{Record, RecordError};
```

**3. Verifieer implementatie:**

```bash
cargo test record
```

**Acceptatie Criteria:**

- ✅ `Record` struct is geïmplementeerd
- ✅ Validation werkt
- ✅ Serialization werkt
- ✅ Alle tests passen

---

### Stap 1.1.5: Error Types Implementatie

#### Waarom

Goede error handling is cruciaal. We gebruiken `thiserror` voor ergonomic error types die automatisch kunnen converteren tussen error types. Dit maakt error propagation eenvoudig.

#### Wat

- Implementeer `CoreError` enum
- Implementeer error conversion traits
- Schrijf error handling tests

#### Waar

```
nucleus-core/src/
└── error.rs                # Error types implementatie
```

#### Hoe

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

**2. Update lib.rs om error module te exporteren:**

```rust
pub mod error;
pub use error::{CoreError, Result as CoreResult};
```

**3. Verifieer implementatie:**

```bash
cargo test error
```

**Acceptatie Criteria:**

- ✅ `CoreError` enum is geïmplementeerd
- ✅ Error conversion werkt (via `#[from]`)
- ✅ Alle tests passen

---

### Stap 1.1.6: Anchor Type (Basis)

#### Waarom

Anchors zijn checkpoints in de chain voor verificatie. We beginnen met een basis Anchor type dat later uitgebreid kan worden.

#### Wat

- Implementeer `Anchor` struct
- Implementeer basis anchoring logic
- Schrijf unit tests

#### Waar

```
nucleus-core/src/
└── anchor.rs                # Anchor type implementatie
```

#### Hoe

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
}
```

**2. Update lib.rs om anchor module te exporteren:**

```rust
pub mod anchor;
pub use anchor::{Anchor, AnchorError};
```

**3. Verifieer implementatie:**

```bash
cargo test anchor
```

**Acceptatie Criteria:**

- ✅ `Anchor` struct is geïmplementeerd
- ✅ Validation werkt
- ✅ Serialization werkt
- ✅ Alle tests passen

---

## Stap 1.2: Canonical Serialization

### Stap 1.2.1: Serialization Module Setup

#### Waarom

Voor hash computation en verificatie moeten records altijd op dezelfde manier geserialiseerd worden. Canonical JSON zorgt voor deterministische serialization. We beginnen met de module structuur.

#### Wat

- Maak `serialization/` module directory
- Maak `mod.rs` en `canonical.rs`
- Setup basis structuur

#### Waar

```
nucleus-core/src/
└── serialization/
    ├── mod.rs              # Public API
    └── canonical.rs        # Canonical JSON implementation
```

#### Hoe

**1. Maak directory:**

```bash
mkdir -p nucleus-core/src/serialization
```

**2. Maak mod.rs (`nucleus-core/src/serialization/mod.rs`):**

```rust
/// Canonical serialization for deterministic hashing
pub mod canonical;

pub use canonical::{serialize_canonical, compute_hash};
```

**3. Maak canonical.rs (`nucleus-core/src/serialization/canonical.rs`):**

```rust
use crate::{Record, Hash, CoreError};
use serde_json::{Value, Map};

/// Serialize record to canonical JSON form
///
/// Canonical form ensures:
/// - Keys sorted alphabetically
/// - No whitespace
/// - Deterministic ordering
/// - Consistent field order
pub fn serialize_canonical(record: &Record) -> Result<Vec<u8>, serde_json::Error> {
    let mut canonical = Map::new();

    // Add fields in canonical order (alphabetically)
    canonical.insert("id".to_string(), Value::String(record.id.clone()));
    canonical.insert("stream".to_string(), Value::String(record.stream.clone()));
    canonical.insert("timestamp".to_string(), Value::Number(record.timestamp.into()));
    canonical.insert("payload".to_string(), record.payload.clone());

    // Only include meta if present
    if let Some(ref meta) = record.meta {
        canonical.insert("meta".to_string(), meta.clone());
    }

    // Serialize with no whitespace (compact)
    serde_json::to_vec(&canonical)
}

/// Compute hash of canonical serialization
pub fn compute_hash(record: &Record) -> Result<Hash, CoreError> {
    use sha2::{Sha256, Digest};

    let canonical = serialize_canonical(record)?;
    let mut hasher = Sha256::new();
    hasher.update(&canonical);
    let hash_bytes = hasher.finalize();

    let mut hash_array = [0u8; 32];
    hash_array.copy_from_slice(&hash_bytes);

    Ok(Hash::from_bytes(hash_array))
}
```

**4. Update lib.rs om serialization module te exporteren:**

```rust
pub mod serialization;
pub use serialization::{serialize_canonical, compute_hash};
```

**5. Verifieer:**

```bash
cargo check
```

**Acceptatie Criteria:**

- ✅ Serialization module bestaat
- ✅ Basis functies zijn gedefinieerd
- ✅ Code compileert

---

### Stap 1.2.2: Canonical Serialization Tests

#### Waarom

We moeten verifiëren dat canonical serialization deterministisch is en altijd hetzelfde resultaat geeft voor hetzelfde record.

#### Wat

- Schrijf test vectors voor serialization
- Test determinisme
- Test hash computation

#### Waar

```
nucleus-core/src/
└── serialization/
    └── canonical.rs        # Tests onderaan het bestand
```

#### Hoe

**1. Voeg tests toe aan canonical.rs:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::Record;

    #[test]
    fn test_canonical_serialization_deterministic() {
        let record = Record::new(
            "test-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof", "subject": "oid:onoal:human:alice"}),
        );

        let serialized1 = serialize_canonical(&record).unwrap();
        let serialized2 = serialize_canonical(&record).unwrap();

        // Should be identical
        assert_eq!(serialized1, serialized2);
    }

    #[test]
    fn test_canonical_serialization_field_order() {
        // Even if fields are in different order in JSON, canonical should be same
        let record1 = Record::new(
            "test-2".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof", "subject": "oid:onoal:human:alice"}),
        );

        // Same record, different JSON structure
        let record2 = Record::new(
            "test-2".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"subject": "oid:onoal:human:alice", "type": "proof"}),
        );

        let hash1 = compute_hash(&record1).unwrap();
        let hash2 = compute_hash(&record2).unwrap();

        // Hashes should be different because payload structure is different
        // (canonical form preserves payload structure)
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_compute_hash_deterministic() {
        let record = Record::new(
            "test-3".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let hash1 = compute_hash(&record).unwrap();
        let hash2 = compute_hash(&record).unwrap();

        // Should be identical
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_compute_hash_different_records() {
        let record1 = Record::new(
            "test-4".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let record2 = Record::new(
            "test-5".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let hash1 = compute_hash(&record1).unwrap();
        let hash2 = compute_hash(&record2).unwrap();

        // Different IDs should produce different hashes
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_canonical_with_meta() {
        let record = Record::with_meta(
            "test-6".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
            serde_json::json!({"source": "api"}),
        );

        let hash_with_meta = compute_hash(&record).unwrap();

        let record_no_meta = Record::new(
            "test-6".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let hash_no_meta = compute_hash(&record_no_meta).unwrap();

        // Meta should affect hash
        assert_ne!(hash_with_meta, hash_no_meta);
    }

    #[test]
    fn test_canonical_serialization_format() {
        let record = Record::new(
            "test-7".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let serialized = serialize_canonical(&record).unwrap();
        let json_str = String::from_utf8(serialized.clone()).unwrap();

        // Should be valid JSON
        let parsed: Value = serde_json::from_str(&json_str).unwrap();
        assert!(parsed.is_object());

        // Should contain required fields
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("stream").is_some());
        assert!(parsed.get("timestamp").is_some());
        assert!(parsed.get("payload").is_some());
    }
}
```

**2. Verifieer tests:**

```bash
cargo test serialization
```

**Acceptatie Criteria:**

- ✅ Alle serialization tests passen
- ✅ Determinisme is geverifieerd
- ✅ Hash computation werkt correct

---

## Stap 1.3: Hash Chain Implementation

### Stap 1.3.1: ChainEntry Type

#### Waarom

Een ChainEntry linkt een Record aan de vorige entry via `prev_hash`. Dit is de basis voor chain verificatie.

#### Wat

- Implementeer `ChainEntry` struct
- Implementeer prev_hash linking
- Schrijf unit tests

#### Waar

```
nucleus-core/src/
└── hash_chain.rs           # Hash chain implementation
```

#### Hoe

**1. Maak hash_chain.rs (`nucleus-core/src/hash_chain.rs`):**

```rust
use crate::{Record, Hash, CoreError};
use crate::serialization::compute_hash;

/// Chain entry - a record with its hash and previous hash link
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChainEntry {
    /// The record
    pub record: Record,

    /// Hash of this entry
    pub hash: Hash,

    /// Hash of previous entry (None for genesis)
    pub prev_hash: Option<Hash>,
}

impl ChainEntry {
    /// Create a new chain entry
    pub fn new(record: Record, prev_hash: Option<Hash>) -> Result<Self, CoreError> {
        // Validate record first
        record.validate()?;

        // Compute hash
        let hash = compute_hash(&record)?;

        Ok(Self {
            record,
            hash,
            prev_hash,
        })
    }

    /// Create a genesis entry (first in chain)
    pub fn genesis(record: Record) -> Result<Self, CoreError> {
        Self::new(record, None)
    }

    /// Verify this entry's hash matches computed hash
    pub fn verify_hash(&self) -> Result<(), ChainError> {
        let computed = compute_hash(&self.record)?;
        if computed != self.hash {
            return Err(ChainError::HashMismatch {
                entry_id: self.record.id.clone(),
                expected: computed,
                actual: self.hash,
            });
        }
        Ok(())
    }
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum ChainError {
    #[error("Hash mismatch for entry {entry_id}: expected {expected}, got {actual}")]
    HashMismatch {
        entry_id: String,
        expected: Hash,
        actual: Hash,
    },

    #[error("Chain link broken at entry {entry_id}")]
    ChainLinkBroken {
        entry_id: String,
    },

    #[error("Timestamp out of order at entry {entry_id}")]
    TimestampOutOfOrder {
        entry_id: String,
    },

    #[error("Core error: {0}")]
    Core(#[from] CoreError),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_entry_new() {
        let record = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let entry = ChainEntry::new(record.clone(), None).unwrap();

        assert_eq!(entry.record.id, "entry-1");
        assert!(entry.prev_hash.is_none());
    }

    #[test]
    fn test_chain_entry_genesis() {
        let record = Record::new(
            "genesis-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let entry = ChainEntry::genesis(record).unwrap();

        assert!(entry.prev_hash.is_none());
    }

    #[test]
    fn test_chain_entry_with_prev_hash() {
        let prev_hash = Hash::from_bytes([1u8; 32]);
        let record = Record::new(
            "entry-2".to_string(),
            "proofs".to_string(),
            1234567891,
            serde_json::json!({"type": "proof"}),
        );

        let entry = ChainEntry::new(record, Some(prev_hash)).unwrap();

        assert_eq!(entry.prev_hash, Some(Hash::from_bytes([1u8; 32])));
    }

    #[test]
    fn test_chain_entry_verify_hash() {
        let record = Record::new(
            "entry-3".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let entry = ChainEntry::new(record, None).unwrap();

        // Should verify successfully
        assert!(entry.verify_hash().is_ok());
    }
}
```

**2. Update lib.rs:**

```rust
pub mod hash_chain;
pub use hash_chain::{ChainEntry, ChainError};
```

**3. Verifieer:**

```bash
cargo test hash_chain
```

**Acceptatie Criteria:**

- ✅ `ChainEntry` struct is geïmplementeerd
- ✅ Hash computation werkt
- ✅ Tests passen

---

### Stap 1.3.2: Chain Verification Logic

#### Waarom

Chain verification controleert of alle entries correct gelinkt zijn en of hashes kloppen. Dit is cruciaal voor integriteit.

#### Wat

- Implementeer `verify_chain()` functie
- Implementeer verificatie van hash, chain links, timestamps
- Schrijf uitgebreide tests

#### Waar

```
nucleus-core/src/
└── hash_chain.rs           # Chain verification logic
```

#### Hoe

**1. Voeg verification toe aan hash_chain.rs:**

```rust
/// Chain verification result
#[derive(Debug, Clone)]
pub struct ChainVerificationResult {
    /// Whether the chain is valid
    pub valid: bool,

    /// Number of entries checked
    pub entries_checked: usize,

    /// List of errors found
    pub errors: Vec<ChainError>,

    /// Statistics
    pub hash_mismatches: usize,
    pub chain_link_errors: usize,
    pub timestamp_errors: usize,
}

impl ChainVerificationResult {
    pub fn new() -> Self {
        Self {
            valid: true,
            entries_checked: 0,
            errors: Vec::new(),
            hash_mismatches: 0,
            chain_link_errors: 0,
            timestamp_errors: 0,
        }
    }
}

/// Verify chain integrity
pub fn verify_chain(entries: &[ChainEntry]) -> ChainVerificationResult {
    let mut result = ChainVerificationResult::new();
    result.entries_checked = entries.len();

    if entries.is_empty() {
        return result;
    }

    let mut prev_hash: Option<Hash> = None;

    for (idx, entry) in entries.iter().enumerate() {
        // 1. Verify hash matches computed hash
        if let Err(e) = entry.verify_hash() {
            result.valid = false;
            result.hash_mismatches += 1;
            result.errors.push(e);
            continue; // Continue checking other entries
        }

        // 2. Verify chain link
        if let Some(ref prev) = prev_hash {
            if entry.prev_hash.as_ref() != Some(prev) {
                result.valid = false;
                result.chain_link_errors += 1;
                result.errors.push(ChainError::ChainLinkBroken {
                    entry_id: entry.record.id.clone(),
                });
            }
        } else {
            // First entry should not have prev_hash (or it's genesis)
            // This is OK
        }

        // 3. Verify timestamp ordering
        if idx > 0 {
            let prev_timestamp = entries[idx - 1].record.timestamp;
            if entry.record.timestamp < prev_timestamp {
                result.valid = false;
                result.timestamp_errors += 1;
                result.errors.push(ChainError::TimestampOutOfOrder {
                    entry_id: entry.record.id.clone(),
                });
            }
        }

        prev_hash = Some(entry.hash);
    }

    result
}

#[cfg(test)]
mod verification_tests {
    use super::*;

    #[test]
    fn test_verify_chain_valid() {
        let mut entries = Vec::new();
        let mut prev_hash = None;

        for i in 0..5 {
            let record = Record::new(
                format!("entry-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({"index": i}),
            );

            let entry = ChainEntry::new(record, prev_hash).unwrap();
            prev_hash = Some(entry.hash);
            entries.push(entry);
        }

        let result = verify_chain(&entries);

        assert!(result.valid);
        assert_eq!(result.entries_checked, 5);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_verify_chain_hash_mismatch() {
        let record = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );

        let mut entry = ChainEntry::new(record, None).unwrap();
        // Corrupt the hash
        entry.hash = Hash::from_bytes([0xFFu8; 32]);

        let result = verify_chain(&[entry]);

        assert!(!result.valid);
        assert_eq!(result.hash_mismatches, 1);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_verify_chain_link_broken() {
        let entry1 = ChainEntry::genesis(
            Record::new(
                "entry-1".to_string(),
                "proofs".to_string(),
                1000,
                serde_json::json!({"type": "proof"}),
            )
        ).unwrap();

        let entry2 = ChainEntry::new(
            Record::new(
                "entry-2".to_string(),
                "proofs".to_string(),
                2000,
                serde_json::json!({"type": "proof"}),
            ),
            Some(Hash::from_bytes([0x99u8; 32])), // Wrong prev_hash
        ).unwrap();

        let result = verify_chain(&[entry1, entry2]);

        assert!(!result.valid);
        assert_eq!(result.chain_link_errors, 1);
    }

    #[test]
    fn test_verify_chain_timestamp_out_of_order() {
        let entry1 = ChainEntry::genesis(
            Record::new(
                "entry-1".to_string(),
                "proofs".to_string(),
                2000, // Later timestamp
                serde_json::json!({"type": "proof"}),
            )
        ).unwrap();

        let entry2 = ChainEntry::new(
            Record::new(
                "entry-2".to_string(),
                "proofs".to_string(),
                1000, // Earlier timestamp (wrong!)
                serde_json::json!({"type": "proof"}),
            ),
            Some(entry1.hash),
        ).unwrap();

        let result = verify_chain(&[entry1, entry2]);

        assert!(!result.valid);
        assert_eq!(result.timestamp_errors, 1);
    }
}
```

**2. Verifieer:**

```bash
cargo test hash_chain
```

**Acceptatie Criteria:**

- ✅ Chain verification werkt
- ✅ Alle error types worden gedetecteerd
- ✅ Tests passen

---

## Stap 1.4: Module System – Trait Definition

### Stap 1.4.1: Module Trait

#### Waarom

Modules zijn de extensibility mechanisme. We definiëren eerst de trait, dan implementaties. Dit maakt het mogelijk om custom modules te maken.

#### Wat

- Implementeer `Module` trait
- Definieer module lifecycle methods
- Schrijf trait tests

#### Waar

```
nucleus-core/src/
└── module/
    ├── mod.rs              # Public API
    └── trait.rs            # Module trait
```

#### Hoe

**1. Maak module directory:**

```bash
mkdir -p nucleus-core/src/module
```

**2. Maak trait.rs (`nucleus-core/src/module/trait.rs`):**

```rust
use crate::{Record, Hash, CoreError};
use serde_json::Value;

/// Module trait - extensibility mechanism for ledger
pub trait Module: Send + Sync {
    /// Module identifier
    fn id(&self) -> &str;

    /// Module version
    fn version(&self) -> &str;

    /// Process record before append
    /// Can modify record or return error to prevent append
    fn before_append(&self, record: &mut Record) -> Result<(), CoreError>;

    /// Process record after append
    /// Can perform side effects (logging, notifications, etc.)
    fn after_append(&self, record: &Record, hash: &Hash) -> Result<(), CoreError>;

    /// Validate record
    /// Should return error if record is invalid for this module
    fn validate(&self, record: &Record) -> Result<(), CoreError>;

    /// Query records (module-specific filtering)
    /// Returns filtered list of records
    fn query(&self, records: &[Record], filters: &Value) -> Vec<&Record>;
}
```

**3. Maak mod.rs (`nucleus-core/src/module/mod.rs`):**

```rust
pub mod trait;
pub mod config;

pub use trait::Module;
pub use config::ModuleConfig;
```

**4. Maak config.rs (`nucleus-core/src/module/config.rs`):**

```rust
use serde::{Deserialize, Serialize};

/// Module configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModuleConfig {
    /// Module identifier
    pub id: String,

    /// Module version
    pub version: String,

    /// Module-specific configuration (JSON)
    pub config: serde_json::Value,
}

impl ModuleConfig {
    pub fn new(id: String, version: String, config: serde_json::Value) -> Self {
        Self {
            id,
            version,
            config,
        }
    }
}
```

**5. Update lib.rs:**

```rust
pub mod module;
pub use module::{Module, ModuleConfig};
```

**6. Verifieer:**

```bash
cargo check
```

**Acceptatie Criteria:**

- ✅ Module trait is gedefinieerd
- ✅ ModuleConfig type is gedefinieerd
- ✅ Code compileert

---

## Stap 1.5: Proof Module Implementation

### Stap 1.5.1: Proof Module Struct

#### Waarom

Proof module is een basis module die we nodig hebben. Het demonstreert hoe modules werken en biedt proof-specific functionaliteit.

#### Wat

- Implementeer `ProofModule` struct
- Implementeer `Module` trait voor ProofModule
- Schrijf unit tests

#### Waar

```
nucleus-core/src/module/
└── proof.rs                # Proof module implementation
```

#### Hoe

**1. Maak proof.rs (`nucleus-core/src/module/proof.rs`):**

```rust
use crate::{Record, Hash, CoreError};
use crate::module::{Module, ModuleConfig};
use serde_json::Value;

/// Proof module - handles proof records
pub struct ProofModule {
    config: ModuleConfig,
}

impl ProofModule {
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
        // Validate proof-specific fields
        if record.stream != "proofs" {
            return Err(CoreError::InvalidRecord(
                format!("Proof module only handles 'proofs' stream, got '{}'", record.stream)
            ));
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

    fn query(&self, records: &[Record], filters: &Value) -> Vec<&Record> {
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
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );

        assert!(module.validate(&record).is_ok());
    }

    #[test]
    fn test_proof_module_validate_wrong_stream() {
        let config = ModuleConfig::new(
            "proof".to_string(),
            "1.0.0".to_string(),
            serde_json::json!({}),
        );
        let module = ProofModule::new(config);

        let record = Record::new(
            "proof-1".to_string(),
            "assets".to_string(), // Wrong stream
            1234567890,
            serde_json::json!({
                "subject_oid": "oid:onoal:human:alice",
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
                "subject_oid": "oid:onoal:human:alice",
            }),
        );

        let record2 = Record::new(
            "proof-2".to_string(),
            "proofs".to_string(),
            1234567891,
            serde_json::json!({
                "subject_oid": "oid:onoal:human:bob",
            }),
        );

        let records = vec![record1, record2];
        let filters = serde_json::json!({
            "subject_oid": "oid:onoal:human:alice"
        });

        let results = module.query(&records, &filters);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "proof-1");
    }
}
```

**2. Update module/mod.rs:**

```rust
pub mod proof;
pub use proof::ProofModule;
```

**3. Verifieer:**

```bash
cargo test proof
```

**Acceptatie Criteria:**

- ✅ ProofModule implementeert Module trait
- ✅ Validation werkt
- ✅ Query filtering werkt
- ✅ Tests passen

---

## Stap 1.6: Asset Module Implementation

### Stap 1.6.1: Asset Module Struct

#### Waarom

Asset module is een tweede basis module die ownership en state management demonstreert. Het toont hoe verschillende modules verschillende functionaliteit bieden.

#### Wat

- Implementeer `AssetModule` struct
- Implementeer `Module` trait voor AssetModule
- Schrijf unit tests

#### Waar

```
nucleus-core/src/module/
└── asset.rs                # Asset module implementation
```

#### Hoe

**1. Maak asset.rs (`nucleus-core/src/module/asset.rs`):**

```rust
use crate::{Record, Hash, CoreError};
use crate::module::{Module, ModuleConfig};
use serde_json::Value;

/// Asset module - handles asset records
pub struct AssetModule {
    config: ModuleConfig,
}

impl AssetModule {
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
        if record.stream != "assets" {
            return Err(CoreError::InvalidRecord(
                format!("Asset module only handles 'assets' stream, got '{}'", record.stream)
            ));
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

    fn query(&self, records: &[Record], filters: &Value) -> Vec<&Record> {
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
                "owner_oid": "oid:onoal:human:alice",
                "type": "ticket",
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
                "owner_oid": "oid:onoal:human:alice",
            }),
        );

        let record2 = Record::new(
            "asset-2".to_string(),
            "assets".to_string(),
            1234567891,
            serde_json::json!({
                "owner_oid": "oid:onoal:human:bob",
            }),
        );

        let records = vec![record1, record2];
        let filters = serde_json::json!({
            "owner_oid": "oid:onoal:human:alice"
        });

        let results = module.query(&records, &filters);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "asset-1");
    }
}
```

**2. Update module/mod.rs:**

```rust
pub mod asset;
pub use asset::AssetModule;
```

**3. Verifieer:**

```bash
cargo test asset
```

**Acceptatie Criteria:**

- ✅ AssetModule implementeert Module trait
- ✅ Validation werkt
- ✅ Query filtering werkt
- ✅ Tests passen

---

## Fase 1 Samenvatting

### Voltooide Componenten

✅ **Basis Types**

- Hash type met hex conversion
- Record type met validation
- Anchor type (basis)
- Error types met conversion

✅ **Canonical Serialization**

- Deterministic JSON serialization
- Hash computation
- Test vectors

✅ **Hash Chain**

- ChainEntry type
- Chain verification logic
- Error detection

✅ **Module System**

- Module trait definitie
- ModuleConfig type
- Proof module implementatie
- Asset module implementatie

### Volgende Fase

Na voltooiing van Fase 1 kunnen we doorgaan naar:

- **Fase 2: nucleus-engine** - Runtime wrapper met in-memory state

---

_Gedetailleerd Plan voor Fase 1: nucleus-core - Pure Engine_
