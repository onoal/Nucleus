# Ledger Folder - Uitgebreide Analyse

## 📋 Overzicht

De `ledger/` folder bevat een volledig modulair framework voor het bouwen van custom Onoal ledgers met hash-chain integriteit. Het framework volgt enterprise-grade architectuur patronen geïnspireerd door BetterAuth en Medusa.js.

## 🏗️ Structuur & Organisatie

### Hoofd Packages

```
ledger/
├── framework/          # Core framework (@onoal/ledger-core)
├── schema/             # Schema validatie systeem
├── database/           # Database adapters
│   ├── postgres/       # PostgreSQL adapter
│   ├── sqlite/         # SQLite adapter
│   └── cloudflare/d1/  # Cloudflare D1 adapter
├── modules/            # Business logic modules
│   ├── proof/          # Proof management
│   ├── asset/          # Asset management
│   ├── connect/        # Connect grant module
│   └── token/          # Fungible tokens (double-entry)
├── plugins/            # Extensibility plugins
│   ├── analytics/      # Analytics tracking
│   ├── webhook/        # Webhook notifications
│   └── zk/             # Zero-knowledge proofs
├── client/             # Client SDK (@onoal/ledger-sdk)
├── cli/                # CLI tool (create-onoal-ledger)
├── test/               # Test suite
└── docs/               # Documentation site
```

## 🎯 Architectuur Patronen

### 1. Factory Pattern (BetterAuth-stijl)

- `createLedger()` factory functie voor ledger instantiatie
- Configureerbare modules, plugins en adapters
- Type-safe configuratie met TypeScript

### 2. Module System (Medusa.js-stijl)

- **Modules** bieden services, routes en schema extensies
- **Service Container** voor dependency injection
- **Lifecycle hooks**: `load`, `start`, `stop`
- **Route handlers** met type-safe parameters

### 3. Adapter Pattern

- Database abstractions (SQLite, PostgreSQL, D1)
- Uniforme interface via `LedgerDatabase` type
- Provider-specifieke optimalisaties mogelijk

### 4. Plugin System

- **Hooks** voor lifecycle events (beforeAppend, afterAppend)
- **Non-blocking** plugin execution
- **Priority system** voor critical hooks

## 📦 Core Components

### Framework (`ledger/framework/`)

**Package**: `@onoal/ledger-core`

**Belangrijkste exports:**

- `createLedger()` - Factory functie
- `ServiceContainer` - Dependency injection
- `createLedgerServer()` - HTTP server
- `createCustomModule()` - Module builder helper
- Testing utilities (`createTestLedger`, `createTestServer`)

**Kernbestanden:**

- `core/ledger.ts` - Main factory en implementatie
- `core/ledger-core.ts` - Core ledger engine
- `core/hash-chain.ts` - Hash chain verificatie
- `core/service-container.ts` - DI container
- `core/schema.ts` - Schema validatie
- `core/signer.ts` - JWT signing
- `core/ual.ts` - Unified Access Layer

**Dependencies:**

- `@noble/curves` & `@noble/hashes` - Cryptografie
- `drizzle-orm` - Database ORM
- `ajv` - JSON Schema validatie
- `jose` - JWT handling
- `@onoal/core` - Shared utilities

### Schema System (`ledger/schema/`)

**Package**: `@onoal/ledger-schema`

- JSON Schema validatie met AJV
- TypeScript type inference
- Schema extensies via modules

### Database Adapters

#### PostgreSQL (`ledger/database/postgres/`)

- **Package**: `@onoal/ledger-database-postgres`
- **Driver**: `@neondatabase/serverless` (serverless PostgreSQL)
- **ORM**: Drizzle ORM
- **Features**: RETURNING clause support, JSONB voor payloads

#### SQLite (`ledger/database/sqlite/`)

- **Package**: `@onoal/ledger-database-sqlite`
- **Driver**: `better-sqlite3`
- **ORM**: Drizzle ORM
- **Limitaties**: Geen RETURNING clause (extra query nodig)

#### Cloudflare D1 (`ledger/database/cloudflare/d1/`)

- **Package**: `@onoal/ledger-database-cloudflare-d1`
- **Runtime**: Cloudflare Workers
- **ORM**: Drizzle ORM

### Modules

#### Proof Module (`ledger/modules/proof/`)

- **Package**: `@onoal/ledger-module-proof`
- Proof management en verificatie
- JWT-based proofs

#### Asset Module (`ledger/modules/asset/`)

- **Package**: `@onoal/ledger-module-asset`
- Asset tracking en management

#### Connect Module (`ledger/modules/connect/`)

- **Package**: `@onoal/ledger-module-connect`
- Connect grant systeem
- OAuth2-achtige autorisatie

#### Token Module (`ledger/modules/token/`)

- **Package**: `@onoal/ledger-module-token`
- Fungible tokens
- Double-entry accounting
- Balance tracking

### Plugins (`ledger/plugins/`)

**Package**: `@onoal/ledger-plugins`

- **Analytics**: Tracking en metrics
- **Webhook**: Event notifications
- **ZK**: Zero-knowledge proof support

### Client SDK (`ledger/client/`)

**Package**: `@onoal/ledger-sdk`

- Type-safe client voor ledger API
- Request/response types
- Error handling

### CLI Tool (`ledger/cli/`)

**Package**: `create-onoal-ledger`

**Commands:**

- `create-module` - Scaffold nieuwe module
- `db-generate` - Genereer database schema
- `db-migrate` - Run migrations
- `db-push` - Push schema changes
- `db-status` - Check migration status
- `db-validate` - Validate schema
- `dev` - Development server
- `module-list` - List modules
- `module-info` - Module details
- `migration-list` - List migrations
- `migration-status` - Migration status

**Templates:**

- `minimal/` - Minimal setup
- `node/` - Node.js template
- `cloudflare/` - Cloudflare Workers template

## 🔧 Technische Details

### Module Lifecycle

1. **Load** - Module registratie en validatie
2. **Services Registration** - DI container setup
3. **Start** - Initialisatie (async operaties)
4. **Runtime** - Actieve operaties
5. **Stop** - Cleanup (optioneel)

### Service Container

- **Type-safe** service registratie
- **Factory functions** of class constructors
- **Module-scoped** services
- **Service resolution** via `ledger.getService<T>(name)`

### Hash Chain

- **Ed25519** signing
- **SHA-256** hashing
- **Chain verification** via previous hash
- **Immutable** entries

### Schema System

- **JSON Schema** definities
- **Runtime validatie** met AJV
- **Type inference** voor TypeScript
- **Module extensies** voor custom fields

## ⚡ Performance Analyse

Zie `LEDGER_OPTIMIZATION_ANALYSIS.md` voor volledige details.

### Kritieke Issues

1. **Meerdere queries per append** (4 operaties)
2. **JSON filtering** zonder indexes (traag)
3. **Geen caching** van latest entry
4. **Herhaaldelijk JSON.parse()** bij queries
5. **Synchrone JWT generation**

### Aanbevolen Optimalisaties

1. **Dedicated OID kolommen** met indexes (10-100x sneller)
2. **Transaction support** voor atomiciteit
3. **Latest entry caching** (elimineert query)
4. **Batch append** support
5. **Lazy JSON parsing**
6. **Parallel plugin hooks**

**Geschatte verbetering**: 5-40x performance boost

## 🧪 Testing

**Package**: `@onoal/ledger-test`

**Test suites:**

- `core/` - Core functionality tests
  - Hash chain tests
  - Ledger append/get/query
  - Chain verification
  - Service container
- `module/` - Module system tests
- `plugin/` - Plugin hooks tests

**Testing utilities:**

- `createTestLedger()` - Test ledger instance
- `createTestServer()` - Test HTTP server
- `mockService()` - Service mocking
- `testEntries` & `testOids` - Test data helpers

## 📚 Documentatie

- **README.md** - Overzicht en quick start
- **LEDGER_OPTIMIZATION_ANALYSIS.md** - Performance analyse
- **docs/** - Full documentation site (MDX)

## 🔗 Dependencies

### Externe Dependencies

**Cryptografie:**

- `@noble/curves` (^1.4.0) - Ed25519 curves
- `@noble/hashes` (^1.3.3) - SHA-256 hashing

**Database:**

- `drizzle-orm` (^0.29.0) - ORM
- `@neondatabase/serverless` (^0.9.0) - Serverless PostgreSQL
- `better-sqlite3` (^9.0.0) - SQLite driver

**Validatie:**

- `ajv` (^8.17.1) - JSON Schema validator
- `ajv-formats` (^2.1.1) - Format validators

**JWT:**

- `jose` (^5.10.0) - JWT signing/verification

**Internal:**

- `@onoal/core` - Shared utilities (workspace:\*)

### Workspace Dependencies

Alle packages gebruiken `workspace:*` voor interne dependencies:

- `@onoal/ledger-core` → gebruikt door alle modules
- Modules → afhankelijk van core
- Adapters → afhankelijk van core

## 📊 Package Publishing

Alle packages hebben `publishConfig` met `"access": "public"`:

- `@onoal/ledger-core`
- `@onoal/ledger-database-postgres`
- `@onoal/ledger-database-sqlite`
- `@onoal/ledger-module-proof`
- `@onoal/ledger-module-asset`
- `@onoal/ledger-module-connect`
- `@onoal/ledger-module-token`
- `create-onoal-ledger`

## 🎨 Type Safety

### TypeScript Strict Mode

- Alle packages gebruiken strict TypeScript
- Type inference voor services
- Generic types voor modules
- Type-safe route handlers

### Key Types

```typescript
// Core types
OnoalLedger;
OnoalLedgerConfig;
OnoalLedgerModule;
OnoalLedgerPlugin;
LedgerDatabase;

// Internal types
LedgerEntry;
LedgerStream;
EntryStatus;
ProofRecord;
AssetRecord;
```

## 🚀 Usage Patterns

### Basic Ledger Creation

```typescript
import { createLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import { proofModule } from "@onoal/ledger-module-proof";

const ledger = await createLedger({
  name: "my-ledger",
  signingKey: privateKey,
  database: sqliteAdapter("ledger.db"),
  modules: [proofModule()],
});
```

### Custom Module

```typescript
import { createCustomModule } from "@onoal/ledger-core";

export const myModule = createCustomModule({
  id: "my-module",
  services: {
    myService: MyService,
  },
  routes: [
    {
      method: "POST",
      path: "/my-module/create",
      handler: async (req, ledger, params) => {
        const service = ledger.getService<MyService>("myService");
        // ...
      },
    },
  ],
});
```

## 🔍 Code Quality

### Enterprise-Grade Features

✅ **Clean Architecture** - Duidelijke scheiding van concerns
✅ **Type Safety** - Volledige TypeScript coverage
✅ **Error Handling** - Gestructureerde error types
✅ **Logging** - Configureerbare logger met context
✅ **Testing** - Comprehensive test suite
✅ **Documentation** - Inline docs en README files
✅ **Modularity** - Herbruikbare, composable modules
✅ **Extensibility** - Plugin system voor custom logic

### Best Practices

- **Factory functions** voor instantiatie
- **Dependency injection** via service container
- **Lifecycle management** voor modules
- **Type inference** waar mogelijk
- **Error codes** voor structured errors
- **Context-aware logging**

## 📈 Status & Roadmap

### Huidige Status

✅ Core framework compleet
✅ Module system werkend
✅ Database adapters (SQLite, PostgreSQL, D1)
✅ 4 modules geïmplementeerd
✅ Plugin system
✅ CLI tool
✅ Testing infrastructure
✅ Documentation

### Bekende Issues

⚠️ Performance optimalisaties nodig (zie optimization doc)
⚠️ Geen batch append support
⚠️ Geen caching implementatie
⚠️ JSON filtering is traag (geen indexes)

### Toekomstige Verbeteringen

1. **Performance optimalisaties** (Fase 1-4 roadmap)
2. **Redis cache** support voor distributed systems
3. **Query logging** en monitoring
4. **Async JWT generation**
5. **Materialized views** voor statistieken

## 🎯 Conclusie

Het Ledger Framework is een **volledig functioneel, enterprise-grade** systeem met:

- **Modulaire architectuur** voor flexibiliteit
- **Type-safe** TypeScript implementatie
- **Uitbreidbaar** via modules en plugins
- **Multi-database** support
- **Comprehensive testing**
- **Goede documentatie**

**Aanbevelingen:**

1. Implementeer performance optimalisaties (zie `LEDGER_OPTIMIZATION_ANALYSIS.md`)
2. **Implementeer integriteit verbeteringen** (zie `INTEGRITY_IMPROVEMENTS.md`)
3. Voeg monitoring en metrics toe
4. Overweeg Redis cache voor production
5. Implementeer batch operations
6. Voeg query logging toe voor debugging

## 📚 Gerelateerde Documenten

- **`LEDGER_OPTIMIZATION_ANALYSIS.md`** - Performance optimalisatie analyse
- **`INTEGRITY_IMPROVEMENTS.md`** - Integriteit verbeteringen plan
- **`README.md`** - Framework overzicht en quick start

---

**Laatste update**: Analyse gebaseerd op huidige codebase structuur
**Versie**: 0.1.0 (alle packages)
