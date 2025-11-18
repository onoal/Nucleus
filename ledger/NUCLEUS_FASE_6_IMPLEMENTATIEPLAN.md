# Nucleus Engine – Fase 6: Kritieke Missing Features Implementatieplan

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor het implementeren van de **kritieke ontbrekende features** geïdentificeerd in de Gap Analysis. Elke stap bevat:

- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

**Belangrijk:** Dit plan houdt rekening met de **Rust-optimized architectuur** waarbij features op de juiste locatie worden geïmplementeerd (Rust core vs TypeScript DX).

---

## Fase 6.1: Module Handles & Registry (Rust-first)

### Waarom

- Modules hebben services/handles nodig, maar de DX-laag moet geen eigen DI-container worden.
- Scope moet per-ledger zijn en gekoppeld aan de Rust lifecycle (init/start/stop).
- Houd de architectuur clean: integriteit en module-lifecycle in Rust, TS DX is alleen configuratie + readonly handles.

### Wat

- Schrap de TypeScript service registry; registry leeft in Rust (`nucleus-engine`).
- Exporteer alleen type-safe module handles via wasm/http; geen `register/get` API in TS.
- Zorg dat elke ledger-instantie een eigen registry en cleanup heeft.

### Waar

```
crates/nucleus-engine/src/module_registry.rs   # module lookup + lifecycle
crates/nucleus-wasm/src/ledger.rs              # wasm expose van module handles
packages/nucleus/src/runtime/ledger.ts         # TS runtime als dunne proxy
```

### Hoe (kort)

1. **Rust registry** – lifecycle hooks + typed retrieval per ledger, geen globals.
2. **WASM binding** – expose module handles, maar geen service map.
3. **DX API** – `ledger.modules.*` is readonly; calls worden direct doorgestuurd.
4. **Tests** – Rust lifecycle + wasm rooktests; geen TS-side register/get.

**Tijdsduur:** 1 week

---

## Fase 6.2: UAL (Unified Access Layer) Implementation

### Waarom

- ACL moet afdwingbaar zijn zonder de Rust-core te vervuilen.
- Calls mogen niet opt-in zijn; `requester_oid` is verplicht bij mutaties en gevoelige reads.
- UAL draait host-side (server of TS host), niet als tweede engine.

### Wat

- Geen aparte TS-engine voor UAL; alleen een host-service (grant/check/list) vóór de ledger-call.
- WASM/HTTP entrypoints vereisen `requesterOid`; DX API gooit bij ontbreken.
- ACL storage en logic zitten in de host (Drizzle/SQL of in-memory), niet in Rust core.

### Waar

```
crates/nucleus-wasm/src/ledger.rs            # requester_oid parameter in exposed methods
packages/nucleus/src/backends/wasm.ts        # DX backend eist requesterOid
packages/nucleus/src/runtime/ledger.ts       # context-doorgeven, geen fallback
nucleus-server (later) / TS host             # UAL service + storage
```

### Hoe (kort)

1. **Boundary hardening** – alle wasm/http entrypoints vragen `requester_oid`; calls zonder context worden geweigerd.
2. **Host UAL** – eenvoudige grant/check/list die vóór de ledger-call beslist (Drizzle/SQL of memory).
3. **Context-doorleiding** – DX API neemt `context` met `requesterOid`; standaard zonder context = throw.
4. **Tests** – negatieve paden (geen requesterOid → fout), positieve paden met grants; wasm-integra-tietest.

**Tijdsduur:** 2 weken

---
## Fase 6.3: Database Adapters & Persistence

### Waarom

- Integriteit en persistence horen in Rust; geen TS-adapters.
- Bij load moet de chain opnieuw geverifieerd worden (hash-reconstructie).
- Database-locatie: in de host (server of embedded) maar altijd Rust-side voor snelheid en correctness.

### Wat

- `StorageBackend` trait in Rust met volledige reconstructie (hash, prev_hash, ordering).
- SQLite-implementatie (prioriteit) + interface voor Postgres (optioneel later).
- Engine start laadt alle entries, verifieert de keten en faalt bij inconsistenties.
- WASM/HTTP blijven pass-through; TS-config geeft alleen storage-keuze door (geen eigen opslaglaag).

### Waar

```
crates/nucleus-engine/src/storage/         # trait + sqlite adapter
crates/nucleus-engine/src/engine.rs        # load/verify/append met storage
crates/nucleus-wasm/src/ledger.rs          # optionele storage-config passthrough
packages/nucleus/src/backends/wasm.ts      # config doorgeven, geen opslag in TS
```

### Hoe (kort)

1. **Trait + schema** – definieer leesbare/appendbare struct waarop hash en prev_hash herleid kunnen worden.
2. **SQLite adapter** – implementeer save/load/load_all + integriteitscheck die hashes herberekent.
3. **Engine integratie** – bij init: load + verify; bij append: persist en rollback/bubble bij fout.
4. **Tests** – end-to-end: append → persist → restart → verify; corruptie-test moet falen.

**Tijdsduur:** 2-3 weken (incl. integriteitstests)

---
## Fase 6.4: Authentication & Request Context

### Waarom

- UAL en auditing hebben een betrouwbare `requester_oid` nodig.
- Auth hoort bij de host (server of TS entrypoint), niet in de Rust core.

### Wat

- RequestContext types + helpers in TS DX, maar geen auth in core.
- Middleware/factory (host-side) die tokens controleert en `requesterOid` verplicht maakt richting ledger-calls.
- Doorsturen van context via wasm/http backends; calls zonder context worden geweigerd.

### Waar

```
packages/nucleus/src/context/               # RequestContext + helpers
packages/nucleus/src/backends/wasm.ts       # vereist requesterOid in API
nucleus-server (later) / TS host            # auth middleware + token handling
```

### Hoe (kort)

1. **Context type** – definieer `RequestContext` en `requireRequesterOid(ctx)` helper.
2. **Middleware** – simpele Bearer/Dev token parser (host), valideert OID en plakt context.
3. **Propagation** – wasm/http backend methodes nemen context verplicht over; DX API zonder context throwt.
4. **Tests** – unit (parsing/validation) + integration (call zonder context faalt, met context slaagt).

**Tijdsduur:** 1 week

---
## Testing Strategie

### Unit Tests

- Rust module registry: lifecycle + handle retrieval
- UAL host service: grant/check/list, weigert zonder requesterOid
- Storage: save/load/load_all + hash-verify op load
- Auth middleware: token parsing + OID validation helpers

### Integration Tests

- Wasm/http entrypoints weigeren calls zonder requesterOid
- Host UAL + wasm backend: grant → query/append
- Engine + storage: append → persist → reload → verify
- Context-propagation in TS DX (context in, context required)

### E2E Tests

- Complete flow: create ledger → grant → query with ACL (met/zonder requesterOid)
- Persistence: append → restart → verify chain
- Auth → context → UAL → ledger call (happy + unhappy path)

---

## Success Criteria

### Fase 6.1: Module Handles & Registry ✅

- [ ] Module handles beschikbaar via Rust registry (per-ledger scope)
- [ ] Geen TS-side container of globals
- [ ] Lifecycle hooks getest (init/start/stop) in Rust + wasm rooktest
- [ ] TS runtime expose’t alleen readonly handles

### Fase 6.2: UAL ✅

- [ ] requesterOid verplicht in wasm/http API
- [ ] Host UAL blokkeert onbevoegde reads/writes
- [ ] TS DX weigert calls zonder context
- [ ] Positieve/negatieve ACL-tests slagen

### Fase 6.3: Database Persistence ✅

- [ ] Storage trait implementeert save/load/load_all + verify
- [ ] Engine verifieert chain bij start en faalt bij corruptie
- [ ] SQLite adapter werkt end-to-end (append → restart → verify)
- [ ] Tests slagen

### Fase 6.4: Authentication ✅

- [ ] RequestContext enforced richting ledger-calls
- [ ] Token parsing/validation werkt (host)
- [ ] Calls zonder context falen in DX API
- [ ] Tests slagen

---

## Risico's & Mitigatie

### Risico 1: Database Performance

**Risico:** Database calls kunnen performance bottleneck worden  
**Mitigatie:**

- Gebruik connection pooling
- Implementeer caching waar mogelijk
- Batch operations waar mogelijk

### Risico 2: UAL Complexity

**Risico:** UAL implementatie kan complex worden  
**Mitigatie:**

- Start met simpele implementatie
- Iteratief uitbreiden
- Goede test coverage

### Risico 3: Storage Migration

**Risico:** Migratie van in-memory naar persistent kan breaking changes veroorzaken  
**Mitigatie:**

- Storage is optioneel (backward compatible)
- Goede error handling
- Migration scripts

---

## Conclusie

Dit implementatieplan volgt de Rust-first architectuur en adresseert de kritieke gaps:

1. **Module Handles & Registry (Rust)** - Lifecycle & scope per ledger, geen TS-DI
2. **UAL aan de host-grens** - Privacy/security met verplichte requesterOid
3. **Database Persistence (Rust)** - Integriteit + herverifiëren bij load
4. **Authentication & Context (host)** - Context afdwingen richting ledger-calls

**Totaal tijdsduur:** ~6-10 weken

**Belangrijk:** Volg deze volgorde voor afhankelijkheden:

- Module registry/handles → UAL (UAL verwacht per-ledger scope)
- UAL → Authentication (ACL checks hebben requesterOid nodig)
- Database Persistence kan parallel (onafhankelijk)

---

_Fase 6 Implementatieplan: Kritieke Missing Features_
