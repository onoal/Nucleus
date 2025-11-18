# Fase 6.1: Module Handles & Registry - Implementatie Start

**Datum**: 18 november 2025  
**Status**: 🚀 IN PROGRESS  
**Geschatte tijd**: 1 week

---

## 📋 Implementatie Plan

### Sprint Overzicht

**Dag 1-2**: Foundation (Stap 1-3)

- ✅ Stap 6.1.1: Module Trait Definition (in progress)
- ⏳ Stap 6.1.2: ModuleRegistry Implementation
- ⏳ Stap 6.1.3: Engine Integration

**Dag 3-4**: Integration & Bindings (Stap 4-5)

- ⏳ Stap 6.1.4: WASM Bindings
- ⏳ Stap 6.1.5: TypeScript DX

**Dag 5**: Testing & Polish (Stap 6-8)

- ⏳ Stap 6.1.6: Unit Tests
- ⏳ Stap 6.1.7: Integration Tests
- ⏳ Stap 6.1.8: Documentation

---

## 🎯 Architectuur Principes

### 1. Scope = Per Ledger

```rust
pub struct LedgerEngine {
    config: LedgerConfig,
    state: LedgerState,
    storage: Option<Box<dyn StorageBackend>>,
    module_registry: ModuleRegistry, // ← Per-ledger, geen globals!
}
```

### 2. Lifecycle Contract

```
register() → init_all() → start_all() → runtime → stop_all()
```

### 3. Rust = Source of Truth

- Module lifecycle in Rust
- TypeScript is readonly proxy
- Geen TS service container

---

## 📝 Stap 6.1.1: Module Trait Definition

### Files te maken:

1. `crates/nucleus-core/src/module/mod.rs` - Module trait + lifecycle
2. `crates/nucleus-core/src/module/context.rs` - Module context
3. `crates/nucleus-core/src/module/error.rs` - Module errors

### Module Trait Interface:

```rust
pub trait Module: Send {
    /// Module unique identifier
    fn id(&self) -> &str;

    /// Module version
    fn version(&self) -> &str;

    /// Initialize module (setup, validate config)
    fn init(&mut self, ctx: &ModuleContext) -> Result<(), ModuleError>;

    /// Start module (begin operations)
    fn start(&mut self, ctx: &ModuleContext) -> Result<(), ModuleError>;

    /// Stop module (cleanup)
    fn stop(&mut self, ctx: &ModuleContext) -> Result<(), ModuleError>;

    /// Module hooks (optional)
    fn before_append(&self, record: &mut Record) -> Result<(), ModuleError> {
        Ok(())
    }

    fn after_append(&self, record: &Record, hash: &Hash) -> Result<(), ModuleError> {
        Ok(())
    }
}
```

---

## 🔍 Wat Er Al Bestaat

### Huidige Structuur:

```
crates/nucleus-core/src/module/
├── mod.rs        - Basis module config (bestaat al)
├── factory.rs    - Module factory (bestaat al)
└── registry.rs   - MIST (gaan we maken)
```

### Wat Goed Is:

- ✅ `ModuleConfig` struct bestaat
- ✅ Basis module factory pattern
- ✅ Module ID + version tracking

### Wat Ontbreekt:

- ❌ Module lifecycle (init/start/stop)
- ❌ Per-ledger registry
- ❌ Type-safe module retrieval
- ❌ Context passing

---

## 📊 Progress Tracking

- [x] Planning compleet
- [ ] Module trait (in progress)
- [ ] Module registry
- [ ] Engine integratie
- [ ] WASM bindings
- [ ] TypeScript DX
- [ ] Tests
- [ ] Documentation

---

**Ready to build!** 🔨
