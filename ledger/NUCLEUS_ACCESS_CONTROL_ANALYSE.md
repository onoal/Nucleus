# Nucleus Engine – Access Control Analyse

## Huidige Situatie: Geen Access Control

### ⚠️ Kritiek Security/Privacy Probleem

**In de huidige Nucleus Engine implementatie (Fase 1-5) heeft de Rust core GEEN access control.**

Dit betekent:

- ❌ **Iedereen kan alle records lezen** - geen OID/principal checks
- ❌ **Geen privacy bescherming** - records zijn publiek toegankelijk
- ❌ **Geen authorization** - query() retourneert alle matching records zonder permission checks

### Huidige Query Implementatie

```rust
// nucleus-engine/src/engine.rs
pub fn query(&self, filters: QueryFilters) -> QueryResult {
    // Start with all entries
    let mut entries: Vec<&ChainEntry> = self.state.all_entries().iter().collect();

    // Filter by stream
    if let Some(ref stream) = filters.stream {
        entries.retain(|e| e.record.stream == *stream);
    }

    // Filter by ID
    if let Some(ref id) = filters.id {
        entries.retain(|e| e.record.id == *id);
    }

    // Filter by timestamp range
    // ...

    // ❌ GEEN OID/principal checks
    // ❌ GEEN access control
    // ❌ Iedereen kan alles lezen
}
```

### Voorbeeld Probleem

```typescript
// Alice maakt een asset
const ledger = await createLedger({...});
await ledger.append({
  id: "asset-1",
  stream: "assets",
  timestamp: Date.now(),
  payload: {
    owner_oid: "oid:onoal:human:alice",
    type: "ticket",
    // ... private data
  },
});

// Bob kan NU ALLES lezen - ook Alice's assets!
const allAssets = await ledger.query({
  stream: "assets",
});
// Bob ziet alle assets van iedereen! ❌
```

---

## Oplossing: UAL (Unified Access Layer)

### Hoe UAL Dit Oplost

**UAL voegt access control toe als optionele service:**

1. **ACL Grants** - Bij resource creation worden automatisch grants gemaakt
2. **ACL Checks** - Query/get operaties checken permissions
3. **ACL-aware Queries** - Alleen resources met grants worden geretourneerd

### UAL Flow

```typescript
// 1. Asset Creation met UAL
const asset = await assetService.issueAsset({
  owner_oid: "oid:onoal:human:alice",
  // ...
});

// UAL maakt automatisch grants:
// - Alice krijgt "full" access
// - Issuer krijgt "full" access

// 2. Query MET UAL
const ual = ledger.getService<UnifiedAccessLayer>("ual");
if (ual && requesterOid) {
  // Alleen assets waar requester toegang toe heeft
  const assets = await ual.list(requesterOid, {
    kind: "asset",
  });
  // Bob ziet alleen assets waar hij toegang toe heeft ✅
}

// 3. Query ZONDER UAL (fallback)
// Direct query - geen access control
const allAssets = await ledger.query({
  stream: "assets",
});
// ⚠️ Iedereen ziet alles (als UAL niet beschikbaar is)
```

---

## Architectuur: Waar Moet Access Control Zitten?

### Optie 1: In Rust Core (Niet Aanbevolen)

**Problemen:**

- ❌ Core wordt complexer
- ❌ Database dependency in core (niet gewenst)
- ❌ Business logic in core (niet gewenst)
- ❌ Core moet optioneel kunnen werken zonder UAL

### Optie 2: In TypeScript DX Layer (Aanbevolen) ✅

**Voordelen:**

- ✅ Core blijft simpel en puur
- ✅ UAL is optioneel - core werkt zonder
- ✅ Flexibele implementatie (verschillende UAL backends mogelijk)
- ✅ Business logic in TypeScript (beter voor enterprise features)

**Architectuur:**

```
┌─────────────────────────────────────┐
│   TypeScript DX Layer               │
│   (@onoal/nucleus)                  │
├─────────────────────────────────────┤
│   UAL Service (optioneel)           │  ← Access Control hier!
│   - ACL Grants                      │
│   - ACL Checks                      │
│   - ACL-aware Queries               │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   WASM Bindings                     │
│   (nucleus-wasm)                    │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   Rust Engine                       │
│   (nucleus-engine)                  │
│   - Pure ledger logic               │  ← Geen access control
│   - Hash chain integrity            │
└─────────────────────────────────────┘
```

---

## Implementatie Strategie

### Stap 1: Query Wrapper met UAL Check

```typescript
// packages/nucleus/src/backends/wasm.ts

export class WasmBackend {
  private ual?: UnifiedAccessLayer;

  setUAL(ual: UnifiedAccessLayer): void {
    this.ual = ual;
  }

  async query(
    filters: QueryFilters,
    requesterOid?: string // ← Nieuwe parameter
  ): Promise<QueryResult> {
    const ledger = this.ensureLedger();

    // Als UAL beschikbaar is EN requesterOid is gegeven → ACL-aware query
    if (this.ual && requesterOid) {
      // Gebruik UAL.list() voor ACL filtering
      const result = await this.ual.list(requesterOid, {
        kind: this.mapStreamToKind(filters.stream),
        // ... andere filters
      });

      return {
        records: result.items,
        total: result.items.length,
        hasMore: result.hasMore,
      };
    }

    // Fallback: direct query (geen access control)
    // ⚠️ Dit is backward compatible maar geeft geen privacy
    const wasmFilters = {
      stream: filters.stream,
      // ...
    };
    return ledger.query(wasmFilters);
  }
}
```

### Stap 2: Ledger Interface Extensie

```typescript
// packages/nucleus/src/types/ledger.ts

export interface Ledger {
  // ... existing methods

  /**
   * Query records with optional access control
   *
   * @param filters - Query filters
   * @param requesterOid - Optional requester OID for ACL checks
   *                      If provided and UAL is available, only returns
   *                      records the requester has access to
   */
  query(filters: QueryFilters, requesterOid?: string): Promise<QueryResult>;

  /**
   * Get record by ID with optional access control
   */
  get(hash: string, requesterOid?: string): Promise<LedgerRecord | null>;

  /**
   * Get record by ID with optional access control
   */
  getById(id: string, requesterOid?: string): Promise<LedgerRecord | null>;
}
```

### Stap 3: Module Services met UAL

```typescript
// packages/nucleus-module-asset/src/asset-service.ts

export class AssetService {
  constructor(
    private ledger: Ledger,
    private ual?: UnifiedAccessLayer // Optional UAL
  ) {}

  async queryAssets(filters: QueryAssetsFilters) {
    // Als UAL beschikbaar is EN requester_oid is gegeven
    if (this.ual && filters.requester_oid) {
      // ACL-aware query
      const result = await this.ual.list(filters.requester_oid, {
        kind: "asset",
        subjectOid: filters.owner_oid,
        // ...
      });
      return result.items;
    }

    // Fallback: direct query (geen access control)
    return await this.ledger.query({
      stream: "assets",
      // ...
    });
  }
}
```

---

## Security Model

### Zonder UAL (Huidige Situatie)

```
┌─────────────────────────────────────┐
│   Query Request                     │
│   (geen requesterOid)              │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   Rust Engine                       │
│   query() → ALLE records            │  ❌ Geen privacy
└─────────────────────────────────────┘
```

**Probleem:** Iedereen kan alles lezen

### Met UAL (Aanbevolen)

```
┌─────────────────────────────────────┐
│   Query Request                     │
│   requesterOid: "oid:onoal:user:bob"│
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   UAL Service                       │
│   - Check ACL grants                │
│   - Filter op permissions           │  ✅ Privacy beschermd
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   Rust Engine                       │
│   query() → Alleen toegestane records│
└─────────────────────────────────────┘
```

**Oplossing:** Alleen records met grants worden geretourneerd

---

## Default Behavior: Open vs. Closed

### Optie A: Open by Default (Huidige)

- ✅ Backward compatible
- ✅ Simpel voor development
- ❌ Geen privacy out-of-the-box
- ❌ Vereist UAL voor security

**Gebruik:**

```typescript
// Zonder UAL: iedereen ziet alles
const all = await ledger.query({ stream: "assets" });

// Met UAL: alleen toegestane records
const filtered = await ledger.query(
  { stream: "assets" },
  "oid:onoal:user:alice" // requesterOid
);
```

### Optie B: Closed by Default (Strikt)

- ✅ Privacy by default
- ✅ Security by default
- ❌ Breaking change
- ❌ Complexer voor development

**Gebruik:**

```typescript
// Altijd requesterOid vereist
const all = await ledger.query(
  { stream: "assets" },
  "oid:onoal:user:alice" // Verplicht!
);

// Zonder requesterOid → error
const all = await ledger.query({ stream: "assets" });
// ❌ Error: requesterOid required
```

### Aanbeveling: Optie A (Open by Default)

**Reden:**

- Backward compatible
- Flexibel - UAL is optioneel
- Developers kunnen kiezen voor security wanneer nodig
- Modules kunnen UAL checks toevoegen waar nodig

---

## Privacy Levels

### Level 1: Geen Access Control (Huidig)

```typescript
// Iedereen kan alles lezen
const all = await ledger.query({ stream: "assets" });
```

**Gebruik:** Development, public ledgers, trusted environments

### Level 2: UAL met Requester OID

```typescript
// Alleen toegestane records
const filtered = await ledger.query(
  { stream: "assets" },
  "oid:onoal:user:alice" // requesterOid
);
```

**Gebruik:** Production, private ledgers, enterprise

### Level 3: UAL met Strict Mode

```typescript
// RequesterOid verplicht
const ledger = createLedger({
  // ...
  options: {
    requireUAL: true, // UAL verplicht
  },
});
```

**Gebruik:** High-security environments

---

## Implementatie Prioriteit

### 🔴 Kritiek: UAL Implementatie

**Waarom:**

- Zonder UAL heeft iedereen toegang tot alle data
- Privacy/security risico
- Enterprise features vereisen access control

**Wat nodig:**

1. ✅ UAL context document (al gemaakt)
2. ⏳ UAL package implementatie
3. ⏳ Service registry in nucleus package
4. ⏳ Query extensie met requesterOid parameter
5. ⏳ Module integration

### ⚠️ Waarschuwing voor Productie

**Zonder UAL:**

- ❌ Geen privacy bescherming
- ❌ Iedereen kan alle records lezen
- ❌ Niet geschikt voor productie met private data

**Met UAL:**

- ✅ Privacy beschermd
- ✅ Access control per resource
- ✅ Enterprise-ready

---

## Conclusie

### Huidige Situatie

**❌ Probleem:** De huidige Nucleus Engine heeft **geen access control**. Iedereen kan alle records lezen, ongeacht OID.

**Impact:**

- Privacy risico
- Security risico
- Niet geschikt voor productie met private data

### Oplossing

**✅ UAL (Unified Access Layer)** moet worden geïmplementeerd als **optionele service** in de TypeScript DX layer.

**Implementatie:**

1. UAL package (`@onoal/nucleus-ual`)
2. Service registry in nucleus package
3. Query extensie met `requesterOid` parameter
4. Module integration voor automatische grants

### Aanbeveling

**Voor Development:**

- UAL is optioneel - kan zonder werken
- Open by default voor simpliciteit

**Voor Productie:**

- UAL is **vereist** voor privacy/security
- Modules moeten UAL checks implementeren
- RequesterOid moet worden doorgegeven bij queries

---

_Security Analyse: Nucleus Engine Access Control_
