# Nucleus Engine – Fase 6.1 Roadmap (Rust-first Module Registry & Handles) – Uitgebreid

## Overzicht

**Doel:** Een per-ledger module registry in Rust (nucleus-engine) met lifecycle (init/start/stop), typed handles via WASM/HTTP, en een readonly TS DX-proxy. Geen TS-DI-container, geen globals; scope is altijd de ledger-instantie.  
**Tijdsduur:** ~1 week implementatie + 1-2 dagen tests/documentatie.  
**Architectuurprincipe:** Integriteit en module-lifecycle leven in Rust; TypeScript is configuratie en proxy, nooit een tweede container of engine.

---

## Stap 6.1.1 – Scope & Contract

### Waarom

Zonder expliciet contract sluipt er opnieuw een TS-service-container of globale state in. Dit borgt de Rust-first scheiding.

### Wat

- Definieer lifecycle contract voor modules: `register` → `init_all` → `start_all` → runtime → `stop_all`.
- Scope = per ledger: registry is een veld op `LedgerEngine`, geen statics of singletons.
- Module-ID’s moeten uniek per ledger; errors refereren de module-id.

### Waar

```
crates/nucleus-engine/src/module_registry.rs   # contract + implementatie
crates/nucleus-engine/src/engine.rs            # init/start/stop integratie
ledger/NUCLEUS_ENGINE_ARCHITECTUUR.md          # beknopte contract docs
```

### Deliverable

- Contract paragraaf (korte bullets) in `module_registry.rs` en architectuurdoc.

---

## Stap 6.1.2 – Rust Module Registry Implementatie

### Bestand

`crates/nucleus-engine/src/module_registry.rs`

### Functionaliteit

- Struct `ModuleRegistry` met:
  - `register(id: String, module: Box<dyn Module>) -> Result<(), EngineError>` (duplicate → error met id)
  - Lifecycle: `init_all(ctx)`, `start_all(ctx)`, `stop_all(ctx)`; propagate module-id in error.
  - Lookup: `get<T: Module>(&self, id: &str) -> Option<&T>` (downcast via `Any`).
  - `list_ids() -> Vec<String>`.
- Metadata: `registered_at: Instant`, module id.
- **Belangrijk:** Per-ledger scope - registry is een veld op `LedgerEngine`, geen statics of singletons.

### Code-schets

```rust
use std::time::Instant;
use std::collections::HashMap;

/// Module metadata
struct ModuleMeta {
    registered_at: Instant,
    module_id: String,
}

/// Module registry - per-ledger scope, geen globals
pub struct ModuleRegistry {
    modules: HashMap<String, Box<dyn Module>>,
    meta: HashMap<String, ModuleMeta>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
            meta: HashMap::new(),
        }
    }

    pub fn register(&mut self, id: impl Into<String>, module: Box<dyn Module>) -> Result<(), EngineError> {
        let id = id.into();
        if self.modules.contains_key(&id) {
            return Err(EngineError::ModuleAlreadyRegistered(id));
        }
        self.meta.insert(id.clone(), ModuleMeta {
            registered_at: Instant::now(),
            module_id: id.clone(),
        });
        self.modules.insert(id, module);
        Ok(())
    }

    /// Initialize all modules (lifecycle hook)
    pub fn init_all(&mut self, ctx: &mut ModuleContext) -> Result<(), EngineError> {
        for (id, module) in self.modules.iter_mut() {
            module.init(ctx).map_err(|e| EngineError::ModuleInit {
                id: id.clone(),
                source: e
            })?;
        }
        Ok(())
    }

    /// Start all modules (lifecycle hook)
    pub fn start_all(&mut self, ctx: &mut ModuleContext) -> Result<(), EngineError> {
        for (id, module) in self.modules.iter_mut() {
            module.start(ctx).map_err(|e| EngineError::ModuleStart {
                id: id.clone(),
                source: e
            })?;
        }
        Ok(())
    }

    /// Stop all modules (lifecycle hook, best-effort)
    pub fn stop_all(&mut self, ctx: &mut ModuleContext) -> Result<(), EngineError> {
        for (id, module) in self.modules.iter_mut() {
            if let Err(e) = module.stop(ctx) {
                // best-effort: log en ga verder
                tracing::warn!(module_id = %id, error = ?e, "module stop failed");
            }
        }
        Ok(())
    }

    /// Get module by ID with type downcast
    pub fn get<T: Module>(&self, id: &str) -> Option<&T> {
        self.modules.get(id)?.as_ref().as_any().downcast_ref::<T>()
    }

    /// List all module IDs
    pub fn list_ids(&self) -> Vec<String> {
        self.modules.keys().cloned().collect()
    }
}
```

**Notitie:** `ModuleContext` moet worden gedefinieerd in `nucleus-core` of `nucleus-engine` om modules toegang te geven tot de ledger state tijdens lifecycle hooks.

### Tests (Rust unit)

- Duplicate registratie → `EngineError::ModuleAlreadyRegistered` met id.
- `init_all`/`start_all` roepen modules in volgorde; fout bubbelt met module-id.
- `get` downcast werkt voor concreet module type; `list_ids` bevat alle ids.
- `stop_all` logt waarschuwing op fout, maar panikeert niet.

---

## Stap 6.1.3 – Integratie in `LedgerEngine`

### Bestand

`crates/nucleus-engine/src/engine.rs`

### Acties

- Voeg `module_registry: ModuleRegistry` veld toe (per-ledger scope, geen static).
- Bij `new()`/`new_with_config`:
  - Registreer modules uit config.
  - Roep `init_all` + `start_all` na state-init (met ModuleContext).
  - Errors bevatten module-id voor debugging.
- Bij drop/shutdown: `stop_all` best-effort (logt waarschuwingen, panikeert niet).
- Expose `module_registry()` read-only accessor (voor wasm binding).
- **Belangrijk:** Geen globals of singletons - elke `LedgerEngine` heeft eigen registry.

### Tests (Rust integration)

- Engine start roept init/start van alle modules (volgorde = registratie).
- Fout in init → init stopt, error bevat module-id.
- Stop wordt aangeroepen bij drop in happy pad (verifieer via mock module).

---

## Stap 6.1.4 – WASM: Handles exposen, geen container

### Bestand

`crates/nucleus-wasm/src/ledger.rs`

### Acties

- Expose functions:
  - `list_modules() -> JsValue` (Vec<String>)
  - `get_module_handle(id: String) -> JsValue` (typed handle per bekend module-type; unknown → JS error)
- Gebruik per-ledger registry via engine accessor; geen statics.
- Geen export van maps/registries; alleen handle-API van modules.

### Tests (wasm rook)

- `new(config)` → `list_modules` geeft ids.
- `get_module_handle("asset")` retourneert bruikbare handle (fixture call).
- Onbekende id → nette JS-fout.

---

## Stap 6.1.5 – TS runtime proxy (readonly)

### Bestand

`packages/nucleus/src/runtime/ledger.ts`

### Acties

- `ledger.modules` proxy (readonly, geen register API):
  - `list(): Promise<string[]>` → backend.listModules()
  - `get<T>(id: string): Promise<T>` → backend.getModuleHandle(id) (throw bij onbekend)
- **Geen `register/get` API in TS** - dit voorkomt een tweede DI-container.
- Geen caching buiten instance - alle calls gaan direct naar Rust via WASM.
- Types: helpers voor bekende modules (asset/proof) voor DX.
- **Belangrijk:** TS is alleen proxy, geen eigen service container of registry.

### TS-code-schets

```typescript
export class LedgerRuntime {
  constructor(private backend: Backend) {}

  async listModules(): Promise<string[]> {
    return this.backend.listModules();
  }

  async getModule<T = unknown>(id: string): Promise<T> {
    return this.backend.getModuleHandle<T>(id); // throw bij onbekend
  }
}
```

### Tests (TS unit/integration)

- listModules passthrough naar backend.
- getModule bekend id → handle terug (mock backend).
- getModule onbekend id → throw.
- **Geen register API aanwezig** - verifieer dat er geen `register()` of `getService()` methodes zijn.
- Alle calls gaan direct naar WASM backend, geen lokale caching of state.

---

## Stap 6.1.6 – Cleanup & Documentatie

### Acties

- **Verwijder of markeer oude TS-DI referenties (legacy)** - verwijs naar Rust registry.
- **Update `ledger/NUCLEUS_ENGINE_ARCHITECTUUR.md`** met paragraaf "Module registry in Rust; TS is proxy".
- **DX README snippet** over module handles (geen DI, geen service container).
- Documenteer per-ledger scope en lifecycle hooks (init/start/stop).

### Deliverables

- Korte docsectie in architectuur en DX README.
- (Optioneel) `packages/nucleus/examples/module-handles.ts` met list/get demo via wasm/http.
- **Belangrijk:** Duidelijk maken dat TS geen eigen DI-container heeft - alles gaat via Rust registry.

---

## Stap 6.1.7 – Testmatrix (samenvatting)

- **Rust unit:** register/get/list, duplicate error, lifecycle hooks (init/start/stop), error bubble met module-id.
- **Rust integration:** engine init/start/stop roept modules in volgorde; error bevat module-id; per-ledger scope (twee engines = twee registries).
- **WASM rook:** list/get handle, unknown-id error; geen service map export.
- **TS unit/integration:** proxy gedrag, error paden, module handle call via mock wasm backend; **verifieer geen register/get API**.

---

## Deliverables Checklist

- [ ] `module_registry.rs` met lifecycle hooks (init/start/stop) + typed lookup; per-ledger scope, geen globals.
- [ ] `LedgerEngine` integreert registry (init/start/stop) en gebruikt module-id in errors; per-ledger scope.
- [ ] WASM binding: list/get module handles; geen service maps of registry export.
- [ ] TS runtime proxy: readonly modules API; **geen register/get API**; type helpers voor bekende modules.
- [ ] Documentatie: architectuurparagraaf + DX README snippet over module handles (geen DI, geen TS container).
- [ ] Testset: Rust unit/integration (lifecycle hooks), wasm rook, TS unit/integration (verifieer geen register API).

---

## Planning (indicatief, 1 week + 1-2 dagen QA/doc)

- **Dag 1:** Scope & contract, start implementatie registry (register/get/list, metadata, per-ledger scope).
- **Dag 2:** Lifecycle hooks implementatie (init/start/stop) + unit tests (duplicate, error bubble, module-id in errors).
- **Dag 3:** Integratie in `LedgerEngine` (per-ledger scope); integration tests (init/start/stop volgorde, error bevat module-id).
- **Dag 4:** WASM exposure (list/get handles, geen service maps) + wasm rooktests.
- **Dag 5:** TS runtime proxy (readonly, geen register API) + TS tests; cleanup oude DI-verwijzingen.
- **Dag 6-7:** QA: volledige testmatrix draaien (verifieer geen TS-DI), docs bijwerken, examples toevoegen.

---

## Risico's & Mitigatie

- **Globals/TS-DI sluipt terug:** Contract gedocumenteerd; geen TS register API; PR-review check; tests verifiëren geen register/get API.
- **Lifecycle fouten:** Module-id in errors; integration tests voor init/start/stop volgorde; best-effort stop (logt, panikeert niet).
- **Per-ledger scope vergeten:** Registry is veld op `LedgerEngine`, geen static; tests met meerdere engines verifiëren isolatie.
- **WASM binding kwetsbaarheden:** Alleen handle-API, geen map export; unknown-id errors getest.
- **DX type-ervaring:** Helpers voor bekende modules; tests voor throw op onbekende id.

---

## Conclusie

Fase 6.1 levert een Rust-first module registry met per-ledger scope en typed handles via wasm/http, terwijl de TS-laag een dunne, readonly proxy blijft. Dit voorkomt een tweede container in TypeScript en sluit aan op het architectuurprincipe "integriteit in Rust, DX in TS".

**Belangrijkste principes:**

- ✅ **Per-ledger scope** - Registry is veld op `LedgerEngine`, geen globals
- ✅ **Lifecycle hooks** - init/start/stop voor module lifecycle management
- ✅ **Geen TS-DI** - TypeScript heeft geen eigen service container of register API
- ✅ **Rust-first** - Alle module logic en lifecycle in Rust, TS is alleen proxy
- ✅ **Type-safe handles** - Module handles via WASM met type downcast

**Afhankelijkheden:**

- Fase 6.1 moet klaar zijn voordat Fase 6.2 (UAL) begint (UAL verwacht per-ledger scope)
