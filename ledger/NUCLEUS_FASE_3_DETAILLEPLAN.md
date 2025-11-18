# Nucleus Engine – Fase 3: nucleus-wasm (Gedetailleerd Plan)

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor **Fase 3: nucleus-wasm – WASM Bindings (Week 8-10)**. Elke stap bevat:

- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

---

## Stap 3.1: WASM Project Setup

### Stap 3.1.1: nucleus-wasm Crate Setup

#### Waarom

WASM bindings maken het mogelijk om de Rust engine te gebruiken vanuit TypeScript in browser/Node. Dit is cruciaal voor de DX layer die developers een prettige API biedt terwijl alles via Rust loopt.

#### Wat

- Maak `nucleus-wasm/` directory
- Maak `Cargo.toml` voor nucleus-wasm met wasm-bindgen dependencies
- Setup basis module structuur
- Configureer WASM build target

#### Waar

```
nucleus-wasm/
├── Cargo.toml
└── src/
    └── lib.rs              # WASM bindings entry point
```

#### Hoe

**1. Maak crate directory:**

```bash
mkdir -p nucleus-wasm/src
cd nucleus-wasm
```

**2. Maak Cargo.toml (`nucleus-wasm/Cargo.toml`):**

```toml
[package]
name = "nucleus-wasm"
version.workspace = true
edition.workspace = true
authors.workspace = true
license.workspace = true
description = "Nucleus Engine WASM bindings"

[lib]
crate-type = ["cdylib", "rlib"]
name = "nucleus_wasm"
path = "src/lib.rs"

[dependencies]
nucleus-engine = { path = "../nucleus-engine" }
wasm-bindgen = "0.2"
serde = { workspace = true }
serde-wasm-bindgen = "0.6"
serde_json = { workspace = true }
js-sys = "0.3"
wasm-bindgen-futures = "0.4"

[dev-dependencies]
wasm-bindgen-test = "0.3"

[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-time optimization
```

**3. Update workspace Cargo.toml (`nucleus/Cargo.toml`):**

```toml
[workspace]
members = [
    "nucleus-core",
    "nucleus-engine",
    "nucleus-wasm",  # Toegevoegd
    "nucleus-server",
]
# ... rest blijft hetzelfde
```

**4. Maak basis lib.rs (`nucleus-wasm/src/lib.rs`):**

```rust
//! Nucleus WASM - WASM bindings for nucleus-engine
//!
//! This crate provides WASM bindings to use the Nucleus Engine
//! from JavaScript/TypeScript in browser or Node.js environments.

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use it as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    // Set up panic hook for better error messages in console
    console_error_panic_hook::set_once();
}

// Re-export modules
mod ledger;
mod record;
mod error;

pub use ledger::WasmLedger;
pub use record::WasmRecord;
pub use error::WasmError;
```

**5. Installeer wasm-bindgen CLI (als nog niet gedaan):**

```bash
cargo install wasm-bindgen-cli
```

**6. Verifieer setup:**

```bash
cargo check --target wasm32-unknown-unknown
```

**Acceptatie Criteria:**

- ✅ `nucleus-wasm/Cargo.toml` bestaat
- ✅ `nucleus-wasm/src/lib.rs` bestaat
- ✅ WASM target compileert
- ✅ `cargo check --target wasm32-unknown-unknown` werkt

---

### Stap 3.1.2: WASM Build Script Setup

#### Waarom

We hebben een build script nodig om WASM te compileren en bindings te genereren. Dit maakt het build proces reproduceerbaar en automatiseerbaar.

#### Wat

- Maak build script (bash/Python)
- Configureer wasm-bindgen output
- Setup output directory structuur

#### Waar

```
nucleus-wasm/
├── build.sh                 # Build script
└── pkg/                     # Generated WASM + bindings (gitignored)
```

#### Hoe

**1. Maak build.sh (`nucleus-wasm/build.sh`):**

```bash
#!/bin/bash
set -e

echo "Building nucleus-wasm..."

# Clean previous build
rm -rf pkg
mkdir -p pkg

# Build WASM
echo "Compiling to WASM..."
cargo build --target wasm32-unknown-unknown --release

# Generate bindings
echo "Generating WASM bindings..."
wasm-bindgen \
  --target web \
  --out-dir pkg \
  --no-typescript \
  target/wasm32-unknown-unknown/release/nucleus_wasm.wasm

# Optimize WASM (optional, requires wasm-opt)
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing WASM..."
    wasm-opt -Os pkg/nucleus_wasm_bg.wasm -o pkg/nucleus_wasm_bg.wasm
fi

echo "Build complete! Output in pkg/"
```

**2. Maak build script executable:**

```bash
chmod +x nucleus-wasm/build.sh
```

**3. Maak .gitignore (`nucleus-wasm/.gitignore`):**

```
pkg/
target/
*.wasm
```

**4. Test build:**

```bash
cd nucleus-wasm
./build.sh
```

**Acceptatie Criteria:**

- ✅ Build script bestaat
- ✅ Build script is executable
- ✅ WASM wordt gecompileerd
- ✅ Bindings worden gegenereerd
- ✅ Output directory wordt aangemaakt

---

## Stap 3.2: WasmLedger Struct

### Stap 3.2.1: WasmLedger Basis Struct

#### Waarom

WasmLedger is de WASM-wrapped versie van LedgerEngine die vanuit JavaScript/TypeScript gebruikt kan worden. Het moet alle functionaliteit van LedgerEngine exposeren via wasm-bindgen.

#### Wat

- Implementeer `WasmLedger` struct
- Implementeer constructor vanuit JS config
- Implementeer basis methods (append, get, verify)
- Schrijf unit tests

#### Waar

```
nucleus-wasm/src/
├── lib.rs                  # Main bindings
└── ledger.rs               # WasmLedger struct
```

#### Hoe

**1. Maak ledger.rs (`nucleus-wasm/src/ledger.rs`):**

```rust
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
    }

    /// Get record by ID
    #[wasm_bindgen]
    pub fn get_record_by_id(&self, id: &str) -> Result<JsValue, JsValue> {
        let record = self.inner.get_record_by_id(id)
            .ok_or_else(|| JsValue::from_str("Record not found"))?;

        let json = serde_json::to_value(record)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

        serde_wasm_bindgen::to_value(&json)
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
}
```

**2. Update lib.rs om ledger module te exporteren:**

```rust
mod ledger;
pub use ledger::WasmLedger;
```

**3. Voeg console_error_panic_hook dependency toe aan Cargo.toml:**

```toml
[dependencies]
# ... bestaande dependencies
console_error_panic_hook = "0.1"
```

**4. Verifieer:**

```bash
cargo check --target wasm32-unknown-unknown
```

**Acceptatie Criteria:**

- ✅ `WasmLedger` struct is geïmplementeerd
- ✅ Constructor werkt
- ✅ Basis methods zijn geïmplementeerd
- ✅ Code compileert naar WASM

---

### Stap 3.2.2: WasmRecord Helper Type

#### Waarom

Records moeten gemakkelijk vanuit JavaScript gemaakt kunnen worden. Een WasmRecord helper type maakt dit type-safe en gebruiksvriendelijk.

#### Wat

- Implementeer `WasmRecord` helper struct
- Implementeer conversie methods
- Schrijf unit tests

#### Waar

```
nucleus-wasm/src/
└── record.rs                # WasmRecord helper
```

#### Hoe

**1. Maak record.rs (`nucleus-wasm/src/record.rs`):**

```rust
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
    }

    /// Get inner record (for internal use)
    pub fn into_inner(self) -> Record {
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
```

**2. Update lib.rs:**

```rust
mod record;
pub use record::WasmRecord;
```

**3. Verifieer:**

```bash
cargo check --target wasm32-unknown-unknown
```

**Acceptatie Criteria:**

- ✅ `WasmRecord` helper is geïmplementeerd
- ✅ Conversie methods werken
- ✅ Code compileert

---

### Stap 3.2.3: Query & Batch Methods

#### Waarom

Query en batch functionaliteit moet ook beschikbaar zijn vanuit WASM. Dit maakt de WASM API compleet.

#### Wat

- Implementeer `query()` method in WasmLedger
- Implementeer `append_batch()` method
- Schrijf tests

#### Waar

```
nucleus-wasm/src/
└── ledger.rs                # Query & batch methods toevoegen
```

#### Hoe

**1. Voeg query method toe aan WasmLedger:**

```rust
impl WasmLedger {
    // ... bestaande methods ...

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
    }
}
```

**2. Verifieer:**

```bash
cargo check --target wasm32-unknown-unknown
```

**Acceptatie Criteria:**

- ✅ Query method werkt
- ✅ Batch append method werkt
- ✅ Code compileert

---

## Stap 3.3: TypeScript Type Definitions

### Stap 3.3.1: TypeScript Definitions

#### Waarom

TypeScript types maken de WASM API type-safe en developer-friendly. Dit is cruciaal voor de DX layer.

#### Wat

- Schrijf TypeScript type definitions
- Definieer interfaces voor alle WASM types
- Export types voor gebruik in TypeScript projecten

#### Waar

```
nucleus-wasm/
├── pkg/                    # Generated WASM + bindings
├── types/
│   └── index.d.ts          # TypeScript definitions
└── package.json
```

#### Hoe

**1. Maak types directory:**

```bash
mkdir -p nucleus-wasm/types
```

**2. Maak index.d.ts (`nucleus-wasm/types/index.d.ts`):**

```typescript
/**
 * Nucleus WASM - TypeScript type definitions
 */

export interface LedgerConfig {
  id: string;
  modules: ModuleConfig[];
  options?: ConfigOptions;
}

export interface ConfigOptions {
  strict_validation?: boolean;
  max_entries?: number;
  enable_metrics?: boolean;
}

export interface ModuleConfig {
  id: string;
  version: string;
  config: Record<string, unknown>;
}

export interface Record {
  id: string;
  stream: string;
  timestamp: number;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface QueryFilters {
  stream?: string;
  id?: string;
  limit?: number;
  offset?: number;
  timestamp_from?: number;
  timestamp_to?: number;
  module_filters?: Record<string, unknown>;
}

export interface QueryResult {
  records: Record[];
  total: number;
  has_more: boolean;
}

export class WasmLedger {
  constructor(config: LedgerConfig);

  readonly id: string;

  append_record(record: Record): Promise<string>;
  get_record(hash: string): Promise<Record | null>;
  get_record_by_id(id: string): Promise<Record | null>;
  verify(): Promise<void>;
  query(filters: QueryFilters): Promise<QueryResult>;
  append_batch(records: Record[]): Promise<string[]>;
  len(): number;
  is_empty(): boolean;
  latest_hash(): string | null;
}

export class WasmRecord {
  constructor(
    id: string,
    stream: string,
    timestamp: number,
    payload: Record<string, unknown>
  );

  static with_meta(
    id: string,
    stream: string,
    timestamp: number,
    payload: Record<string, unknown>,
    meta: Record<string, unknown>
  ): WasmRecord;

  validate(): Promise<void>;
  to_json(): Record<string, unknown>;
}
```

**3. Maak package.json (`nucleus-wasm/package.json`):**

```json
{
  "name": "@onoal/nucleus-wasm",
  "version": "0.1.0",
  "description": "Nucleus Engine WASM bindings",
  "main": "pkg/nucleus_wasm.js",
  "types": "types/index.d.ts",
  "files": ["pkg", "types"],
  "repository": {
    "type": "git",
    "url": "https://github.com/onoal/nucleus"
  },
  "keywords": ["ledger", "wasm", "blockchain"],
  "license": "MIT"
}
```

**4. Verifieer types:**

```bash
# Test met TypeScript compiler
cd nucleus-wasm
npx tsc --noEmit types/index.d.ts
```

**Acceptatie Criteria:**

- ✅ TypeScript definitions zijn compleet
- ✅ Types matchen WASM API
- ✅ TypeScript compiler accepteert types

---

### Stap 3.3.2: WASM Module Export

#### Waarom

WASM moet correct geëxporteerd worden als ES module zodat het gebruikt kan worden in moderne JavaScript/TypeScript projecten.

#### Wat

- Configureer wasm-bindgen voor ES module output
- Update build script
- Test module import

#### Waar

```
nucleus-wasm/
├── build.sh                 # Update build script
└── pkg/
    └── nucleus_wasm.js      # Generated ES module
```

#### Hoe

**1. Update build.sh om ES module te genereren:**

```bash
#!/bin/bash
set -e

echo "Building nucleus-wasm..."

# Clean previous build
rm -rf pkg
mkdir -p pkg

# Build WASM
echo "Compiling to WASM..."
cargo build --target wasm32-unknown-unknown --release

# Generate bindings (ES module)
echo "Generating WASM bindings (ES module)..."
wasm-bindgen \
  --target web \
  --out-dir pkg \
  --no-typescript \
  target/wasm32-unknown-unknown/release/nucleus_wasm.wasm

# Optimize WASM (optional)
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing WASM..."
    wasm-opt -Os pkg/nucleus_wasm_bg.wasm -o pkg/nucleus_wasm_bg.wasm
fi

echo "Build complete! Output in pkg/"
echo ""
echo "Usage:"
echo "  import init, { WasmLedger } from '@onoal/nucleus-wasm/pkg/nucleus_wasm.js';"
```

**2. Test ES module import (maak test file):**

```javascript
// test-import.mjs
import init, { WasmLedger } from "./pkg/nucleus_wasm.js";

async function test() {
  await init();

  const ledger = new WasmLedger({
    id: "test-ledger",
    modules: [
      {
        id: "proof",
        version: "1.0.0",
        config: {},
      },
    ],
  });

  console.log("Ledger ID:", ledger.id);
}

test().catch(console.error);
```

**3. Verifieer:**

```bash
# Build
./build.sh

# Test import (requires Node.js met ES modules)
node --experimental-modules test-import.mjs
```

**Acceptatie Criteria:**

- ✅ ES module wordt gegenereerd
- ✅ Import werkt in Node.js
- ✅ Import werkt in browser

---

## Stap 3.4: End-to-End Tests

### Stap 3.4.1: WASM Test Setup

#### Waarom

We moeten verifiëren dat WASM bindings correct werken vanuit JavaScript. Dit vereist een test setup die WASM kan laden en testen.

#### Wat

- Setup wasm-bindgen-test
- Schrijf eerste WASM tests
- Test vanuit JavaScript

#### Waar

```
nucleus-wasm/
├── tests/
│   └── wasm_test.rs        # WASM tests
└── tests/
    └── js_test.js          # JavaScript tests
```

#### Hoe

**1. Maak WASM tests (`nucleus-wasm/tests/wasm_test.rs`):**

```rust
use wasm_bindgen_test::*;
use nucleus_wasm::WasmLedger;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_wasm_ledger_new() {
    let config = serde_json::json!({
        "id": "test-ledger",
        "modules": [
            {
                "id": "proof",
                "version": "1.0.0",
                "config": {}
            }
        ]
    });

    let config_js = serde_wasm_bindgen::to_value(&config).unwrap();
    let ledger = WasmLedger::new(config_js).unwrap();

    assert_eq!(ledger.id(), "test-ledger");
    assert!(ledger.is_empty());
}

#[wasm_bindgen_test]
fn test_wasm_ledger_append() {
    let config = serde_json::json!({
        "id": "test-ledger",
        "modules": [
            {
                "id": "proof",
                "version": "1.0.0",
                "config": {}
            }
        ]
    });

    let config_js = serde_wasm_bindgen::to_value(&config).unwrap();
    let mut ledger = WasmLedger::new(config_js).unwrap();

    let record = serde_json::json!({
        "id": "record-1",
        "stream": "proofs",
        "timestamp": 1234567890,
        "payload": {
            "type": "proof",
            "subject_oid": "oid:onoal:human:alice",
            "issuer_oid": "oid:onoal:org:example"
        }
    });

    let record_js = serde_wasm_bindgen::to_value(&record).unwrap();
    let hash = ledger.append_record(record_js).unwrap();

    assert!(!hash.is_empty());
    assert_eq!(ledger.len(), 1);
}
```

**2. Maak JavaScript tests (`nucleus-wasm/tests/js_test.js`):**

```javascript
import init, { WasmLedger } from "../pkg/nucleus_wasm.js";

async function runTests() {
  await init();

  console.log("Testing WasmLedger...");

  // Test 1: Create ledger
  const ledger = new WasmLedger({
    id: "test-ledger",
    modules: [
      {
        id: "proof",
        version: "1.0.0",
        config: {},
      },
    ],
  });

  console.assert(ledger.id === "test-ledger", "Ledger ID should match");
  console.assert(ledger.is_empty() === true, "Ledger should be empty");

  // Test 2: Append record
  const record = {
    id: "record-1",
    stream: "proofs",
    timestamp: 1234567890,
    payload: {
      type: "proof",
      subject_oid: "oid:onoal:human:alice",
      issuer_oid: "oid:onoal:org:example",
    },
  };

  const hash = ledger.append_record(record);
  console.assert(hash.length > 0, "Hash should be returned");
  console.assert(ledger.len() === 1, "Ledger should have 1 entry");

  // Test 3: Get record
  const retrieved = ledger.get_record(hash);
  console.assert(retrieved !== null, "Record should be found");
  console.assert(retrieved.id === "record-1", "Record ID should match");

  // Test 4: Verify chain
  ledger.verify();
  console.log("Chain verification passed");

  console.log("All tests passed!");
}

runTests().catch(console.error);
```

**3. Update Cargo.toml voor tests:**

```toml
[dev-dependencies]
wasm-bindgen-test = "0.3"
```

**4. Run WASM tests:**

```bash
wasm-pack test --headless --firefox
# of
wasm-pack test --node
```

**Acceptatie Criteria:**

- ✅ WASM tests kunnen draaien
- ✅ JavaScript tests werken
- ✅ Alle functionaliteit is getest

---

### Stap 3.4.2: Browser Integration Test

#### Waarom

We moeten verifiëren dat WASM werkt in een browser omgeving. Dit is belangrijk omdat veel gebruikers WASM in de browser zullen gebruiken.

#### Wat

- Maak HTML test page
- Test WASM loading in browser
- Test alle functionaliteit

#### Waar

```
nucleus-wasm/
└── tests/
    └── browser_test.html   # Browser test page
```

#### Hoe

**1. Maak browser_test.html (`nucleus-wasm/tests/browser_test.html`):**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Nucleus WASM Browser Test</title>
    <style>
      body {
        font-family: monospace;
        padding: 20px;
      }
      .test {
        margin: 10px 0;
        padding: 10px;
        border: 1px solid #ccc;
      }
      .pass {
        background-color: #d4edda;
      }
      .fail {
        background-color: #f8d7da;
      }
    </style>
  </head>
  <body>
    <h1>Nucleus WASM Browser Test</h1>
    <div id="results"></div>

    <script type="module">
      import init, { WasmLedger } from "../pkg/nucleus_wasm.js";

      const results = document.getElementById("results");

      function addTest(name, passed, message) {
        const div = document.createElement("div");
        div.className = `test ${passed ? "pass" : "fail"}`;
        div.textContent = `${name}: ${passed ? "PASS" : "FAIL"} - ${message}`;
        results.appendChild(div);
      }

      async function runTests() {
        try {
          // Initialize WASM
          await init();
          addTest("WASM Init", true, "WASM loaded successfully");

          // Test 1: Create ledger
          const ledger = new WasmLedger({
            id: "test-ledger",
            modules: [
              {
                id: "proof",
                version: "1.0.0",
                config: {},
              },
            ],
          });
          addTest(
            "Create Ledger",
            ledger.id === "test-ledger",
            "Ledger created"
          );

          // Test 2: Append record
          const record = {
            id: "record-1",
            stream: "proofs",
            timestamp: 1234567890,
            payload: {
              type: "proof",
              subject_oid: "oid:onoal:human:alice",
              issuer_oid: "oid:onoal:org:example",
            },
          };

          const hash = ledger.append_record(record);
          addTest("Append Record", hash.length > 0, `Hash: ${hash}`);

          // Test 3: Get record
          const retrieved = ledger.get_record(hash);
          addTest(
            "Get Record",
            retrieved !== null && retrieved.id === "record-1",
            "Record retrieved"
          );

          // Test 4: Verify
          ledger.verify();
          addTest("Verify Chain", true, "Chain verification passed");

          // Test 5: Query
          const queryResult = ledger.query({ stream: "proofs" });
          addTest(
            "Query",
            queryResult.total === 1,
            `Found ${queryResult.total} records`
          );

          addTest("All Tests", true, "All tests completed successfully");
        } catch (error) {
          addTest("Error", false, error.message);
          console.error(error);
        }
      }

      runTests();
    </script>
  </body>
</html>
```

**2. Test in browser:**

```bash
# Serve test page (bijv. met Python)
cd nucleus-wasm/tests
python3 -m http.server 8000

# Open in browser: http://localhost:8000/browser_test.html
```

**Acceptatie Criteria:**

- ✅ Browser test page werkt
- ✅ WASM laadt in browser
- ✅ Alle functionaliteit werkt in browser

---

## Stap 3.5: NPM Package Setup

### Stap 3.5.1: Package Configuration

#### Waarom

We moeten een NPM package maken zodat TypeScript projecten de WASM bindings eenvoudig kunnen gebruiken.

#### Wat

- Configureer package.json
- Setup build & publish scripts
- Maak README

#### Waar

```
nucleus-wasm/
├── package.json            # NPM package config
├── README.md               # Package documentation
└── .npmignore              # NPM ignore file
```

#### Hoe

**1. Update package.json (`nucleus-wasm/package.json`):**

```json
{
  "name": "@onoal/nucleus-wasm",
  "version": "0.1.0",
  "description": "Nucleus Engine WASM bindings for browser and Node.js",
  "main": "pkg/nucleus_wasm.js",
  "types": "types/index.d.ts",
  "files": ["pkg", "types", "README.md"],
  "scripts": {
    "build": "./build.sh",
    "test": "wasm-pack test --headless --firefox",
    "test:node": "wasm-pack test --node"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/onoal/nucleus"
  },
  "keywords": ["ledger", "wasm", "blockchain", "nucleus"],
  "author": "Onoal Team",
  "license": "MIT",
  "engines": {
    "node": ">=16.0.0"
  }
}
```

**2. Maak .npmignore (`nucleus-wasm/.npmignore`):**

```
target/
src/
tests/
Cargo.toml
Cargo.lock
build.sh
*.rs
.git/
.gitignore
```

**3. Maak README.md (`nucleus-wasm/README.md`):**

````markdown
# @onoal/nucleus-wasm

WASM bindings for Nucleus Engine.

## Installation

```bash
npm install @onoal/nucleus-wasm
```
````

## Usage

### Browser

```javascript
import init, { WasmLedger } from "@onoal/nucleus-wasm";

async function main() {
  // Initialize WASM
  await init();

  // Create ledger
  const ledger = new WasmLedger({
    id: "my-ledger",
    modules: [
      {
        id: "proof",
        version: "1.0.0",
        config: {},
      },
    ],
  });

  // Append record
  const hash = ledger.append_record({
    id: "record-1",
    stream: "proofs",
    timestamp: Date.now(),
    payload: {
      type: "proof",
      subject_oid: "oid:onoal:human:alice",
      issuer_oid: "oid:onoal:org:example",
    },
  });

  console.log("Hash:", hash);
}
```

### Node.js

```javascript
const { WasmLedger } = require("@onoal/nucleus-wasm");

// Same API as browser
```

## API

See `types/index.d.ts` for complete TypeScript definitions.

## License

MIT

````

**4. Test package:**

```bash
# Build
npm run build

# Test package structure
npm pack --dry-run
````

**Acceptatie Criteria:**

- ✅ package.json is compleet
- ✅ Build script werkt
- ✅ Package kan gepackt worden
- ✅ README is compleet

---

### Stap 3.5.2: TypeScript Integration Test

#### Waarom

We moeten verifiëren dat de TypeScript types correct werken en dat TypeScript projecten de package kunnen gebruiken.

#### Wat

- Maak TypeScript test project
- Test type safety
- Test alle API methods

#### Waar

```
nucleus-wasm/
└── test-ts/
    ├── package.json         # Test project
    ├── tsconfig.json        # TypeScript config
    └── src/
        └── test.ts          # TypeScript test
```

#### Hoe

**1. Maak test TypeScript project:**

```bash
mkdir -p nucleus-wasm/test-ts/src
cd nucleus-wasm/test-ts
```

**2. Maak package.json (`nucleus-wasm/test-ts/package.json`):**

```json
{
  "name": "nucleus-wasm-test",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "tsx src/test.ts"
  },
  "dependencies": {
    "@onoal/nucleus-wasm": "file:.."
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

**3. Maak tsconfig.json (`nucleus-wasm/test-ts/tsconfig.json`):**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**4. Maak test.ts (`nucleus-wasm/test-ts/src/test.ts`):**

```typescript
import init, {
  WasmLedger,
  type LedgerConfig,
  type Record,
} from "@onoal/nucleus-wasm";

async function test() {
  // Initialize WASM
  await init();

  // Create config (type-safe)
  const config: LedgerConfig = {
    id: "test-ledger",
    modules: [
      {
        id: "proof",
        version: "1.0.0",
        config: {},
      },
    ],
  };

  // Create ledger
  const ledger = new WasmLedger(config);

  // Type-safe record
  const record: Record = {
    id: "record-1",
    stream: "proofs",
    timestamp: 1234567890,
    payload: {
      type: "proof",
      subject_oid: "oid:onoal:human:alice",
      issuer_oid: "oid:onoal:org:example",
    },
  };

  // Append (type-safe)
  const hash: string = ledger.append_record(record);

  // Get record (type-safe)
  const retrieved: Record | null = ledger.get_record(hash);

  // Query (type-safe)
  const result = ledger.query({
    stream: "proofs",
    limit: 10,
  });

  console.log("TypeScript test passed!");
  console.log("Hash:", hash);
  console.log("Records found:", result.total);
}

test().catch(console.error);
```

**5. Test TypeScript:**

```bash
cd nucleus-wasm/test-ts
npm install
npm run test
```

**Acceptatie Criteria:**

- ✅ TypeScript project compileert
- ✅ Types zijn correct
- ✅ Alle API methods zijn type-safe
- ✅ Test draait succesvol

---

## Stap 3.6: Performance Testing

### Stap 3.6.1: WASM Performance Benchmarks

#### Waarom

We moeten verifiëren dat WASM performance acceptabel is en eventuele bottlenecks identificeren.

#### Wat

- Schrijf performance benchmarks
- Test append performance
- Test query performance
- Vergelijk met native Rust

#### Waar

```
nucleus-wasm/
└── benches/
    └── wasm_bench.rs       # Performance benchmarks
```

#### Hoe

**1. Maak benches directory:**

```bash
mkdir -p nucleus-wasm/benches
```

**2. Update Cargo.toml voor benchmarks:**

```toml
[[bench]]
name = "wasm_bench"
harness = false
```

**3. Maak wasm_bench.rs (`nucleus-wasm/benches/wasm_bench.rs`):**

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

fn bench_append(c: &mut Criterion) {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    c.bench_function("append_record", |b| {
        b.iter(|| {
            let record = Record::new(
                black_box("record-1".to_string()),
                black_box("proofs".to_string()),
                black_box(1234567890),
                black_box(serde_json::json!({"type": "proof"})),
            );
            engine.append_record(record).unwrap();
        });
    });
}

fn bench_query(c: &mut Criterion) {
    let config = create_test_config();
    let mut engine = LedgerEngine::new(config).unwrap();

    // Pre-populate
    for i in 0..1000 {
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

    use nucleus_engine::QueryFilters;

    c.bench_function("query", |b| {
        b.iter(|| {
            let filters = QueryFilters::new()
                .with_stream("proofs".to_string())
                .with_limit(10);
            black_box(engine.query(filters));
        });
    });
}

criterion_group!(benches, bench_append, bench_query);
criterion_main!(benches);
```

**4. Run benchmarks:**

```bash
cargo bench
```

**Acceptatie Criteria:**

- ✅ Benchmarks kunnen draaien
- ✅ Performance metrics zijn verzameld
- ✅ Geen significante performance regressies

---

## Fase 3 Samenvatting

### Voltooide Componenten

✅ **WASM Project Setup**

- nucleus-wasm crate geconfigureerd
- WASM build script
- ES module output

✅ **WasmLedger Struct**

- Complete WASM API
- Record append/get/query
- Batch operations
- Chain verification

✅ **TypeScript Types**

- Complete type definitions
- Type-safe API
- NPM package ready

✅ **End-to-End Tests**

- WASM tests
- JavaScript tests
- Browser tests
- TypeScript integration tests

✅ **Performance**

- Benchmarks
- Performance metrics

### Volgende Fase

Na voltooiing van Fase 3 kunnen we doorgaan naar:

- **Fase 4: @onoal/nucleus (TS DX)** - TypeScript DX layer met builder API

---

_Gedetailleerd Plan voor Fase 3: nucleus-wasm - WASM Bindings_
