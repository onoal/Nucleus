# Fase 6.2: UAL (Unified Access Layer) - Implementatie Start

**Datum**: 18 november 2025  
**Status**: 🚀 IN PROGRESS  
**Geschatte tijd**: 2-3 weken

---

## 📋 Implementatie Plan

### Week 1: Foundation & Context (Stap 1-3)

- ✅ Stap 6.2.1: Request Context Types (in progress)
- ⏳ Stap 6.2.2: WASM Boundary Hardening
- ⏳ Stap 6.2.3: UAL Service Interface

### Week 2: Integration & TypeScript (Stap 4-5)

- ⏳ Stap 6.2.4: Engine ACL Integration
- ⏳ Stap 6.2.5: TypeScript Context Helpers

### Week 3: Testing & Polish (Stap 6-8)

- ⏳ Stap 6.2.6: Unit Tests
- ⏳ Stap 6.2.7: Integration Tests
- ⏳ Stap 6.2.8: Documentation

---

## 🎯 Architectuur Principes

### 1. Host-Side ACL (NIET in Rust Core)

```
✅ UAL service leeft in de HOST (TypeScript/server)
✅ Rust engine accepteert alleen requester_oid parameter
✅ ACL check gebeurt VOOR de ledger-call
❌ GEEN ACL storage in Rust core
❌ GEEN tweede engine voor UAL
```

### 2. Verplichte Context

```typescript
// ✅ GOOD: Context verplicht
await ledger.append(record, { requesterOid: "oid:onoal:human:alice" });

// ❌ BAD: Geen context = error
await ledger.append(record); // THROWS!
```

### 3. Non-Optional Security

```
Calls zonder requesterOid worden GEWEIGERD (niet opt-in)
Boundary hardening: WASM/HTTP entrypoints eisen context
UAL check moet PASS voordat Rust engine wordt geraakt
```

---

## 📝 Stap 6.2.1: Request Context Types

### Files te maken:

**Rust**:

1. `crates/nucleus-core/src/context.rs` - RequestContext type
2. `crates/nucleus-engine/src/context.rs` - Engine context handling

**TypeScript**:

1. `packages/nucleus/src/context/types.ts` - Context types
2. `packages/nucleus/src/context/helpers.ts` - Context helpers
3. `packages/nucleus/src/context/index.ts` - Export

### Request Context Structure:

**Rust**:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestContext {
    /// OID of the entity making the request (required)
    pub requester_oid: String,

    /// Optional additional metadata
    pub metadata: Option<HashMap<String, Value>>,

    /// Timestamp of the request
    pub timestamp: u64,
}

impl RequestContext {
    pub fn new(requester_oid: String) -> Self;
    pub fn with_metadata(self, metadata: HashMap<String, Value>) -> Self;
    pub fn validate(&self) -> Result<(), ContextError>;
}
```

**TypeScript**:

```typescript
export interface RequestContext {
  /** OID of requester (required) */
  requesterOid: string;

  /** Optional metadata */
  metadata?: Record<string, any>;

  /** Request timestamp (auto-generated) */
  timestamp?: number;
}

// Helper to create context
export function createContext(requesterOid: string): RequestContext;

// Helper to validate context
export function requireContext(ctx: RequestContext | undefined): RequestContext;
```

---

## 🔍 UAL Service Interface (Preview)

```typescript
// Host-side UAL service (NOT in Rust core)
export interface UALService {
  // Grant access to a resource
  grant(params: {
    subjectOid: string; // Who gets access
    resourceOid: string; // What they can access
    action: string; // What they can do (read/write/admin)
    grantedBy: string; // Who granted it
  }): Promise<void>;

  // Check if access is allowed
  check(params: {
    requesterOid: string; // Who is requesting
    resourceOid: string; // What they want
    action: string; // What they want to do
  }): Promise<boolean>;

  // List grants for a subject
  listGrants(subjectOid: string): Promise<Grant[]>;

  // Revoke access
  revoke(params: {
    subjectOid: string;
    resourceOid: string;
    action: string;
  }): Promise<void>;
}
```

---

## 🚨 Key Changes to Existing APIs

### Before (INSECURE):

```typescript
await ledger.append(record); // No context!
```

### After (SECURE):

```typescript
// Context is REQUIRED
await ledger.append(record, {
  requesterOid: "oid:onoal:human:alice",
});

// No context = Error
try {
  await ledger.append(record); // THROWS!
} catch (error) {
  console.error("Context required!");
}
```

---

## 📊 Progress Tracking

- [x] Planning compleet
- [ ] Request Context (in progress)
- [ ] Boundary hardening
- [ ] UAL service interface
- [ ] Engine integration
- [ ] TypeScript helpers
- [ ] Tests
- [ ] Documentation

---

**Ready to build!** 🔨

Dit wordt een **breaking change** voor de API, maar noodzakelijk voor security! 🔒
