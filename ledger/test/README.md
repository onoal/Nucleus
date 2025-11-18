# Ledger Framework Tests

Uitgebreide tests voor het Onoal Ledger Framework.

## 📁 Folder Structuur

```
ledger-test/
├── core/                    # Core ledger operations ✅
│   ├── ledger-append.test.ts      (15+ tests)
│   ├── ledger-get.test.ts         (8+ tests)
│   ├── ledger-query.test.ts       (15+ tests)
│   ├── ledger-verify-chain.test.ts (10+ tests)
│   ├── hash-chain.test.ts         (6+ tests)
│   └── service-container.test.ts  (11 tests ✅ passing)
├── module/                  # Module system ✅
│   └── module-system.test.ts      (8+ tests)
├── plugin/                  # Plugin system ✅
│   └── plugin-hooks.test.ts       (10+ tests)
├── ual/                     # Unified Access Layer (TODO)
├── schema/                  # Schema validation (TODO)
├── signer/                  # Signer & JWT (TODO)
├── adapter/                 # Adapters (TODO)
├── server/                  # Server/API (TODO)
├── routes-helpers.test.ts   # Route helpers ✅ (34 tests passing)
├── routes-validation.test.ts # Validation helpers ✅ (28 tests passing)
├── routes-services.test.ts  # Service access helpers ⚠️ (12+ tests - import issues)
└── framework-integration.test.ts # Integration tests ⚠️ (10+ tests - import issues)
```

## ✅ Geïmplementeerd

### Core Tests (`core/`) - 6 files, ~65 tests

- ✅ `ledger-append.test.ts` - Entry toevoegen (basic, schema validation, hooks, streams, meta, JWT, hash linking)
- ✅ `ledger-get.test.ts` - Entry ophalen (by ID, non-existent, all fields, multiple)
- ✅ `ledger-query.test.ts` - Entries queryen (by stream, subject_oid, issuer_oid, status, pagination, filters)
- ✅ `ledger-verify-chain.test.ts` - Hash chain verificatie (complete chain, startId, limit, integrity)
- ✅ `hash-chain.test.ts` - Hash computation en chain integrity
- ✅ `service-container.test.ts` - Service container (registration, resolution, metadata) ✅ **11 tests passing**

### Module Tests (`module/`) - 1 file, ~8 tests

- ✅ `module-system.test.ts` - Module registration, services, routes, dependencies, lifecycle

### Plugin Tests (`plugin/`) - 1 file, ~10 tests

- ✅ `plugin-hooks.test.ts` - beforeAppend, afterAppend, beforeQuery, afterQuery, beforeGet, beforeVerifyChain, multiple plugins

### Route Helpers (Root) - 4 files, 62 tests passing

- ✅ `routes-helpers.test.ts` - 34 tests (json, error, notFound, unauthorized, parseBody, getPagination, getQueryParam) ✅ **passing**
- ✅ `routes-validation.test.ts` - 28 tests (validateRequired, validateOid, validateRange) ✅ **passing**
- ⚠️ `routes-services.test.ts` - 12+ tests (useService, hasService) - **import issues**
- ⚠️ `framework-integration.test.ts` - 10+ tests (complete patterns, real-world scenarios) - **import issues**

## 📊 Status

**Totaal geïmplementeerd: 12 test files, ~174+ tests**

- ✅ **73 tests passing** (routes-helpers + routes-validation + service-container)
- ⚠️ **~101 tests geschreven maar niet draaien** (import issues met `@noble/curves/ed25519.js`)

## ⚠️ Known Issues

### Import Issues

Tests die `ed25519` gebruiken hebben import problemen in Vitest:

- Alle `core/*.test.ts` files (behalve service-container)
- `module/module-system.test.ts`
- `plugin/plugin-hooks.test.ts`
- `routes-services.test.ts`
- `framework-integration.test.ts`

**Oorzaak**: Vitest kan `@noble/curves/ed25519.js` niet correct resolven.

**Workaround**: Vitest configuratie aanpassen (alias toegevoegd, maar werkt nog niet volledig).

## ❌ Nog te implementeren

Zie [TEST_COVERAGE_ANALYSIS.md](./TEST_COVERAGE_ANALYSIS.md) voor volledige lijst.

- UAL tests (`ual/`)
- Schema tests (`schema/`)
- Signer tests (`signer/`)
- Adapter tests (`adapter/`)
- Server tests (`server/`)

## 🚀 Running Tests

```bash
# Run all tests
pnpm test

# Run specific category
pnpm test core/
pnpm test module/
pnpm test plugin/

# Run specific test file
pnpm test core/service-container.test.ts

# Run passing tests only
pnpm test routes-helpers.test.ts routes-validation.test.ts core/service-container.test.ts

# Run in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

## 📈 Test Coverage

Zie [TEST_COVERAGE_ANALYSIS.md](./TEST_COVERAGE_ANALYSIS.md) voor volledige analyse.

**Huidige coverage:**

- ✅ Route helpers: 100% (34/34 tests)
- ✅ Validation helpers: 100% (28/28 tests)
- ✅ Service container: 100% (11/11 tests)
- ⚠️ Core operations: Tests geschreven maar niet draaien
- ⚠️ Module system: Tests geschreven maar niet draaien
- ⚠️ Plugin system: Tests geschreven maar niet draaien

## 📝 Documentatie

- [TEST_COVERAGE_ANALYSIS.md](./TEST_COVERAGE_ANALYSIS.md) - Volledige coverage analyse
- [TEST_IMPLEMENTATION_STATUS.md](./TEST_IMPLEMENTATION_STATUS.md) - Implementatie status
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Samenvatting

## 🎯 Next Steps

1. **Fix import issues** - Zorg dat alle geschreven tests kunnen draaien
2. **Implementeer UAL tests** - Kritiek voor access control
3. **Implementeer Schema tests** - Belangrijk voor validatie
4. **Implementeer Signer tests** - Belangrijk voor security
5. **Implementeer Adapter tests** - Belangrijk voor database compatibility
6. **Implementeer Server tests** - Belangrijk voor API
