# Nucleus Engine – Fase 5: Testing & Documentation (Gedetailleerd Plan)

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor **Fase 5: Testing & Documentation (Week 15-16)**. Elke stap bevat:

- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

---

## Stap 5.1: Comprehensive Test Suite

### Stap 5.1.1: Rust Test Infrastructure

#### Waarom

Een uitgebreide test suite is cruciaal voor kwaliteit en betrouwbaarheid. We beginnen met het opzetten van een solide test infrastructuur voor alle Rust crates.

#### Wat

- Setup test utilities en helpers
- Maak test fixtures en builders
- Configureer test coverage tools
- Schrijf test utilities

#### Waar

```
nucleus-core/
├── tests/
│   ├── common/
│   │   ├── mod.rs           # Test utilities
│   │   ├── fixtures.rs      # Test fixtures
│   │   └── builders.rs      # Test builders
│   └── integration/
│       └── mod.rs           # Integration test utilities
```

#### Hoe

**1. Maak test utilities directory:**

```bash
mkdir -p nucleus-core/tests/common
```

**2. Maak mod.rs (`nucleus-core/tests/common/mod.rs`):**

```rust
//! Common test utilities for nucleus-core

pub mod fixtures;
pub mod builders;

pub use fixtures::*;
pub use builders::*;
```

**3. Maak fixtures.rs (`nucleus-core/tests/common/fixtures.rs`):**

```rust
use nucleus_core::{Record, Hash};

/// Create a test record
pub fn test_record(id: &str, stream: &str, payload: serde_json::Value) -> Record {
    Record::new(
        id.to_string(),
        stream.to_string(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
        payload,
    )
}

/// Create a test proof record
pub fn test_proof_record(id: &str, subject_oid: &str, issuer_oid: &str) -> Record {
    test_record(
        id,
        "proofs",
        serde_json::json!({
            "type": "proof",
            "subject_oid": subject_oid,
            "issuer_oid": issuer_oid,
        }),
    )
}

/// Create a test asset record
pub fn test_asset_record(id: &str, owner_oid: &str) -> Record {
    test_record(
        id,
        "assets",
        serde_json::json!({
            "type": "asset",
            "owner_oid": owner_oid,
        }),
    )
}

/// Create a zero hash
pub fn zero_hash() -> Hash {
    Hash::from_bytes([0u8; 32])
}

/// Create a test hash
pub fn test_hash(seed: u8) -> Hash {
    let mut bytes = [seed; 32];
    bytes[0] = seed;
    Hash::from_bytes(bytes)
}
```

**4. Maak builders.rs (`nucleus-core/tests/common/builders.rs`):**

```rust
use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::ChainEntry;

/// Builder for creating test records
pub struct RecordBuilder {
    id: String,
    stream: String,
    timestamp: u64,
    payload: serde_json::Value,
    meta: Option<serde_json::Value>,
}

impl RecordBuilder {
    pub fn new() -> Self {
        Self {
            id: "test-record".to_string(),
            stream: "test".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            payload: serde_json::json!({}),
            meta: None,
        }
    }

    pub fn with_id(mut self, id: &str) -> Self {
        self.id = id.to_string();
        self
    }

    pub fn with_stream(mut self, stream: &str) -> Self {
        self.stream = stream.to_string();
        self
    }

    pub fn with_timestamp(mut self, timestamp: u64) -> Self {
        self.timestamp = timestamp;
        self
    }

    pub fn with_payload(mut self, payload: serde_json::Value) -> Self {
        self.payload = payload;
        self
    }

    pub fn with_meta(mut self, meta: serde_json::Value) -> Self {
        self.meta = Some(meta);
        self
    }

    pub fn build(self) -> Record {
        if let Some(meta) = self.meta {
            Record::with_meta(
                self.id,
                self.stream,
                self.timestamp,
                self.payload,
                meta,
            )
        } else {
            Record::new(self.id, self.stream, self.timestamp, self.payload)
        }
    }
}

impl Default for RecordBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder for creating chain entries
pub struct ChainEntryBuilder {
    record: Record,
    prev_hash: Option<Hash>,
}

impl ChainEntryBuilder {
    pub fn new(record: Record) -> Self {
        Self {
            record,
            prev_hash: None,
        }
    }

    pub fn with_prev_hash(mut self, prev_hash: Hash) -> Self {
        self.prev_hash = Some(prev_hash);
        self
    }

    pub fn build(self) -> ChainEntry {
        ChainEntry::new(self.record, self.prev_hash).unwrap()
    }
}
```

**5. Update Cargo.toml voor test dependencies:**

```toml
[dev-dependencies]
# ... bestaande dev-dependencies
proptest = "1.0"
```

**6. Verifieer:**

```bash
cargo test --test common
```

**Acceptatie Criteria:**

- ✅ Test utilities zijn geïmplementeerd
- ✅ Fixtures werken
- ✅ Builders werken
- ✅ Tests kunnen draaien

---

### Stap 5.1.2: Property-Based Tests

#### Waarom

Property-based tests helpen edge cases en regressies te vinden door automatisch test cases te genereren.

#### Wat

- Implementeer property-based tests voor serialization
- Implementeer property-based tests voor hash computation
- Implementeer property-based tests voor chain verification
- Schrijf property tests

#### Waar

```
nucleus-core/
└── tests/
    └── property/
        ├── serialization.rs
        ├── hash.rs
        └── chain.rs
```

#### Hoe

**1. Maak property tests directory:**

```bash
mkdir -p nucleus-core/tests/property
```

**2. Maak serialization.rs (`nucleus-core/tests/property/serialization.rs`):**

```rust
use proptest::prelude::*;
use nucleus_core::{Record, Hash};
use nucleus_core::serialization::{serialize_canonical, compute_hash};

proptest! {
    #[test]
    fn test_canonical_serialization_deterministic(
        id in "[a-z0-9-]{1,100}",
        stream in "[a-z]{1,50}",
        timestamp in 0u64..u64::MAX,
    ) {
        let payload = serde_json::json!({
            "field1": "value1",
            "field2": 123,
        });

        let record = Record::new(
            id.clone(),
            stream.clone(),
            timestamp,
            payload.clone(),
        );

        // Serialize twice - should be identical
        let serialized1 = serialize_canonical(&record).unwrap();
        let serialized2 = serialize_canonical(&record).unwrap();

        prop_assert_eq!(serialized1, serialized2);
    }

    #[test]
    fn test_hash_computation_deterministic(
        id in "[a-z0-9-]{1,100}",
        stream in "[a-z]{1,50}",
        timestamp in 0u64..u64::MAX,
    ) {
        let payload = serde_json::json!({
            "field": "value",
        });

        let record = Record::new(id, stream, timestamp, payload);

        // Compute hash twice - should be identical
        let hash1 = compute_hash(&record).unwrap();
        let hash2 = compute_hash(&record).unwrap();

        prop_assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_hash_different_for_different_records(
        id1 in "[a-z0-9-]{1,100}",
        id2 in "[a-z0-9-]{1,100}",
        stream in "[a-z]{1,50}",
        timestamp in 0u64..u64::MAX,
    ) {
        // Skip if IDs are the same
        prop_assume!(id1 != id2);

        let payload = serde_json::json!({});

        let record1 = Record::new(id1, stream.clone(), timestamp, payload.clone());
        let record2 = Record::new(id2, stream, timestamp, payload);

        let hash1 = compute_hash(&record1).unwrap();
        let hash2 = compute_hash(&record2).unwrap();

        prop_assert_ne!(hash1, hash2);
    }
}
```

**3. Maak hash.rs (`nucleus-core/tests/property/hash.rs`):**

```rust
use proptest::prelude::*;
use nucleus_core::{Hash, Record};
use nucleus_core::serialization::compute_hash;

proptest! {
    #[test]
    fn test_hash_from_hex_roundtrip(
        bytes in prop::array::uniform32(0u8..=255u8)
    ) {
        let hash = Hash::from_bytes(bytes);
        let hex = hash.to_hex();
        let restored = Hash::from_hex(&hex).unwrap();

        prop_assert_eq!(hash, restored);
    }

    #[test]
    fn test_hash_always_32_bytes(
        id in "[a-z0-9-]{1,100}",
        stream in "[a-z]{1,50}",
        timestamp in 0u64..u64::MAX,
    ) {
        let record = Record::new(
            id,
            stream,
            timestamp,
            serde_json::json!({}),
        );

        let hash = compute_hash(&record).unwrap();
        prop_assert_eq!(hash.as_bytes().len(), 32);
    }
}
```

**4. Maak chain.rs (`nucleus-core/tests/property/chain.rs`):**

```rust
use proptest::prelude::*;
use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};
use nucleus_core::tests::common::*;

proptest! {
    #[test]
    fn test_chain_verification_valid_chain(
        count in 1usize..100
    ) {
        let mut entries = Vec::new();
        let mut prev_hash: Option<Hash> = None;

        for i in 0..count {
            let record = test_proof_record(
                &format!("record-{}", i),
                "oid:onoal:human:alice",
                "oid:onoal:org:example",
            );
            let entry = ChainEntry::new(record, prev_hash).unwrap();
            prev_hash = Some(entry.hash);
            entries.push(entry);
        }

        let result = verify_chain(&entries);
        prop_assert!(result.valid);
        prop_assert_eq!(result.entries_checked, count);
    }
}
```

**5. Verifieer:**

```bash
cargo test --test property
```

**Acceptatie Criteria:**

- ✅ Property-based tests zijn geïmplementeerd
- ✅ Tests kunnen draaien
- ✅ Edge cases worden getest

---

### Stap 5.1.3: Integration Tests (Rust)

#### Waarom

Integration tests verifiëren dat alle componenten samenwerken en dat de complete API werkt.

#### Wat

- Schrijf integration tests voor nucleus-core
- Schrijf integration tests voor nucleus-engine
- Test complete workflows
- Test error scenarios

#### Waar

```
nucleus-core/
└── tests/
    └── integration/
        └── core_test.rs

nucleus-engine/
└── tests/
    └── integration/
        └── engine_test.rs
```

#### Hoe

**1. Maak integration test voor nucleus-core (`nucleus-core/tests/integration/core_test.rs`):**

```rust
use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::{ChainEntry, verify_chain};
use nucleus_core::serialization::compute_hash;
use nucleus_core::tests::common::*;

#[test]
fn test_complete_workflow() {
    // Create records
    let record1 = test_proof_record(
        "proof-1",
        "oid:onoal:human:alice",
        "oid:onoal:org:example",
    );
    let record2 = test_proof_record(
        "proof-2",
        "oid:onoal:human:bob",
        "oid:onoal:org:example",
    );

    // Compute hashes
    let hash1 = compute_hash(&record1).unwrap();
    let hash2 = compute_hash(&record2).unwrap();

    assert_ne!(hash1, hash2);

    // Create chain
    let entry1 = ChainEntry::genesis(record1).unwrap();
    let entry2 = ChainEntry::new(record2, Some(entry1.hash)).unwrap();

    // Verify chain
    let result = verify_chain(&[entry1, entry2]);
    assert!(result.valid);
}

#[test]
fn test_chain_with_many_entries() {
    let mut entries = Vec::new();
    let mut prev_hash: Option<Hash> = None;

    for i in 0..1000 {
        let record = test_proof_record(
            &format!("proof-{}", i),
            "oid:onoal:human:alice",
            "oid:onoal:org:example",
        );
        let entry = ChainEntry::new(record, prev_hash).unwrap();
        prev_hash = Some(entry.hash);
        entries.push(entry);
    }

    let result = verify_chain(&entries);
    assert!(result.valid);
    assert_eq!(result.entries_checked, 1000);
}

#[test]
fn test_chain_detects_corruption() {
    let record1 = test_proof_record(
        "proof-1",
        "oid:onoal:human:alice",
        "oid:onoal:org:example",
    );
    let mut entry1 = ChainEntry::genesis(record1).unwrap();

    // Corrupt the hash
    entry1.hash = Hash::from_bytes([0xFFu8; 32]);

    let result = verify_chain(&[entry1]);
    assert!(!result.valid);
    assert_eq!(result.hash_mismatches, 1);
}
```

**2. Maak integration test voor nucleus-engine (`nucleus-engine/tests/integration/engine_test.rs`):**

```rust
use nucleus_engine::{LedgerEngine, LedgerConfig};
use nucleus_core::module::ModuleConfig;
use nucleus_core::Record;

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
fn test_engine_complete_workflow() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Append records
    for i in 0..10 {
        let record = Record::new(
            format!("record-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record).unwrap();
    }

    // Verify
    engine.verify().unwrap();
    assert_eq!(engine.len(), 10);
}

#[test]
fn test_engine_query() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Add records
    for i in 0..5 {
        let record = Record::new(
            format!("proof-{}", i),
            "proofs".to_string(),
            1000 + i as u64,
            serde_json::json!({
                "type": "proof",
                "subject_oid": "oid:onoal:human:alice",
                "issuer_oid": "oid:onoal:org:example",
            }),
        );
        engine.append_record(record).unwrap();
    }

    // Query
    use nucleus_engine::QueryFilters;
    let result = engine.query(QueryFilters::new().with_stream("proofs".to_string()));

    assert_eq!(result.total, 5);
    assert_eq!(result.records.len(), 5);
}

#[test]
fn test_engine_batch_append() {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    let records: Vec<Record> = (0..5)
        .map(|i| {
            Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            )
        })
        .collect();

    let hashes = engine.append_batch(records).unwrap();

    assert_eq!(hashes.len(), 5);
    assert_eq!(engine.len(), 5);

    // Verify chain
    engine.verify().unwrap();
}
```

**3. Verifieer:**

```bash
cargo test --test integration
```

**Acceptatie Criteria:**

- ✅ Integration tests zijn geïmplementeerd
- ✅ Complete workflows worden getest
- ✅ Error scenarios worden getest
- ✅ Alle tests passen

---

### Stap 5.1.4: End-to-End Tests (TypeScript → WASM → Rust)

#### Waarom

End-to-end tests verifiëren dat de complete stack werkt: TypeScript DX layer → WASM bindings → Rust engine.

#### Wat

- Schrijf E2E tests voor TypeScript → WASM
- Test complete workflows
- Test error propagation
- Test performance

#### Waar

```
packages/nucleus/
└── tests/
    └── e2e/
        ├── basic.test.ts
        ├── query.test.ts
        └── batch.test.ts
```

#### Hoe

**1. Maak E2E tests directory:**

```bash
mkdir -p packages/nucleus/tests/e2e
```

**2. Maak basic.test.ts (`packages/nucleus/tests/e2e/basic.test.ts`):**

```typescript
import { Nucleus, proofModule, assetModule } from "../../src";

describe("E2E: Basic Operations", () => {
  it("should create ledger and append records", async () => {
    const ledger = await Nucleus.createLedger({
      id: "e2e-test-ledger",
      backend: { mode: "wasm" },
      modules: [proofModule(), assetModule({ name: "tickets" })],
    });

    expect(ledger.id).toBe("e2e-test-ledger");
    expect(await ledger.isEmpty()).toBe(true);

    // Append proof
    const proofHash = await ledger.append({
      id: "proof-1",
      stream: "proofs",
      timestamp: Date.now(),
      payload: {
        type: "proof",
        subject_oid: "oid:onoal:human:alice",
        issuer_oid: "oid:onoal:org:example",
      },
    });

    expect(proofHash).toBeTruthy();
    expect(proofHash.length).toBeGreaterThan(0);

    // Get record
    const proof = await ledger.get(proofHash);
    expect(proof).toBeTruthy();
    expect(proof?.id).toBe("proof-1");

    // Append asset
    const assetHash = await ledger.append({
      id: "ticket-1",
      stream: "assets",
      timestamp: Date.now(),
      payload: {
        type: "ticket",
        owner_oid: "oid:onoal:human:alice",
        eventId: "event-amsterdam",
      },
    });

    expect(assetHash).toBeTruthy();

    // Verify chain
    await ledger.verify();
  });

  it("should handle chain with many entries", async () => {
    const ledger = await Nucleus.createLedger({
      id: "e2e-large-ledger",
      backend: { mode: "wasm" },
      modules: [proofModule()],
    });

    // Append many records
    const hashes: string[] = [];
    for (let i = 0; i < 100; i++) {
      const hash = await ledger.append({
        id: `record-${i}`,
        stream: "proofs",
        timestamp: Date.now() + i,
        payload: {
          type: "proof",
          subject_oid: "oid:onoal:human:alice",
          issuer_oid: "oid:onoal:org:example",
          index: i,
        },
      });
      hashes.push(hash);
    }

    expect(hashes.length).toBe(100);
    expect(await ledger.length()).toBe(100);

    // Verify chain
    await ledger.verify();
  });
});
```

**3. Maak query.test.ts (`packages/nucleus/tests/e2e/query.test.ts`):**

```typescript
import { Nucleus, proofModule } from "../../src";

describe("E2E: Query Operations", () => {
  let ledger: Awaited<ReturnType<typeof Nucleus.createLedger>>;

  beforeEach(async () => {
    ledger = await Nucleus.createLedger({
      id: "e2e-query-ledger",
      backend: { mode: "wasm" },
      modules: [proofModule()],
    });

    // Add test data
    for (let i = 0; i < 10; i++) {
      await ledger.append({
        id: `proof-${i}`,
        stream: "proofs",
        timestamp: 1000 + i,
        payload: {
          type: "proof",
          subject_oid: i < 5 ? "oid:onoal:human:alice" : "oid:onoal:human:bob",
          issuer_oid: "oid:onoal:org:example",
        },
      });
    }
  });

  it("should query by stream", async () => {
    const result = await ledger.query({ stream: "proofs" });

    expect(result.total).toBe(10);
    expect(result.records.length).toBe(10);
  });

  it("should query with limit", async () => {
    const result = await ledger.query({
      stream: "proofs",
      limit: 5,
    });

    expect(result.total).toBe(10);
    expect(result.records.length).toBe(5);
  });

  it("should query with offset", async () => {
    const result = await ledger.query({
      stream: "proofs",
      offset: 5,
      limit: 3,
    });

    expect(result.total).toBe(10);
    expect(result.records.length).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it("should query with timestamp range", async () => {
    const result = await ledger.query({
      stream: "proofs",
      timestampFrom: 1002,
      timestampTo: 1007,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThan(10);
  });
});
```

**4. Maak batch.test.ts (`packages/nucleus/tests/e2e/batch.test.ts`):**

```typescript
import { Nucleus, proofModule } from "../../src";

describe("E2E: Batch Operations", () => {
  it("should append batch atomically", async () => {
    const ledger = await Nucleus.createLedger({
      id: "e2e-batch-ledger",
      backend: { mode: "wasm" },
      modules: [proofModule()],
    });

    const records = Array.from({ length: 5 }, (_, i) => ({
      id: `record-${i}`,
      stream: "proofs",
      timestamp: Date.now() + i,
      payload: {
        type: "proof",
        subject_oid: "oid:onoal:human:alice",
        issuer_oid: "oid:onoal:org:example",
      },
    }));

    const hashes = await ledger.appendBatch(records);

    expect(hashes.length).toBe(5);
    expect(await ledger.length()).toBe(5);

    // Verify all records are linked correctly
    await ledger.verify();
  });

  it("should fail batch if one record is invalid", async () => {
    const ledger = await Nucleus.createLedger({
      id: "e2e-batch-fail-ledger",
      backend: { mode: "wasm" },
      modules: [proofModule()],
    });

    const records = [
      {
        id: "record-1",
        stream: "proofs",
        timestamp: Date.now(),
        payload: {
          type: "proof",
          subject_oid: "oid:onoal:human:alice",
          issuer_oid: "oid:onoal:org:example",
        },
      },
      {
        id: "", // Invalid - empty ID
        stream: "proofs",
        timestamp: Date.now(),
        payload: {
          type: "proof",
        },
      },
    ];

    await expect(ledger.appendBatch(records)).rejects.toThrow();

    // No records should be added
    expect(await ledger.length()).toBe(0);
  });
});
```

**5. Update jest.config.js voor E2E tests:**

```javascript
module.exports = {
  // ... bestaande config ...
  testMatch: [
    "**/__tests__/**/*.ts",
    "**/?(*.)+(spec|test).ts",
    "**/tests/e2e/**/*.test.ts",
  ],
};
```

**6. Run E2E tests:**

```bash
npm test -- e2e
```

**Acceptatie Criteria:**

- ✅ E2E tests zijn geïmplementeerd
- ✅ Complete workflows worden getest
- ✅ Error scenarios worden getest
- ✅ Alle tests passen

---

## Stap 5.2: Performance Testing

### Stap 5.2.1: Rust Benchmarks

#### Waarom

Performance benchmarks helpen om bottlenecks te identificeren en performance regressies te voorkomen.

#### Wat

- Setup Criterion benchmarks
- Schrijf benchmarks voor append operations
- Schrijf benchmarks voor query operations
- Schrijf benchmarks voor hash computation

#### Waar

```
nucleus-core/
└── benches/
    ├── hash.rs
    ├── serialization.rs
    └── chain.rs

nucleus-engine/
└── benches/
    ├── append.rs
    └── query.rs
```

#### Hoe

**1. Update Cargo.toml voor benchmarks:**

```toml
[[bench]]
name = "hash"
harness = false

[[bench]]
name = "serialization"
harness = false

[[bench]]
name = "chain"
harness = false
```

**2. Maak hash.rs (`nucleus-core/benches/hash.rs`):**

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use nucleus_core::{Record, Hash};
use nucleus_core::serialization::compute_hash;

fn bench_hash_computation(c: &mut Criterion) {
    let record = Record::new(
        "test-record".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );

    c.bench_function("hash_computation", |b| {
        b.iter(|| {
            compute_hash(black_box(&record)).unwrap();
        });
    });
}

criterion_group!(benches, bench_hash_computation);
criterion_main!(benches);
```

**3. Maak append.rs (`nucleus-engine/benches/append.rs`):**

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use nucleus_engine::{LedgerEngine, LedgerConfig};
use nucleus_core::module::ModuleConfig;
use nucleus_core::Record;

fn create_test_config() -> LedgerConfig {
    LedgerConfig::with_modules(
        "bench-ledger".to_string(),
        vec![
            ModuleConfig::new(
                "proof".to_string(),
                "1.0.0".to_string(),
                serde_json::json!({}),
            ),
        ],
    )
}

fn bench_append_single(c: &mut Criterion) {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    let record = Record::new(
        "test-record".to_string(),
        "proofs".to_string(),
        1234567890,
        serde_json::json!({
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example",
        }),
    );

    c.bench_function("append_single", |b| {
        b.iter(|| {
            engine.append_record(black_box(record.clone())).unwrap();
        });
    });
}

fn bench_append_batch(c: &mut Criterion) {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    let records: Vec<Record> = (0..100)
        .map(|i| {
            Record::new(
                format!("record-{}", i),
                "proofs".to_string(),
                1000 + i as u64,
                serde_json::json!({
                    "type": "proof",
                    "subject_oid": "oid:onoal:human:alice",
                    "issuer_oid": "oid:onoal:org:example",
                }),
            )
        })
        .collect();

    c.bench_function("append_batch_100", |b| {
        b.iter(|| {
            let mut engine = LedgerEngine::new(create_test_config()).unwrap();
            engine.append_batch(black_box(records.clone())).unwrap();
        });
    });
}

criterion_group!(benches, bench_append_single, bench_append_batch);
criterion_main!(benches);
```

**4. Run benchmarks:**

```bash
cargo bench
```

**Acceptatie Criteria:**

- ✅ Benchmarks zijn geïmplementeerd
- ✅ Benchmarks kunnen draaien
- ✅ Performance metrics zijn verzameld

---

### Stap 5.2.2: WASM Performance Tests

#### Waarom

WASM performance kan verschillen van native Rust. We moeten WASM performance testen om te verifiëren dat het acceptabel is.

#### Wat

- Schrijf WASM performance tests
- Test append performance
- Test query performance
- Vergelijk met native Rust

#### Waar

```
nucleus-wasm/
└── tests/
    └── performance/
        └── wasm_perf.test.js
```

#### Hoe

**1. Maak performance test (`nucleus-wasm/tests/performance/wasm_perf.test.js`):**

```javascript
import init, { WasmLedger } from "../../pkg/nucleus_wasm.js";

describe("WASM Performance", () => {
  beforeAll(async () => {
    await init();
  });

  it("should append records efficiently", async () => {
    const ledger = new WasmLedger({
      id: "perf-ledger",
      modules: [
        {
          id: "proof",
          version: "1.0.0",
          config: {},
        },
      ],
    });

    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      ledger.append_record({
        id: `record-${i}`,
        stream: "proofs",
        timestamp: Date.now() + i,
        payload: {
          type: "proof",
          subject_oid: "oid:onoal:human:alice",
          issuer_oid: "oid:onoal:org:example",
        },
      });
    }

    const end = performance.now();
    const duration = end - start;

    console.log(`Appended 1000 records in ${duration}ms`);
    console.log(`Average: ${duration / 1000}ms per record`);

    // Should complete in reasonable time (< 10 seconds)
    expect(duration).toBeLessThan(10000);
  });

  it("should query efficiently", async () => {
    const ledger = new WasmLedger({
      id: "perf-query-ledger",
      modules: [
        {
          id: "proof",
          version: "1.0.0",
          config: {},
        },
      ],
    });

    // Pre-populate
    for (let i = 0; i < 1000; i++) {
      ledger.append_record({
        id: `record-${i}`,
        stream: "proofs",
        timestamp: 1000 + i,
        payload: {
          type: "proof",
          subject_oid: "oid:onoal:human:alice",
          issuer_oid: "oid:onoal:org:example",
        },
      });
    }

    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      ledger.query({ stream: "proofs", limit: 10 });
    }

    const end = performance.now();
    const duration = end - start;

    console.log(`Executed 100 queries in ${duration}ms`);
    console.log(`Average: ${duration / 100}ms per query`);

    // Should complete in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);
  });
});
```

**2. Run performance tests:**

```bash
npm test -- performance
```

**Acceptatie Criteria:**

- ✅ WASM performance tests zijn geïmplementeerd
- ✅ Performance metrics zijn verzameld
- ✅ Performance is acceptabel

---

## Stap 5.3: Documentation

### Stap 5.3.1: API Documentation

#### Waarom

Goede API documentatie is cruciaal voor developer adoption. Het moet duidelijk zijn hoe alle API methods gebruikt worden.

#### Wat

- Documenteer alle public APIs
- Schrijf code examples voor elke API
- Maak API reference guide
- Generate API docs

#### Waar

```
docs/
├── api/
│   ├── rust/
│   │   ├── nucleus-core.md
│   │   ├── nucleus-engine.md
│   │   └── nucleus-wasm.md
│   └── typescript/
│       └── nucleus.md
└── examples/
    ├── rust/
    └── typescript/
```

#### Hoe

**1. Maak docs directory:**

```bash
mkdir -p docs/api/{rust,typescript}
mkdir -p docs/examples/{rust,typescript}
```

**2. Maak nucleus-core.md (`docs/api/rust/nucleus-core.md`):**

````markdown
# nucleus-core API Reference

## Record

### `Record::new(id, stream, timestamp, payload)`

Create a new record.

**Parameters:**

- `id: String` - Unique record identifier
- `stream: String` - Stream type
- `timestamp: u64` - Unix timestamp in milliseconds
- `payload: Value` - Record payload (JSON)

**Returns:** `Record`

**Example:**

```rust
use nucleus_core::Record;

let record = Record::new(
    "record-1".to_string(),
    "proofs".to_string(),
    1234567890,
    serde_json::json!({
        "type": "proof",
        "subject_oid": "oid:onoal:human:alice",
    }),
);
```
````

## Hash

### `Hash::from_bytes(bytes)`

Create a hash from byte array.

### `Hash::from_hex(hex_str)`

Create a hash from hex string.

### `hash.to_hex()`

Convert hash to hex string.

## ChainEntry

### `ChainEntry::new(record, prev_hash)`

Create a new chain entry.

### `ChainEntry::genesis(record)`

Create a genesis entry (first in chain).

## Serialization

### `serialize_canonical(record)`

Serialize record to canonical JSON form.

### `compute_hash(record)`

Compute hash for a record.

## Chain Verification

### `verify_chain(entries)`

Verify chain integrity.

**Returns:** `ChainVerificationResult`

````

**3. Maak nucleus.md (`docs/api/typescript/nucleus.md`):**

```markdown
# @onoal/nucleus API Reference

## Nucleus

### `Nucleus.createLedger(config)`

Create a new ledger instance.

**Parameters:**
- `config: LedgerConfig` - Ledger configuration

**Returns:** `Promise<Ledger>`

**Example:**
```typescript
import { Nucleus, proofModule } from '@onoal/nucleus';

const ledger = await Nucleus.createLedger({
  id: 'my-ledger',
  backend: { mode: 'wasm' },
  modules: [proofModule()],
});
````

## Ledger

### `ledger.append(record)`

Append a record to the ledger.

**Parameters:**

- `record: Record` - Record to append

**Returns:** `Promise<string>` - Record hash

### `ledger.get(hash)`

Get a record by hash.

**Parameters:**

- `hash: string` - Record hash

**Returns:** `Promise<Record | null>`

### `ledger.query(filters)`

Query records with filters.

**Parameters:**

- `filters: QueryFilters` - Query filters

**Returns:** `Promise<QueryResult>`

### `ledger.verify()`

Verify chain integrity.

**Returns:** `Promise<void>`

````

**4. Generate Rust docs:**

```bash
cargo doc --no-deps --open
````

**5. Generate TypeScript docs (met TypeDoc):**

```bash
npm install --save-dev typedoc
npx typedoc --out docs/api/typescript src/
```

**Acceptatie Criteria:**

- ✅ API documentatie is compleet
- ✅ Code examples zijn aanwezig
- ✅ Docs kunnen gegenereerd worden

---

### Stap 5.3.2: User Guide

#### Waarom

Een user guide helpt developers om snel aan de slag te gaan en laat zien hoe het framework gebruikt wordt.

#### Wat

- Schrijf getting started guide
- Schrijf tutorials
- Maak best practices guide
- Schrijf troubleshooting guide

#### Waar

```
docs/
├── getting-started.md
├── tutorials/
│   ├── basic-ledger.md
│   ├── custom-modules.md
│   └── querying.md
├── best-practices.md
└── troubleshooting.md
```

#### Hoe

**1. Maak getting-started.md (`docs/getting-started.md`):**

````markdown
# Getting Started with Nucleus

## Installation

```bash
npm install @onoal/nucleus @onoal/nucleus-wasm
```
````

## Quick Start

### 1. Create a Ledger

```typescript
import { Nucleus, proofModule } from "@onoal/nucleus";

const ledger = await Nucleus.createLedger({
  id: "my-ledger",
  backend: { mode: "wasm" },
  modules: [proofModule()],
});
```

### 2. Append Records

```typescript
const hash = await ledger.append({
  id: "record-1",
  stream: "proofs",
  timestamp: Date.now(),
  payload: {
    type: "proof",
    subject_oid: "oid:onoal:human:alice",
    issuer_oid: "oid:onoal:org:example",
  },
});
```

### 3. Query Records

```typescript
const result = await ledger.query({ stream: "proofs" });
console.log(`Found ${result.total} records`);
```

### 4. Verify Chain

```typescript
await ledger.verify();
```

## Next Steps

- [Tutorial: Basic Ledger](./tutorials/basic-ledger.md)
- [Tutorial: Custom Modules](./tutorials/custom-modules.md)
- [API Reference](./api/typescript/nucleus.md)

````

**2. Maak basic-ledger.md (`docs/tutorials/basic-ledger.md`):**

```markdown
# Tutorial: Building a Basic Ledger

This tutorial walks you through building a basic ledger with proof and asset modules.

## Step 1: Setup

```typescript
import { Nucleus, proofModule, assetModule } from '@onoal/nucleus';
````

## Step 2: Create Ledger

```typescript
const ledger = await Nucleus.createLedger({
  id: "tutorial-ledger",
  backend: { mode: "wasm" },
  modules: [proofModule(), assetModule({ name: "tickets" })],
});
```

## Step 3: Add Records

```typescript
// Add proof
const proofHash = await ledger.append({
  id: "proof-1",
  stream: "proofs",
  timestamp: Date.now(),
  payload: {
    type: "proof",
    subject_oid: "oid:onoal:human:alice",
    issuer_oid: "oid:onoal:org:example",
  },
});

// Add asset
const assetHash = await ledger.append({
  id: "ticket-1",
  stream: "assets",
  timestamp: Date.now(),
  payload: {
    type: "ticket",
    owner_oid: "oid:onoal:human:alice",
    eventId: "event-amsterdam",
  },
});
```

## Step 4: Query and Verify

```typescript
// Query proofs
const proofs = await ledger.query({ stream: "proofs" });

// Verify chain
await ledger.verify();
```

## Complete Example

See [examples/basic-ledger.ts](../../packages/nucleus/examples/basic-ledger.ts)

````

**3. Maak best-practices.md (`docs/best-practices.md`):**

```markdown
# Best Practices

## Record Design

### Use Descriptive IDs

✅ Good:
```typescript
id: 'proof-alice-2024-01-15'
````

❌ Bad:

```typescript
id: "p1";
```

### Use Consistent Stream Names

✅ Good:

```typescript
stream: "proofs";
stream: "assets";
```

❌ Bad:

```typescript
stream: "proof";
stream: "Proof";
stream: "PROOFS";
```

## Performance

### Batch Operations

Use `appendBatch()` for multiple records:

```typescript
await ledger.appendBatch(records);
```

### Query Optimization

Use filters to limit results:

```typescript
await ledger.query({
  stream: "proofs",
  limit: 100,
  offset: 0,
});
```

## Error Handling

Always handle errors:

```typescript
try {
  await ledger.append(record);
} catch (error) {
  console.error("Failed to append record:", error);
}
```

## Chain Verification

Verify chain regularly:

```typescript
try {
  await ledger.verify();
} catch (error) {
  console.error("Chain verification failed:", error);
}
```

````

**4. Maak troubleshooting.md (`docs/troubleshooting.md`):**

```markdown
# Troubleshooting

## Common Issues

### WASM Not Loading

**Problem:** WASM module fails to load.

**Solution:**
- Ensure `@onoal/nucleus-wasm` is installed
- Check that WASM files are accessible
- Verify browser/Node.js compatibility

### Chain Verification Fails

**Problem:** `ledger.verify()` throws an error.

**Solution:**
- Check for corrupted records
- Verify chain integrity
- Check module validation

### Records Not Found

**Problem:** `ledger.get(hash)` returns null.

**Solution:**
- Verify hash is correct
- Check that record was appended
- Verify ledger state
````

**Acceptatie Criteria:**

- ✅ User guide is compleet
- ✅ Tutorials zijn aanwezig
- ✅ Best practices zijn gedocumenteerd
- ✅ Troubleshooting guide is aanwezig

---

### Stap 5.3.3: Architecture Documentation

#### Waarom

Architecture documentatie helpt developers om het systeem te begrijpen en bij te dragen.

#### Wat

- Documenteer architectuur
- Documenteer design decisions
- Maak architecture diagrams
- Schrijf contribution guide

#### Waar

```
docs/
├── architecture/
│   ├── overview.md
│   ├── design-decisions.md
│   └── diagrams/
└── contributing.md
```

#### Hoe

**1. Maak overview.md (`docs/architecture/overview.md`):**

```markdown
# Nucleus Architecture Overview

## High-Level Architecture
```

┌─────────────────────────────────────────┐
│ TypeScript DX Layer (@onoal/nucleus) │
│ - Builder API │
│ - Module Helpers │
│ - Backend Abstraction │
└──────────────┬──────────────────────────┘
│
▼
┌─────────────────────────────────────────┐
│ WASM Bindings (nucleus-wasm) │
│ - WasmLedger │
│ - Type Conversions │
└──────────────┬──────────────────────────┘
│
▼
┌─────────────────────────────────────────┐
│ Engine (nucleus-engine) │
│ - LedgerEngine │
│ - Module Registry │
│ - State Management │
└──────────────┬──────────────────────────┘
│
▼
┌─────────────────────────────────────────┐
│ Core (nucleus-core) │
│ - Hash Chain │
│ - Serialization │
│ - Modules │
└─────────────────────────────────────────┘

```

## Components

### nucleus-core

Pure engine without I/O dependencies.

- Hash chain computation
- Canonical serialization
- Module system
- Chain verification

### nucleus-engine

Runtime wrapper with in-memory state.

- LedgerEngine struct
- Module registry
- State management
- Query API

### nucleus-wasm

WASM bindings for browser/Node.js.

- WasmLedger wrapper
- Type conversions
- WASM module exports

### @onoal/nucleus

TypeScript DX layer.

- Builder API
- Module helpers
- Backend abstraction
```

**2. Maak design-decisions.md (`docs/architecture/design-decisions.md`):**

```markdown
# Design Decisions

## Why Rust for Core?

- **Performance:** Rust provides native performance
- **Memory Safety:** Prevents common bugs
- **Concurrency:** Safe concurrent access
- **WASM:** Easy compilation to WASM

## Why TypeScript for DX?

- **Developer Experience:** Familiar to most developers
- **Type Safety:** TypeScript provides type checking
- **Ecosystem:** Rich npm ecosystem
- **Tooling:** Excellent tooling support

## Why WASM?

- **Portability:** Works in browser and Node.js
- **Performance:** Near-native performance
- **Security:** Sandboxed execution
- **Compatibility:** Works everywhere

## Module System

Modules are extensible via traits in Rust, exposed via WASM, and configured via TypeScript.

## Backend Abstraction

Backend abstraction allows switching between WASM (embedded) and HTTP (remote) without code changes.
```

**3. Maak contributing.md (`docs/contributing.md`):**

````markdown
# Contributing to Nucleus

## Development Setup

1. Clone repository
2. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
3. Install Node.js: `nvm install`
4. Install dependencies: `npm install`

## Running Tests

### Rust Tests

```bash
cargo test
```
````

### TypeScript Tests

```bash
npm test
```

### E2E Tests

```bash
npm test -- e2e
```

## Code Style

### Rust

- Use `rustfmt` for formatting
- Follow Rust conventions
- Write tests for all features

### TypeScript

- Use ESLint
- Follow TypeScript best practices
- Write tests for all features

## Pull Request Process

1. Create feature branch
2. Write tests
3. Implement feature
4. Update documentation
5. Submit PR

```

**Acceptatie Criteria:**

- ✅ Architecture documentatie is compleet
- ✅ Design decisions zijn gedocumenteerd
- ✅ Contribution guide is aanwezig

---

## Fase 5 Samenvatting

### Voltooide Componenten

✅ **Comprehensive Test Suite**

- Rust test infrastructure
- Property-based tests
- Integration tests
- End-to-end tests

✅ **Performance Testing**

- Rust benchmarks
- WASM performance tests
- Performance metrics

✅ **Documentation**

- API documentation
- User guide
- Architecture documentation
- Contribution guide

### Voltooide Roadmap

✅ **Fase 1: nucleus-core** - Pure Engine
✅ **Fase 2: nucleus-engine** - Runtime Wrapper
✅ **Fase 3: nucleus-wasm** - WASM Bindings
✅ **Fase 4: @onoal/nucleus** - TypeScript DX Layer
✅ **Fase 5: Testing & Documentation** - Complete

### Next Steps

Na voltooiing van Fase 5:

- **Production Ready** - Framework is klaar voor gebruik
- **Optional: nucleus-server** - HTTP server implementatie
- **Community** - Open source release
- **Extensions** - Custom modules en plugins

---

*Gedetailleerd Plan voor Fase 5: Testing & Documentation*

```
