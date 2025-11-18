# WASM Tests

## Overzicht

De WASM bindings hebben twee soorten tests:

1. **Unit tests** (`wasm_unit.rs`) - Testen de WASM bindings logica zonder browser
2. **E2E tests** (`wasm_e2e.rs`) - Volledige browser/Node.js tests met wasm-bindgen-test

## Unit Tests

De unit tests kunnen **niet** direct uitgevoerd worden omdat ze wasm-bindgen functies aanroepen die alleen in een WASM omgeving werken.

## E2E Tests (Browser/Node.js)

De E2E tests moeten uitgevoerd worden in een browser of Node.js omgeving:

### Browser Tests

```bash
# Installeer wasm-pack (als nog niet gedaan)
cargo install wasm-pack

# Build WASM
cd nucleus-wasm
wasm-pack build --target web

# Run tests in browser
wasm-pack test --headless --firefox
# of
wasm-pack test --headless --chrome
```

### Node.js Tests

```bash
wasm-pack build --target nodejs
wasm-pack test --node
```

## Test Coverage

De tests dekken:

- ✅ WasmLedger creation
- ✅ Record appending
- ✅ Record retrieval (by hash, by ID)
- ✅ Query operations
- ✅ Batch operations
- ✅ Chain verification
- ✅ Latest hash
- ✅ WasmRecord helpers
- ✅ Error handling
- ✅ Large chains (100+ entries)
- ✅ Mixed streams

## Verificatie

De WASM code compileert correct naar `wasm32-unknown-unknown`, wat betekent dat:

- Alle bindings syntactisch correct zijn
- Alle types correct zijn geconfigureerd
- De WASM output kan worden gebruikt in browser/Node.js

Voor volledige E2E verificatie, voer de tests uit in een browser of Node.js omgeving zoals hierboven beschreven.
