# ✅ Fase 6.2: UAL (Unified Access Layer) - COMPLEET

**Status**: ✅ **VOLTOOID**  
**Datum**: 18 november 2025

---

## 🎯 **Overzicht**

Fase 6.2 is succesvol afgerond! UAL/ACL is nu volledig geïmplementeerd **in de Rust engine** (waar het hoort 🚀).

### ⚠️ **Belangrijke Architecturale Correctie**

De initiële implementatie plaatste ACL in de **host-side** (TypeScript). Dit was **fundamenteel fout**.  
Na user feedback is de volledige implementatie verplaatst naar de **engine-side** (Rust).

**Correctie**: Host bevat **GEEN** architecturale logica. Alle ACL checks worden uitgevoerd door de Rust engine.

---

## 📦 **Wat Is Er Gebouwd?**

### **1. Rust ACL Module** (`crates/nucleus-engine/src/acl/`)

#### **1.1. Types** (`acl/types.rs`)

```rust
pub struct Grant {
    pub subject_oid: String,
    pub resource_oid: String,
    pub action: String,
    pub granted_by: String,
    pub granted_at: u64,
    pub expires_at: Option<u64>,
    pub metadata: Option<String>,
}

pub struct CheckParams {
    pub requester_oid: String,
    pub resource_oid: String,
    pub action: String,
}

pub struct RevokeParams {
    pub subject_oid: String,
    pub resource_oid: String,
    pub action: String,
}
```

#### **1.2. Trait** (`acl/trait_def.rs`)

```rust
pub trait AclBackend: Send {
    fn grant(&mut self, grant: Grant) -> AclResult<()>;
    fn check(&self, params: CheckParams) -> AclResult<bool>;
    fn revoke(&mut self, params: RevokeParams) -> AclResult<()>;
    fn list_grants(&self, subject_oid: &str) -> AclResult<Vec<Grant>>;
}
```

#### **1.3. In-Memory Implementation** (`acl/memory.rs`)

- Grants opgeslagen in `Vec<Grant>`
- Automatische expiration check
- Thread-safe via `Send` trait

---

### **2. Engine Integration** (`crates/nucleus-engine/src/engine.rs`)

#### **2.1. LedgerConfig**

```rust
pub enum AclConfig {
    None,       // Default: alle operaties allowed
    InMemory,   // In-memory ACL checks
}

pub struct LedgerConfig {
    pub id: String,
    pub modules: Vec<ModuleConfig>,
    pub storage: StorageConfig,
    pub acl: AclConfig,  // 🆕 NEW
}
```

#### **2.2. LedgerEngine**

```rust
pub struct LedgerEngine {
    // ... existing fields ...
    acl: Option<Box<dyn AclBackend>>,  // 🆕 NEW
}

impl LedgerEngine {
    pub fn append_record(&mut self, record: Record, context: &RequestContext) -> Result<Hash, EngineError> {
        // ACL check BEFORE appending
        if let Some(acl) = &self.acl {
            let allowed = acl.check(CheckParams {
                requester_oid: context.requester_oid.clone(),
                resource_oid: format!("oid:onoal:ledger:{}", self.ledger_id),
                action: "write".to_string(),
            })?;

            if !allowed {
                return Err(EngineError::AccessDenied);
            }
        }

        // Proceed with append...
    }
}
```

---

### **3. WASM Bindings** (`crates/nucleus-wasm/src/ledger.rs`)

```rust
#[wasm_bindgen]
impl WasmLedger {
    pub fn grant(&mut self, grant: JsValue) -> Result<(), JsValue> { /* ... */ }
    pub fn check_access(&self, params: JsValue) -> Result<bool, JsValue> { /* ... */ }
    pub fn revoke(&mut self, params: JsValue) -> Result<(), JsValue> { /* ... */ }
    pub fn list_grants(&self, subject_oid: &str) -> Result<JsValue, JsValue> { /* ... */ }

    // Context is REQUIRED at WASM boundary
    pub fn append_record(&mut self, record: JsValue, context: JsValue) -> Result<String, JsValue> {
        // Deserialize and validate context FIRST (security boundary)
        let ctx: RequestContext = serde_json::from_value(context_json)?;
        ctx.validate()?;

        // Pass context to engine (ACL check happens IN ENGINE)
        let hash = self.inner.append_record(record, &ctx)?;
        Ok(hash.to_hex())
    }
}
```

---

### **4. TypeScript DX Layer** (`packages/nucleus/src/`)

#### **4.1. Types** (`types/acl.ts`)

```typescript
export interface Grant {
  subjectOid: string;
  resourceOid: string;
  action: string;
  grantedBy: string;
  grantedAt: number;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

export interface CheckParams {
  requesterOid: string;
  resourceOid: string;
  action: string;
}

export interface RevokeParams {
  subjectOid: string;
  resourceOid: string;
  action: string;
}

export type AclConfig = "none" | "inMemory";
```

#### **4.2. Ledger Interface** (`types/ledger.ts`)

```typescript
export interface Ledger {
  readonly acl: {
    grant(grant: Grant): Promise<void>;
    check(params: CheckParams): Promise<boolean>;
    revoke(params: RevokeParams): Promise<void>;
    listGrants(subjectOid: string): Promise<Grant[]>;
  };
}
```

#### **4.3. WasmBackend Implementation** (`backends/wasm.ts`)

```typescript
export class WasmBackend {
  async grant(grant: Grant): Promise<void> {
    const ledger = this.ensureLedger();

    // Convert camelCase to snake_case
    const rustGrant = {
      subject_oid: grant.subjectOid,
      resource_oid: grant.resourceOid,
      action: grant.action,
      granted_by: grant.grantedBy,
      granted_at: grant.grantedAt,
      expires_at: grant.expiresAt || null,
      metadata: grant.metadata ? JSON.stringify(grant.metadata) : null,
    };

    return ledger.grant(rustGrant);
  }

  // ... check, revoke, listGrants ...
}
```

---

## 🧪 **Tests**

### **Rust Integration Tests** (`crates/nucleus-engine/tests/acl_integration.rs`)

✅ **8 tests, alle geslaagd**:

1. `test_grant_and_check_access` - Grant → Check (allow)
2. `test_check_access_denied` - Check zonder grant (deny)
3. `test_revoke_access` - Grant → Revoke → Check (deny)
4. `test_list_grants` - Meerdere grants opsommen
5. `test_append_with_acl_enforced` - Append met ACL check
6. `test_acl_disabled_by_default` - ACL disabled (default behavior)
7. `test_grant_expiration` - Expiration check
8. `test_action_specificity` - Action-specific grants (read vs write)

```bash
running 8 tests
test test_check_access_denied ... ok
test test_grant_expiration ... ok
test test_revoke_access ... ok
test test_grant_and_check_access ... ok
test test_action_specificity ... ok
test test_list_grants ... ok
test test_acl_disabled_by_default ... ok
test test_append_with_acl_enforced ... ok

test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

---

## 📚 **Usage Voorbeeld**

### **Rust**

```rust
use nucleus_engine::{LedgerConfig, LedgerEngine, Grant, CheckParams, AclConfig};
use nucleus_core::RequestContext;

// Create ledger with ACL enabled
let config = LedgerConfig::new("my-ledger".to_string())
    .with_acl(AclConfig::InMemory);

let mut engine = LedgerEngine::new(config)?;

// Grant write access to Alice
let grant = Grant {
    subject_oid: "oid:onoal:human:alice".to_string(),
    resource_oid: "oid:onoal:ledger:my-ledger".to_string(),
    action: "write".to_string(),
    granted_by: "oid:onoal:system:admin".to_string(),
    granted_at: 1234567890,
    expires_at: None,
    metadata: None,
};

engine.grant(grant)?;

// Check access
let allowed = engine.check_access(CheckParams {
    requester_oid: "oid:onoal:human:alice".to_string(),
    resource_oid: "oid:onoal:ledger:my-ledger".to_string(),
    action: "write".to_string(),
})?;

assert!(allowed); // ✅ Access granted

// Append with context (ACL check happens automatically)
let context = RequestContext::new("oid:onoal:human:alice".to_string());
let record = Record::new(/* ... */);
let hash = engine.append_record(record, &context)?; // ✅ Allowed
```

### **TypeScript (via WASM)**

```typescript
import { createLedger } from "@onoal/nucleus";

const ledger = await createLedger({
  id: "my-ledger",
  backend: { mode: "wasm" },
  modules: [],
  acl: "inMemory", // 🆕 Enable ACL
});

// Grant write access to Alice
await ledger.acl.grant({
  subjectOid: "oid:onoal:human:alice",
  resourceOid: "oid:onoal:ledger:my-ledger",
  action: "write",
  grantedBy: "oid:onoal:system:admin",
  grantedAt: Date.now() / 1000,
});

// Check access
const allowed = await ledger.acl.check({
  requesterOid: "oid:onoal:human:alice",
  resourceOid: "oid:onoal:ledger:my-ledger",
  action: "write",
});

console.log(allowed); // true ✅

// Append with context (ACL check happens in Rust engine)
const context = createContext("oid:onoal:human:alice");
const hash = await ledger.append(
  {
    id: "record-1",
    stream: "test",
    timestamp: Date.now(),
    payload: { data: "test" },
  },
  context
); // ✅ Allowed
```

---

## 🔒 **Security**

### **Security Boundary**

1. **Context Validation**: Gebeurt aan WASM boundary
2. **ACL Check**: Gebeurt IN de Rust engine (VOOR append)
3. **No Host-Side Logic**: TypeScript bevat GEEN security logica

### **Trust Model**

- **Rust Engine**: Trusted (alle security checks)
- **WASM Boundary**: Hardened (context deserialization + validation)
- **TypeScript Host**: Untrusted (pure DX wrapper, geen security logica)

---

## ✅ **Checklist**

- [x] **Fase 0**: Cleanup van host-side bullshit
- [x] **Fase 1**: Rust ACL Module (types, trait, in-memory)
- [x] **Fase 2**: Engine Integration (config, lifecycle, append checks)
- [x] **Fase 3**: WASM Bindings (grant, check, revoke, list)
- [x] **Fase 4**: TypeScript DX Layer (types, interface, backend)
- [x] **Fase 5**: Tests (8 integration tests, alle geslaagd)
- [x] **Fase 6**: Documentatie

---

## 🚀 **Wat Nu?**

Fase 6.2 is **volledig afgerond**! De UAL/ACL implementatie is:

- ✅ **Engine-side** (waar het hoort)
- ✅ **Type-safe** (Rust + TypeScript)
- ✅ **Tested** (8 integration tests)
- ✅ **Documented** (dit document + inline docs)

**Volgende stap**: Fase 6.4 (Native Binary Builds) of verdere optimalisaties.

---

## 📝 **Notes**

- ACL is **disabled by default** (`AclConfig::None`)
- In-memory ACL is **niet persistent** (lost grants na restart)
- Voor productie: implementeer `PostgresAcl` of `SqliteAcl`
- Expiration is **automatisch** gecontroleerd bij elke `check()`

---

**🎉 GEFELICITEERD! UAL/ACL IS COMPLEET! 🎉**
