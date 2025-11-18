# Nucleus Monorepo - Gecorrigeerde Analyse (Crates = Nieuw)

**Datum**: 18 november 2025  
**Versie**: 0.1.0 (GECORRIGEERD)  
**Status**: Actieve Rust-based implementatie

---

## 🎯 BELANGRIJKE CORRECTIE

**VERKEERDE AANNAME**: Ik analyseerde beide `ledger/` en `crates/` als actief.

**CORRECTE SITUATIE**:

- ✅ **`crates/`** = **NIEUWE**, actieve Rust implementatie
- ✅ **`packages/nucleus/`** = **NIEUWE** TypeScript DX wrapper (gebruikt WASM)
- ❌ **`ledger/`** = **OUDE**, legacy TypeScript implementatie

---

## 📋 Executive Summary

De Nucleus monorepo is in **transitie** van een TypeScript-based naar een **Rust-based** ledger engine. De actieve development gebeurt in:

1. **`crates/`** - Pure Rust core engine (3 crates)
2. **`packages/nucleus/`** - TypeScript DX layer (WASM wrapper)

De `ledger/` directory bevat de **legacy** TypeScript implementatie.

---

## 🏗️ Actieve Architectuur

### Huidige Structuur (Actief)

```
nucleus/
├── crates/                 # ✅ ACTIEF - Rust core
│   ├── Cargo.toml         # Workspace configuratie
│   ├── nucleus-core/      # Pure ledger logic
│   ├── nucleus-engine/    # Runtime wrapper
│   └── nucleus-wasm/      # WASM bindings
│
├── packages/              # ✅ ACTIEF - TypeScript wrapper
│   └── nucleus/           # @onoal/nucleus DX layer
│
├── ledger/                # ❌ LEGACY - Oude TypeScript implementatie
│   └── [18+ packages]     # Te deprecaten/archiveren
│
├── package.json           # Root config (minimaal)
└── pnpm-lock.yaml        # pnpm lockfile
```

### Architecture Layers (Actief Systeem)

```
┌─────────────────────────────────────────────┐
│   TypeScript Developer Experience           │
│   (@onoal/nucleus)                          │
│   - Factory pattern: createLedger()         │
│   - Builder pattern: ledgerBuilder()        │
│   - Module helpers: proofModule(), etc.     │
├─────────────────────────────────────────────┤
│   WASM Bindings                             │
│   (nucleus-wasm)                            │
│   - WebAssembly exports                     │
│   - JS interop via wasm-bindgen             │
├─────────────────────────────────────────────┤
│   Rust Engine Layer                         │
│   (nucleus-engine)                          │
│   - State management                        │
│   - Query system                            │
│   - Module registry                         │
├─────────────────────────────────────────────┤
│   Rust Core Layer                           │
│   (nucleus-core)                            │
│   - Pure logic, no I/O                      │
│   - Hash chain verification                 │
│   - Record types                            │
└─────────────────────────────────────────────┘
```

---

## 🦀 Rust Workspace (Actief - `crates/`)

### Workspace Configuratie

**Locatie**: `crates/Cargo.toml`  
**Members**:

- `nucleus-core`
- `nucleus-engine`
- `nucleus-wasm`
- ~~`nucleus-server`~~ (TODO: commented out)

**Resolver**: Cargo v2

**Workspace Dependencies**:

```toml
serde = "1.0" (with derive)
serde_json = "1.0"
thiserror = "1.0"
sha2 = "0.10"
hex = "0.4"
```

**Workspace Metadata**:

```toml
version = "0.1.0"
edition = "2021"
authors = ["Onoal Team"]
license = "MIT"
repository = "https://github.com/onoal/nucleus"
```

---

### Crate 1: `nucleus-core` ✅

**Doel**: Pure ledger engine zonder I/O dependencies

**Modules**:

- `record` - Record types
- `hash` - Hash utilities (SHA-256)
- `anchor` - Anchoring logic
- `error` - Error types (thiserror)
- `serialization` - Canonical serialization
- `hash_chain` - Chain verification
- `module` - Module system

**Exports**:

```rust
pub use record::Record;
pub use hash::Hash;
pub use error::CoreError;
pub use serialization::{serialize_canonical, compute_hash};
pub use hash_chain::{ChainEntry, verify_chain, ChainError};
pub use module::{Module, ModuleConfig};
```

**Tests**:

- `tests/core_e2e.rs`
- `tests/integration/`

**Status**: ✅ Basis implementatie compleet

---

### Crate 2: `nucleus-engine` ✅

**Doel**: Stateful wrapper om nucleus-core met runtime features

**Modules**:

- `config` - Engine configuratie
- `engine` - Main engine implementation
- `error` - Engine error types
- `state` - State management
- `module_registry` - Module registratie
- `query` - Query systeem

**Dependencies**:

```toml
nucleus-core = { path = "../nucleus-core" }
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
```

**Tests**:

- `tests/engine_e2e.rs`
- `tests/integration/`

**Status**: ✅ Basis implementatie compleet

---

### Crate 3: `nucleus-wasm` ✅

**Doel**: WebAssembly bindings voor browser/Node.js

**Build Type**: `cdylib` + `rlib`

**Dependencies**:

```toml
nucleus-engine = { path = "../nucleus-engine" }
nucleus-core = { path = "../nucleus-core" }
wasm-bindgen = "0.2"
serde-wasm-bindgen = "0.6"
js-sys = "0.3"
wasm-bindgen-futures = "0.4"
console_error_panic_hook = "0.1"
```

**Build Optimizations**:

```toml
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-time optimization
```

**Modules**:

- `error` - WASM error handling
- `ledger` - WASM ledger interface
- `record` - WASM record types
- `lib` - Main WASM exports

**Build Script**: `build.sh`

**Output**: `pkg/` directory met WASM + JS bindings

**Tests**:

- `tests/wasm_e2e.rs`
- `tests/wasm_unit.rs`

**TypeScript Types**: `types/` directory

**Status**: ✅ Basis implementatie compleet

---

## 📦 TypeScript Wrapper (Actief - `packages/nucleus/`)

### Package: `@onoal/nucleus`

**Beschrijving**: TypeScript DX Layer voor Nucleus Engine

**Dependencies**:

```json
{
  "dependencies": {
    "@onoal/nucleus-wasm": "workspace:*"
  }
}
```

**Hoofdstructuur**:

```
packages/nucleus/src/
├── backends/
│   ├── index.ts       # Backend abstraction
│   └── wasm.ts        # WASM backend implementation
├── modules/
│   └── index.ts       # Module helpers (proofModule, assetModule)
├── types/
│   ├── backend.ts     # Backend types
│   ├── ledger.ts      # Ledger interface
│   ├── module.ts      # Module types
│   ├── record.ts      # Record types
│   └── wasm.d.ts      # WASM type declarations
├── builder.ts         # LedgerBuilder (fluent API)
├── factory.ts         # createLedger() factory
└── index.ts           # Main exports
```

**API Patterns**:

#### 1. Factory Pattern

```typescript
import { createLedger, proofModule } from "@onoal/nucleus";

const ledger = await createLedger({
  id: "my-ledger",
  backend: { mode: "wasm" },
  modules: [proofModule()],
});
```

#### 2. Builder Pattern

```typescript
import { ledgerBuilder } from "@onoal/nucleus";

const ledger = await ledgerBuilder("my-ledger")
  .withWasmBackend()
  .withModule(proofModule())
  .withStrictValidation()
  .build();
```

**Test Suite**:

- `__tests__/builder.test.ts`
- `__tests__/factory.test.ts`
- `__tests__/modules.test.ts`
- `__tests__/types.test.ts`

**Examples**:

- `examples/basic-usage.ts`
- `examples/builder-pattern.ts`

**Status**: ✅ DX layer compleet, actief in gebruik

---

## ❌ Legacy Code (`ledger/`)

### Status: OUDE IMPLEMENTATIE

**Waarschijnlijk scenario**: De `ledger/` directory bevat de **originele TypeScript implementatie** die nu vervangen wordt door de Rust implementatie.

**Packages in `ledger/`** (18+):

- `framework/` - Oude TypeScript core
- `database/` adapters (postgres, sqlite, d1)
- `modules/` (proof, asset, connect, token, payment, mesh)
- `plugins/`
- `client/`, `cli/`, `test/`, `docs/`

### Vragen over Legacy Code

❓ **Is `ledger/` nog in gebruik?**

- Als NEE → Kan gearchiveerd/verwijderd worden
- Als JA (parallel) → Migratie planning nodig

❓ **Welke features uit `ledger/` moeten naar Rust?**

- Database adapters?
- Module implementaties?
- Plugin systeem?

❓ **Docs site (`ledger/docs/`)?**

- Moet dit blijven/geüpdatet worden voor Rust versie?

---

## 🔗 Dependency Graph (Actief Systeem)

```
Rust Crates:
nucleus-core (pure logic, no I/O)
    ↓
nucleus-engine (stateful, queries)
    ↓
nucleus-wasm (WASM bindings)
    ↓
@onoal/nucleus (TypeScript DX layer)
    ↓
End-user applications
```

**Externe Dependencies**:

**Rust**:

- Crypto: `sha2`, `hex`
- Serialization: `serde`, `serde_json`
- Errors: `thiserror`
- WASM: `wasm-bindgen`, `js-sys`, `wasm-bindgen-futures`

**TypeScript**:

- Build: `typescript`, `jest`, `ts-jest`
- Linting: `eslint`, `@typescript-eslint/*`

---

## 🎯 Wat Ontbreekt (Gecorrigeerde Lijst)

### 🔴 KRITIEK: Workspace Configuratie

#### 1. `pnpm-workspace.yaml` ⚠️ **URGENT**

**Voor actieve packages**:

```yaml
packages:
  - "packages/*"
  # Optioneel: als legacy code nog gebruikt wordt
  # - 'ledger/*'
```

**Minimale versie** (alleen actief):

```yaml
packages:
  - "packages/*"
```

---

#### 2. `turbo.json` ⚠️ **BELANGRIJK**

**Minimale config** (voor TypeScript build):

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

#### 3. Root `package.json` (Volledig) ⚠️ **BELANGRIJK**

**Huidige staat**: Alleen turbo dependency

**Moet worden**:

```json
{
  "name": "@onoal/nucleus-monorepo",
  "version": "0.1.0",
  "private": true,
  "description": "Nucleus - Canonical ledger engine (Rust + TypeScript)",
  "scripts": {
    "build": "pnpm build:wasm && turbo build",
    "build:wasm": "cd crates/nucleus-wasm && ./build.sh",
    "dev": "turbo dev",
    "test": "pnpm test:rust && turbo test",
    "test:rust": "cd crates && cargo test",
    "test:wasm": "cd crates/nucleus-wasm && wasm-pack test --node",
    "lint": "turbo lint && cargo clippy",
    "typecheck": "turbo typecheck",
    "format": "prettier --write . && cargo fmt",
    "format:check": "prettier --check . && cargo fmt --check",
    "clean": "turbo clean && cargo clean",
    "wasm": "cd crates/nucleus-wasm && ./build.sh"
  },
  "devDependencies": {
    "turbo": "^2.6.1",
    "prettier": "^3.0.0"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

### 🟠 HOOG: Rust Development

#### 4. `rust-toolchain.toml`

```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
targets = ["wasm32-unknown-unknown"]
```

---

#### 5. `.cargo/config.toml`

```toml
[build]
target-dir = "target"

[target.wasm32-unknown-unknown]
runner = 'wasm-bindgen-test-runner'

[alias]
wasm = "build --target wasm32-unknown-unknown --release"
```

---

### 🟠 HOOG: Development Workflow

#### 6. `README.md` (Root)

**Moet bevatten**:

- Project overview (Rust-based ledger engine)
- Quick start (installatie + build)
- Architecture (4 layers: core, engine, WASM, TS)
- Development guide
- Verwijzing naar `ledger/` als legacy (indien nog relevant)

---

#### 7. `LICENSE`

MIT license bestand (zoals gespecificeerd in Cargo.toml)

---

#### 8. `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,ts,tsx,json,yml,yaml}]
indent_style = space
indent_size = 2

[*.rs]
indent_style = space
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

---

#### 9. `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80
}
```

---

#### 10. `.nvmrc`

```
20.0.0
```

---

### 🟡 MIDDEL: CI/CD

#### 11. `.github/workflows/ci.yml`

**Test matrix**:

- Rust tests (cargo test)
- WASM tests (wasm-pack test)
- TypeScript tests (pnpm turbo test)
- Linting (cargo clippy + eslint)
- Formatting (cargo fmt + prettier)

---

#### 12. `.github/workflows/publish.yml`

**Publishing**:

- Crates.io (nucleus-core, nucleus-engine)
- NPM (nucleus-wasm pkg, @onoal/nucleus)

---

### 🟡 MIDDEL: Documentation

#### 13. `ARCHITECTURE.md`

Uitleg van 4-layer architectuur

---

#### 14. `CONTRIBUTING.md`

Development setup voor Rust + TypeScript

---

#### 15. `MIGRATION.md` (optioneel)

Als `ledger/` actief vervangen wordt: migratie guide

---

### 🟢 LAAG: Nice-to-have

#### 16. `.vscode/` settings

Rust Analyzer + TypeScript setup

---

#### 17. `.devcontainer/`

Dev container met Rust + Node.js

---

#### 18. `Makefile`

Common tasks helper

---

## 📊 Workspace Dependencies Status

### Actief Systeem

**Rust → Rust**:

- ✅ `nucleus-core` ← standalone
- ✅ `nucleus-engine` ← depends on `nucleus-core`
- ✅ `nucleus-wasm` ← depends on `nucleus-engine` + `nucleus-core`

**TypeScript → Rust**:

- ✅ `@onoal/nucleus` ← depends on `@onoal/nucleus-wasm`

**Missing Link**:

- ❓ `@onoal/nucleus-wasm` package.json ontbreekt?
  - Of is dit gegenereerd door wasm-pack?
  - Check: `crates/nucleus-wasm/pkg/` na build

---

## 🚨 Kritieke Vragen

### 1. Legacy Code Status

**Vraag**: Wat is de status van `ledger/` directory?

**Opties**:

- A) **Volledig deprecated** → Archiveer/verwijder
- B) **Parallel development** → Migratie plan nodig
- C) **Docs/tools blijven** → Alleen core vervangen

**Actie**: Bepaal strategie

---

### 2. WASM Package Publishing

**Vraag**: Hoe wordt `@onoal/nucleus-wasm` gepubliceerd?

**Opties**:

- A) Via `wasm-pack build` → genereert package.json
- B) Handmatige package.json in crates/nucleus-wasm/
- C) Nog niet geconfigureerd

**Check**:

```bash
cd crates/nucleus-wasm
./build.sh
ls pkg/  # Moet package.json bevatten
```

---

### 3. Monorepo Scope

**Vraag**: Wat moet in de workspace?

**Opties**:

- A) **Minimaal**: Alleen `packages/nucleus/`
- B) **Selectief**: Nucleus + relevante ledger packages
- C) **Alles**: Alle ledger packages

**Aanbeveling**: Start minimaal (A), expand indien nodig

---

## 🎯 Gecorrigeerde Prioriteiten

### Sprint 1: Foundation (KRITIEK - 2 uur)

**Focus**: Alleen actieve packages

1. ✅ `pnpm-workspace.yaml` (minimaal: `packages/*`)
2. ✅ `turbo.json` (basic pipeline)
3. ✅ Root `package.json` (met Rust + TS scripts)
4. ✅ `rust-toolchain.toml`
5. ✅ `.nvmrc`
6. ✅ `README.md` (Rust-focused)
7. ✅ `LICENSE`

**Commands na Sprint 1**:

```bash
# Install dependencies
pnpm install

# Build WASM
pnpm build:wasm

# Build TypeScript
pnpm build

# Test everything
pnpm test
```

---

### Sprint 2: Development Workflow (4 uur)

8. ✅ `.editorconfig`
9. ✅ `.prettierrc` + `.prettierignore`
10. ✅ `.cargo/config.toml`
11. ✅ `Makefile` (Rust + TS tasks)
12. ✅ `.vscode/` (Rust Analyzer + TS)

---

### Sprint 3: CI/CD (6 uur)

13. ✅ `.github/workflows/ci.yml`
14. ✅ `.github/workflows/publish.yml`
15. ✅ `.github/dependabot.yml` (Cargo + npm)

---

### Sprint 4: Documentation (4 uur)

16. ✅ `ARCHITECTURE.md`
17. ✅ `CONTRIBUTING.md`
18. ✅ `CHANGELOG.md`
19. ✅ Optioneel: `MIGRATION.md` (als ledger/ deprecated wordt)

---

## 📝 Legacy Code Strategie

### Optie A: Volledige Deprecation

**Als `ledger/` volledig vervangen wordt**:

1. **Maak `ledger/README.md`**:

```markdown
# Legacy Implementation (DEPRECATED)

This directory contains the original TypeScript implementation of the Nucleus ledger engine.

**Status**: DEPRECATED - Replaced by Rust implementation in `/crates`

**Replacement**: Use `@onoal/nucleus` package which wraps the Rust core

See `/packages/nucleus/` for the new TypeScript API.
```

2. **Update `.gitignore`**:

```
# Legacy code (not actively developed)
ledger/**/node_modules
ledger/**/dist
```

3. **Optioneel**: Verplaats naar `legacy/` directory

---

### Optie B: Selectieve Behoud

**Als bepaalde tools blijven** (bijv. docs, CLI):

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "ledger/docs"
  - "ledger/cli"
  # Deprecated:
  # - 'ledger/framework'
  # - 'ledger/modules/*'
```

---

### Optie C: Parallelle Ontwikkeling

**Als beide systemen actief blijven** (niet aanbevolen):

Duidelijke namespace scheiding:

- `@onoal/nucleus` (Rust-based, nieuw)
- `@onoal/ledger-*` (TS-based, legacy)

---

## 🏆 Conclusie (Gecorrigeerd)

### Huidige Status

**Actief Systeem**:

- ✅ Rust core implementatie (crates/) is compleet
- ✅ TypeScript DX layer (packages/nucleus/) is compleet
- ✅ WASM bindings zijn compleet
- ❌ Workspace configuratie ontbreekt

**Legacy Systeem**:

- ❓ Status van `ledger/` onduidelijk
- ❓ Deprecation strategie onbekend

### Wat Nu Te Doen

#### Stap 1: Clarificatie (5 min)

**Beantwoord**:

1. Is `ledger/` volledig deprecated? JA/NEE
2. Worden er nog packages uit `ledger/` gebruikt? WELKE?
3. Moet docs site (`ledger/docs/`) blijven? JA/NEE

#### Stap 2: Workspace Setup (30 min)

**Minimale versie** (alleen actief):

```bash
# 1. Maak pnpm-workspace.yaml
# 2. Maak turbo.json
# 3. Update root package.json
# 4. Test: pnpm install && pnpm build
```

#### Stap 3: Documentatie (1 uur)

```bash
# 1. README.md met Rust focus
# 2. LICENSE
# 3. .nvmrc
# 4. rust-toolchain.toml
```

---

## 🚀 Implementatie Actie

**Wat wil je dat ik doe?**

### Optie 1: **MINIMALE SETUP** (Aanbevolen, 30 min)

Ik maak:

- `pnpm-workspace.yaml` (alleen `packages/*`)
- `turbo.json` (basic)
- Root `package.json` (volledig, met Rust scripts)
- `rust-toolchain.toml`
- `.nvmrc`

### Optie 2: **COMPLETE FOUNDATION** (Sprint 1, 2 uur)

Optie 1 + :

- `README.md` (Rust-focused)
- `LICENSE`
- `.editorconfig`
- `.prettierrc`

### Optie 3: **EERST CLARIFICATIE**

Beantwoord vragen over `ledger/` status, dan pas implementeren.

---

**Aanbeveling**: Start met **Optie 1** (minimale setup) zodat builds werken, dan Optie 3 voor legacy strategie.

---

**Analyse Gecorrigeerd** | Focus: Rust + Minimal TS | 18 november 2025
