# Fase 6.2: UAL (Engine-Side) - CORRECTE Implementatie

**Datum**: 18 november 2025  
**Status**: 🔧 REFACTORING

---

## ❌ WAT FOUT WAS

UAL was in **TypeScript** geïmplementeerd → **FUNDAMENTEEL FOUT**

**Waarom fout?**

- Host (TypeScript) = **ALLEEN DX wrapper**
- Engine (Rust) = **ALLE architecturale logica**
- UAL is **security/access control** → **HOORT IN ENGINE**

---

## ✅ CORRECTE ARCHITECTUUR

```
┌─────────────────────────────────────────┐
│    TypeScript (@onoal/nucleus)          │
│    - ALLEEN DX wrapper                  │
│    - Type conversions                   │
│    - NO LOGIC                           │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│      WASM Bindings (nucleus-wasm)       │
│      - Pass through to engine           │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│      Rust Engine (nucleus-engine)       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ACL Module                       │  │ ← ✅ HIER!
│  │  - Grant/check/revoke             │  │
│  │  - In-memory storage              │  │
│  │  - Permission enforcement         │  │
│  └───────────────────────────────────┘  │
│                  ↓                      │
│  ┌───────────────────────────────────┐  │
│  │  LedgerEngine                     │  │
│  │  - Check ACL before append        │  │ ← ✅ ENFORCED
│  │  - append_record() with context   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 📋 STAPPENPLAN

### Fase 0: Cleanup TypeScript Bullshit (10 min) ✅

#### Stap 0.1: Verwijder foute UAL code

- ✅ Verwijder `packages/nucleus/src/ual/` directory
- ✅ Verwijder UAL tests
- ✅ Verwijder UAL exports uit `index.ts`
- ✅ Behoud context helpers (die zijn correct)

#### Stap 0.2: Git status check

- ✅ Check wat er gewijzigd is
- ✅ Commit cleanup

---

### Fase 1: Rust ACL Module (1 uur)

#### Stap 1.1: ACL Types

**File**: `crates/nucleus-engine/src/acl/types.rs`

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// ACL Grant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Grant {
    pub subject_oid: String,
    pub resource_oid: String,
    pub action: String,
    pub granted_by: String,
    pub granted_at: u64,
    pub expires_at: Option<u64>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Check parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckParams {
    pub requester_oid: String,
    pub resource_oid: String,
    pub action: String,
}

/// Revoke parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokeParams {
    pub subject_oid: String,
    pub resource_oid: String,
    pub action: String,
}
```

#### Stap 1.2: ACL Error

**File**: `crates/nucleus-engine/src/acl/error.rs`

```rust
use thiserror::Error;

pub type AclResult<T> = Result<T, AclError>;

#[derive(Debug, Error)]
pub enum AclError {
    #[error("Access denied: {0}")]
    AccessDenied(String),

    #[error("Invalid grant: {0}")]
    InvalidGrant(String),

    #[error("Grant not found")]
    GrantNotFound,
}
```

#### Stap 1.3: ACL Trait

**File**: `crates/nucleus-engine/src/acl/trait_def.rs`

```rust
use super::types::{Grant, CheckParams, RevokeParams};
use super::error::AclResult;

/// ACL Backend trait
pub trait AclBackend: Send {
    /// Grant access
    fn grant(&mut self, grant: Grant) -> AclResult<()>;

    /// Check if access is allowed
    fn check(&self, params: &CheckParams) -> AclResult<bool>;

    /// Revoke access
    fn revoke(&mut self, params: &RevokeParams) -> AclResult<()>;

    /// List grants for subject
    fn list_grants(&self, subject_oid: &str) -> AclResult<Vec<Grant>>;

    /// Clear all grants
    fn clear(&mut self) -> AclResult<()>;
}
```

#### Stap 1.4: In-Memory Implementation

**File**: `crates/nucleus-engine/src/acl/memory.rs`

```rust
use super::trait_def::AclBackend;
use super::types::{Grant, CheckParams, RevokeParams};
use super::error::AclResult;
use std::collections::HashMap;

pub struct InMemoryAcl {
    grants: HashMap<String, Grant>,
}

impl InMemoryAcl {
    pub fn new() -> Self {
        Self {
            grants: HashMap::new(),
        }
    }

    fn make_key(subject_oid: &str, resource_oid: &str, action: &str) -> String {
        format!("{}:{}:{}", subject_oid, resource_oid, action)
    }
}

impl AclBackend for InMemoryAcl {
    fn grant(&mut self, grant: Grant) -> AclResult<()> {
        let key = Self::make_key(&grant.subject_oid, &grant.resource_oid, &grant.action);
        self.grants.insert(key, grant);
        Ok(())
    }

    fn check(&self, params: &CheckParams) -> AclResult<bool> {
        let key = Self::make_key(&params.requester_oid, &params.resource_oid, &params.action);

        if let Some(grant) = self.grants.get(&key) {
            // Check expiration
            if let Some(expires_at) = grant.expires_at {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();

                if expires_at < now {
                    return Ok(false);
                }
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn revoke(&mut self, params: &RevokeParams) -> AclResult<()> {
        let key = Self::make_key(&params.subject_oid, &params.resource_oid, &params.action);
        self.grants.remove(&key);
        Ok(())
    }

    fn list_grants(&self, subject_oid: &str) -> AclResult<Vec<Grant>> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(self.grants
            .values()
            .filter(|g| {
                g.subject_oid == subject_oid &&
                g.expires_at.map_or(true, |exp| exp >= now)
            })
            .cloned()
            .collect())
    }

    fn clear(&mut self) -> AclResult<()> {
        self.grants.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grant_and_check() {
        let mut acl = InMemoryAcl::new();

        let grant = Grant {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
            granted_by: "oid:onoal:system:admin".into(),
            granted_at: 1234567890,
            expires_at: None,
            metadata: None,
        };

        acl.grant(grant).unwrap();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(allowed);
    }

    #[test]
    fn test_deny_without_grant() {
        let acl = InMemoryAcl::new();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:bob".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(!allowed);
    }

    #[test]
    fn test_revoke() {
        let mut acl = InMemoryAcl::new();

        let grant = Grant {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
            granted_by: "oid:onoal:system:admin".into(),
            granted_at: 1234567890,
            expires_at: None,
            metadata: None,
        };

        acl.grant(grant).unwrap();

        acl.revoke(&RevokeParams {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(!allowed);
    }

    #[test]
    fn test_expiration() {
        let mut acl = InMemoryAcl::new();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let grant = Grant {
            subject_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
            granted_by: "oid:onoal:system:admin".into(),
            granted_at: now,
            expires_at: Some(now - 100), // Expired
            metadata: None,
        };

        acl.grant(grant).unwrap();

        let allowed = acl.check(&CheckParams {
            requester_oid: "oid:onoal:human:alice".into(),
            resource_oid: "oid:onoal:ledger:test".into(),
            action: "write".into(),
        }).unwrap();

        assert!(!allowed);
    }
}
```

#### Stap 1.5: ACL Module

**File**: `crates/nucleus-engine/src/acl/mod.rs`

```rust
pub mod types;
pub mod trait_def;
pub mod memory;
pub mod error;

pub use types::{Grant, CheckParams, RevokeParams};
pub use trait_def::AclBackend;
pub use memory::InMemoryAcl;
pub use error::{AclError, AclResult};
```

---

### Fase 2: Engine Integration (1 uur)

#### Stap 2.1: Config Update

**File**: `crates/nucleus-engine/src/config.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AclConfig {
    None,
    InMemory,
}

pub struct LedgerConfig {
    pub id: String,
    pub modules: Vec<ModuleConfig>,
    pub options: Option<ConfigOptions>,
    pub storage: StorageConfig,
    pub acl: AclConfig, // ← NEW
}

impl Default for LedgerConfig {
    fn default() -> Self {
        Self {
            id: String::new(),
            modules: Vec::new(),
            options: None,
            storage: StorageConfig::None,
            acl: AclConfig::None, // ← NEW
        }
    }
}

impl LedgerConfig {
    // ... existing methods ...

    pub fn with_acl(mut self, acl: AclConfig) -> Self {
        self.acl = acl;
        self
    }
}
```

#### Stap 2.2: Engine Update

**File**: `crates/nucleus-engine/src/engine.rs`

```rust
use crate::acl::{AclBackend, InMemoryAcl, CheckParams};

pub struct LedgerEngine {
    config: LedgerConfig,
    state: LedgerState,
    modules: ModuleRegistry,
    storage: Option<Box<dyn StorageBackend>>,
    acl: Option<Box<dyn AclBackend>>, // ← NEW
}

impl LedgerEngine {
    pub fn new(config: LedgerConfig) -> Result<Self, EngineError> {
        // ... existing code ...

        // Initialize ACL
        let acl: Option<Box<dyn AclBackend>> = match config.acl {
            AclConfig::None => None,
            AclConfig::InMemory => Some(Box::new(InMemoryAcl::new())),
        };

        Ok(Self {
            config,
            state,
            modules,
            storage,
            acl, // ← NEW
        })
    }

    pub fn append_record(&mut self, record: Record) -> Result<Hash, EngineError> {
        // ✅ REMOVED: Context is already validated in WASM
        // Engine just does ACL check + append

        // Check ACL if enabled
        if let Some(acl) = &self.acl {
            // We need context here - but how do we get it?
            // This needs to be refactored - append_record should take context
            // For now, ACL check happens at higher level
        }

        // Append to chain
        let hash = self.state.append(record)?;

        // Save to storage
        if let Some(storage) = &mut self.storage {
            let entry = self.state.get_by_hash(&hash)
                .ok_or_else(|| EngineError::Internal("Entry not found after append".into()))?;
            storage.save_entry(entry)?;
        }

        Ok(hash)
    }

    // ACL methods (called BEFORE append)
    pub fn grant(&mut self, grant: crate::acl::Grant) -> Result<(), EngineError> {
        if let Some(acl) = &mut self.acl {
            acl.grant(grant)?;
            Ok(())
        } else {
            Err(EngineError::Configuration("ACL not enabled".into()))
        }
    }

    pub fn check_access(&self, params: CheckParams) -> Result<bool, EngineError> {
        if let Some(acl) = &self.acl {
            Ok(acl.check(&params)?)
        } else {
            Ok(true) // No ACL = always allowed
        }
    }

    pub fn revoke(&mut self, params: crate::acl::RevokeParams) -> Result<(), EngineError> {
        if let Some(acl) = &mut self.acl {
            acl.revoke(&params)?;
            Ok(())
        } else {
            Err(EngineError::Configuration("ACL not enabled".into()))
        }
    }

    pub fn list_grants(&self, subject_oid: &str) -> Result<Vec<crate::acl::Grant>, EngineError> {
        if let Some(acl) = &self.acl {
            Ok(acl.list_grants(subject_oid)?)
        } else {
            Ok(vec![])
        }
    }
}
```

**WAIT**: Ik zie hier een probleem. `append_record` moet context hebben om ACL te checken. Dit moet anders.

**BETERE AANPAK**:

```rust
pub fn append_record(&mut self, record: Record, context: &nucleus_core::RequestContext) -> Result<Hash, EngineError> {
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

    // 3. Append to chain
    let hash = self.state.append(record)?;

    // 4. Save to storage
    if let Some(storage) = &mut self.storage {
        let entry = self.state.get_by_hash(&hash)
            .ok_or_else(|| EngineError::Internal("Entry not found after append".into()))?;
        storage.save_entry(entry)?;
    }

    Ok(hash)
}

pub fn append_batch(&mut self, records: Vec<Record>, context: &nucleus_core::RequestContext) -> Result<Vec<Hash>, EngineError> {
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

    // 3. Append batch
    self.state.append_batch(records)
}
```

#### Stap 2.3: Error Update

**File**: `crates/nucleus-engine/src/error.rs`

```rust
#[derive(Debug, Error)]
pub enum EngineError {
    // ... existing ...

    #[error("Access denied: {0}")]
    AccessDenied(String),

    #[error("ACL error: {0}")]
    Acl(#[from] crate::acl::AclError),
}
```

#### Stap 2.4: Lib Update

**File**: `crates/nucleus-engine/src/lib.rs`

```rust
pub mod acl; // ← NEW

pub use acl::{Grant, CheckParams, RevokeParams, AclConfig}; // ← NEW
```

---

### Fase 3: WASM Bindings (30 min)

**File**: `crates/nucleus-wasm/src/ledger.rs`

```rust
#[wasm_bindgen]
impl WasmLedger {
    // ... existing append_record (already has context) ...

    /// Grant access
    #[wasm_bindgen]
    pub fn grant(&mut self, grant: JsValue) -> Result<(), JsValue> {
        let grant: nucleus_engine::Grant = serde_wasm_bindgen::from_value(grant)
            .map_err(|e| JsValue::from_str(&format!("Grant error: {}", e)))?;

        self.inner.grant(grant)
            .map_err(|e| JsValue::from_str(&format!("Grant failed: {}", e)))
    }

    /// Check access
    #[wasm_bindgen]
    pub fn check_access(&self, params: JsValue) -> Result<bool, JsValue> {
        let params: nucleus_engine::CheckParams = serde_wasm_bindgen::from_value(params)
            .map_err(|e| JsValue::from_str(&format!("Check params error: {}", e)))?;

        self.inner.check_access(params)
            .map_err(|e| JsValue::from_str(&format!("Check failed: {}", e)))
    }

    /// Revoke access
    #[wasm_bindgen]
    pub fn revoke(&mut self, params: JsValue) -> Result<(), JsValue> {
        let params: nucleus_engine::RevokeParams = serde_wasm_bindgen::from_value(params)
            .map_err(|e| JsValue::from_str(&format!("Revoke params error: {}", e)))?;

        self.inner.revoke(params)
            .map_err(|e| JsValue::from_str(&format!("Revoke failed: {}", e)))
    }

    /// List grants
    #[wasm_bindgen]
    pub fn list_grants(&self, subject_oid: &str) -> Result<JsValue, JsValue> {
        let grants = self.inner.list_grants(subject_oid)
            .map_err(|e| JsValue::from_str(&format!("List grants failed: {}", e)))?;

        let json = serde_json::to_value(&grants)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&format!("WASM bindgen error: {}", e)))
    }
}
```

---

### Fase 4: TypeScript DX Wrapper (30 min)

#### Stap 4.1: ACL Types

**File**: `packages/nucleus/src/types/acl.ts` (NEW)

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

#### Stap 4.2: Update LedgerConfig

**File**: `packages/nucleus/src/types/ledger.ts`

```typescript
import type { AclConfig } from "./acl";

export interface LedgerConfig {
  id: string;
  modules: ModuleConfig[];
  options?: LedgerOptions;
  storage?: StorageConfig;
  acl?: AclConfig; // ← NEW
}

export interface Ledger {
  readonly id: string;

  // ... existing methods ...

  // ACL namespace (delegated to engine)
  readonly acl: {
    grant(grant: Grant): Promise<void>;
    check(params: CheckParams): Promise<boolean>;
    revoke(params: RevokeParams): Promise<void>;
    listGrants(subjectOid: string): Promise<Grant[]>;
  };
}
```

#### Stap 4.3: WasmBackend ACL Methods

**File**: `packages/nucleus/src/backends/wasm.ts`

```typescript
import type { Grant, CheckParams, RevokeParams } from "../types/acl";

export class WasmBackend {
  // ... existing ...

  async grant(grant: Grant): Promise<void> {
    const ledger = this.ensureLedger();
    const rustGrant = {
      subject_oid: grant.subjectOid,
      resource_oid: grant.resourceOid,
      action: grant.action,
      granted_by: grant.grantedBy,
      granted_at: grant.grantedAt,
      expires_at: grant.expiresAt || null,
      metadata: grant.metadata || null,
    };
    return ledger.grant(rustGrant);
  }

  async checkAccess(params: CheckParams): Promise<boolean> {
    const ledger = this.ensureLedger();
    const rustParams = {
      requester_oid: params.requesterOid,
      resource_oid: params.resourceOid,
      action: params.action,
    };
    return ledger.check_access(rustParams);
  }

  async revoke(params: RevokeParams): Promise<void> {
    const ledger = this.ensureLedger();
    const rustParams = {
      subject_oid: params.subjectOid,
      resource_oid: params.resourceOid,
      action: params.action,
    };
    return ledger.revoke(rustParams);
  }

  async listGrants(subjectOid: string): Promise<Grant[]> {
    const ledger = this.ensureLedger();
    const grants = ledger.list_grants(subjectOid);

    // Convert from Rust format to TypeScript
    return grants.map((g: any) => ({
      subjectOid: g.subject_oid,
      resourceOid: g.resource_oid,
      action: g.action,
      grantedBy: g.granted_by,
      grantedAt: g.granted_at,
      expiresAt: g.expires_at,
      metadata: g.metadata,
    }));
  }
}
```

#### Stap 4.4: Factory ACL Namespace

**File**: `packages/nucleus/src/factory.ts`

```typescript
class LedgerImpl implements Ledger {
  public readonly acl: Ledger["acl"];

  constructor(public readonly id: string, private backend: WasmBackend) {
    // ... existing ...

    this.acl = {
      grant: (grant) => this.backend.grant(grant),
      check: (params) => this.backend.checkAccess(params),
      revoke: (params) => this.backend.revoke(params),
      listGrants: (subjectOid) => this.backend.listGrants(subjectOid),
    };
  }
}
```

#### Stap 4.5: Exports

**File**: `packages/nucleus/src/types/index.ts`

```typescript
export type { Grant, CheckParams, RevokeParams, AclConfig } from "./acl";
```

---

### Fase 5: Tests (1 uur)

#### Stap 5.1: Rust ACL Tests

In `crates/nucleus-engine/src/acl/memory.rs` → Already added!

#### Stap 5.2: Engine Integration Test

**File**: `crates/nucleus-engine/tests/engine_acl_test.rs`

```rust
use nucleus_engine::{LedgerEngine, LedgerConfig, AclConfig, Grant, StorageConfig};
use nucleus_core::{Record, RequestContext};

#[test]
fn test_engine_enforces_acl() {
    let config = LedgerConfig {
        id: "test".into(),
        modules: vec![],
        options: None,
        storage: StorageConfig::None,
        acl: AclConfig::InMemory,
    };

    let mut engine = LedgerEngine::new(config).unwrap();

    let ctx = RequestContext::new("oid:onoal:human:alice".into());
    let record = Record {
        id: "test-1".into(),
        type_name: "test".into(),
        version: "1.0".into(),
        data: serde_json::json!({"msg": "test"}),
        hash: nucleus_core::Hash::default(),
        previous: None,
        timestamp: 1234567890,
        metadata: None,
    };

    // Should fail (no permission)
    let result = engine.append_record(record.clone(), &ctx);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Access denied"));

    // Grant permission
    engine.grant(Grant {
        subject_oid: "oid:onoal:human:alice".into(),
        resource_oid: "oid:onoal:ledger:test".into(),
        action: "write".into(),
        granted_by: "oid:onoal:system:admin".into(),
        granted_at: 1234567890,
        expires_at: None,
        metadata: None,
    }).unwrap();

    // Should succeed
    let result = engine.append_record(record, &ctx);
    assert!(result.is_ok());
}

#[test]
fn test_acl_disabled_allows_all() {
    let config = LedgerConfig {
        id: "test".into(),
        modules: vec![],
        options: None,
        storage: StorageConfig::None,
        acl: AclConfig::None, // Disabled
    };

    let mut engine = LedgerEngine::new(config).unwrap();

    let ctx = RequestContext::new("oid:onoal:human:anyone".into());
    let record = Record {
        id: "test-1".into(),
        type_name: "test".into(),
        version: "1.0".into(),
        data: serde_json::json!({"msg": "test"}),
        hash: nucleus_core::Hash::default(),
        previous: None,
        timestamp: 1234567890,
        metadata: None,
    };

    // Should succeed (ACL disabled)
    let result = engine.append_record(record, &ctx);
    assert!(result.is_ok());
}
```

---

## ⏱️ Totale Tijd: ~3 uur

- ✅ Fase 0: Cleanup (10 min)
- Fase 1: Rust ACL Module (1 uur)
- Fase 2: Engine Integration (1 uur)
- Fase 3: WASM Bindings (30 min)
- Fase 4: TypeScript Wrapper (30 min)
- Fase 5: Tests (30 min)

---

## ✅ Checklist

- [x] Fase 0: Cleanup TypeScript bullshit
- [ ] Fase 1: Rust ACL module
- [ ] Fase 2: Engine integration (append_record takes context + checks ACL)
- [ ] Fase 3: WASM bindings
- [ ] Fase 4: TypeScript wrapper (ALLEEN types + delegation)
- [ ] Fase 5: Tests
- [ ] Build & verify

---

**NU BEGINNEN MET FASE 1?** 🚀
