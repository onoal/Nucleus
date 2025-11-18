# Nucleus Engine – Gap Analysis: Oude @ledger vs. Nieuwe Architectuur

## Overzicht

Dit document analyseert de belangrijkste functionaliteiten en architectuur componenten van het oude TypeScript @ledger framework en vergelijkt deze met de nieuwe Nucleus Engine (Rust + TypeScript DX) om te identificeren wat er ontbreekt.

**Belangrijk:** Deze analyse houdt rekening met de **Rust-optimized architectuur** waarbij:

- **Rust Core** (`nucleus-core`, `nucleus-engine`) = Canonical ledger engine, integrity, performance
- **TypeScript DX Layer** (`@onoal/nucleus`) = Developer experience, configuration, business logic
- Sommige features horen in **Rust core** (performance-critical, integrity)
- Andere features horen in **TypeScript DX** (business logic, extensibility)

## Architectuur Principe

```
┌─────────────────────────────────────┐
│   TypeScript DX Layer               │
│   (@onoal/nucleus)                  │
│   - Service Container               │  ← Business logic, DI
│   - UAL Service                     │  ← Business logic
│   - Plugins                         │  ← Extensibility
│   - Logger                          │  ← Developer experience
│   - Metrics                         │  ← Observability
│   - Auth Middleware                 │  ← HTTP/API layer
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
│   - Hash chain integrity            │  ← Core integrity
│   - Canonical serialization         │  ← Core integrity
│   - Module validation               │  ← Core validation
│   - Query engine                    │  ← Performance
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   Rust Core                         │
│   (nucleus-core)                    │
│   - Record types                    │  ← Core types
│   - Hash computation                │  ← Core integrity
│   - Chain verification              │  ← Core integrity
│   - Serialization                   │  ← Core integrity
└─────────────────────────────────────┘
```

**Principe:**

- **Rust Core** = Wat moet **canonical** en **performant** zijn
- **TypeScript DX** = Wat **flexibel** en **extensible** moet zijn

---

## 1. Service Container & Dependency Injection

### Oude @ledger ✅

**Service Container:**

- `ServiceContainer` class voor dependency injection
- `register()` - Registreer services
- `resolve<T>()` - Resolve services met type safety
- `has()` - Check of service bestaat
- `getServiceNames()` - Lijst van alle services
- Service metadata (moduleId, registeredAt, factory)

**Gebruik:**

```typescript
// In module
services: {
  assetService: AssetService,  // Class constructor
  proofService: (ledger) => new ProofService(ledger),  // Factory
  staticService: { method: () => {} },  // Direct object
}

// In code
const assetService = ledger.getService<AssetService>("assetService");
if (ledger.hasService("ual")) {
  const ual = ledger.getService<UnifiedAccessLayer>("ual");
}
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Waar hoort het:** **TypeScript DX Layer** (business logic, extensibility)

**Impact:**

- Geen service registry
- Geen dependency injection
- Modules kunnen geen services registreren
- Geen manier om services op te halen (bijv. UAL)

**Wat nodig:**

```typescript
// packages/nucleus/src/services/registry.ts
export class ServiceRegistry {
  private services = new Map<string, any>();
  private serviceMetadata = new Map<string, ServiceMetadata>();

  register<T>(name: string, service: T, moduleId?: string): void;
  get<T>(name: string): T | null;
  has(name: string): boolean;
  getServiceNames(): string[];
}

// Extend Ledger interface
export interface Ledger {
  getService<T>(name: string): T | null;
  hasService(name: string): boolean;
  getServiceNames(): string[];
}
```

**Waarom TypeScript DX:**

- Service container is business logic (niet core integrity)
- Flexibele service registratie (verschillende implementaties mogelijk)
- TypeScript type inference werkt beter voor services
- Geen performance impact op Rust core

**Prioriteit:** 🔴 **KRITIEK** (vereist voor UAL, modules, plugins)

---

## 2. Plugin Systeem & Hooks

### Oude @ledger ✅

**Plugin Interface:**

```typescript
interface OnoalLedgerPlugin {
  id: string;
  version: string;
  hooks?: {
    beforeAppend?: (entry, ledger) => Promise<void | { entry?, shortCircuit? }>;
    afterAppend?: (entry, ledger) => Promise<void>;
    beforeQuery?: (filters, ledger) => Promise<void | { filters?, shortCircuit? }>;
    afterQuery?: (result, filters, ledger) => Promise<{ entries, ... }>;
    beforeGet?: (id, ledger) => Promise<void | LedgerEntry>;
    afterGet?: (entry, id, ledger) => Promise<LedgerEntry | null>;
    beforeVerifyChain?: (startId?, limit?, ledger) => Promise<void>;
    afterVerifyChain?: (result, ledger) => Promise<ChainVerificationResult>;
  };
}
```

**Beschikbare Plugins:**

- **Audit Plugin** - Audit logging, compliance tracking
- **Analytics Plugin** - Entry tracking, metrics collection
- **Encryption Plugin** - Field-level encryption
- **Rate Limit Plugin** - Request rate limiting
- **Webhook Plugin** - Event notifications
- **ZK Plugin** - Zero-knowledge proofs

**Gebruik:**

```typescript
const ledger = await createLedger({
  plugins: [
    auditLogPlugin(),
    analyticsPlugin({ anonymize: true }),
    webhookPlugin({ url: "https://..." }),
  ],
});
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Waar hoort het:** **TypeScript DX Layer** (extensibility, business logic)

**Impact:**

- Geen extensibility via plugins
- Geen hooks voor custom logic
- Geen audit logging
- Geen analytics
- Geen encryption support
- Geen rate limiting
- Geen webhooks

**Wat nodig:**

```typescript
// packages/nucleus/src/plugins/types.ts
export interface Plugin {
  id: string;
  version: string;
  hooks?: PluginHooks;
}

export interface PluginHooks {
  beforeAppend?: (record: LedgerRecord) => Promise<void | LedgerRecord>;
  afterAppend?: (record: LedgerRecord, hash: string) => Promise<void>;
  beforeQuery?: (filters: QueryFilters) => Promise<void | QueryFilters>;
  afterQuery?: (result: QueryResult) => Promise<QueryResult>;
  // ...
}

// In LedgerImpl (TypeScript DX)
class LedgerImpl {
  private plugins: Plugin[] = [];

  async append(record: LedgerRecord): Promise<string> {
    // Call beforeAppend hooks (TypeScript layer)
    for (const plugin of this.plugins) {
      if (plugin.hooks?.beforeAppend) {
        const result = await plugin.hooks.beforeAppend(record);
        if (result) record = result;
      }
    }

    // Append to Rust engine (via WASM)
    const hash = await this.backend.append(record);

    // Call afterAppend hooks (TypeScript layer)
    for (const plugin of this.plugins) {
      if (plugin.hooks?.afterAppend) {
        await plugin.hooks.afterAppend(record, hash);
      }
    }

    return hash;
  }
}
```

**Waarom TypeScript DX:**

- Plugins zijn extensibility (niet core integrity)
- Flexibele hook system (verschillende plugin types mogelijk)
- Business logic (audit, analytics, webhooks)
- Geen performance impact op Rust core (hooks zijn optioneel)

**Notitie:** Rust core blijft **pure** - geen plugin hooks in Rust. Alle hooks in TypeScript DX layer.

**Prioriteit:** 🟡 **HOOG** (vereist voor enterprise features)

---

## 3. Logger & Structured Logging

### Oude @ledger ✅

**Logger Features:**

- Structured logging met context
- Log levels (debug, info, warn, error)
- Context propagation (ledger, module, service, operation, entryId, userId)
- Pretty en JSON format
- Timestamps, colors
- Performance timing (`logger.time()`)

**Gebruik:**

```typescript
const logger = createLogger({
  level: "info",
  enableColors: true,
  enableContext: true,
  format: "pretty",
});

logger.setContext({ ledger: "my-ledger", module: "asset" });
logger.info("Asset created", { assetId: "123" });
await logger.time("operation", async () => {
  // ... operation
});
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Waar hoort het:** **TypeScript DX Layer** (developer experience, observability)

**Impact:**

- Geen structured logging
- Geen context propagation
- Geen performance timing
- Moeilijk te debuggen

**Wat nodig:**

```typescript
// packages/nucleus/src/utils/logger.ts
export interface LogContext {
  ledger?: string;
  module?: string;
  service?: string;
  operation?: string;
  entryId?: string;
  userId?: string;
  [key: string]: unknown;
}

export class Logger {
  setContext(context: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  time<T>(label: string, fn: () => Promise<T>): Promise<T>;
}
```

**Waarom TypeScript DX:**

- Logging is developer experience (niet core integrity)
- Flexibele logging backends mogelijk (console, file, remote)
- TypeScript heeft betere logging ecosystem
- Rust core kan `tracing` gebruiken voor intern logging (optioneel)

**Notitie:** Rust core kan **optioneel** `tracing` crate gebruiken voor intern logging, maar main logging interface is TypeScript.

**Prioriteit:** 🟡 **MEDIUM** (belangrijk voor debugging en monitoring)

---

## 4. Metrics & Observability

### Oude @ledger ✅

**Metrics Features:**

- `MetricsCollector` class
- Operation metrics (append, query, verifyChain)
- Duration tracking (avg, p95, p99)
- Error counting
- Database query metrics
- Cache metrics (hits, misses, hitRate)
- Hook metrics
- Export naar Prometheus/JSON

**Gebruik:**

```typescript
const ledger = await createLedger({
  enableMetrics: true,
});

// Metrics worden automatisch verzameld
const metrics = ledger.getMetrics();
// {
//   operations: {
//     append: { count: 100, avgDuration: 50, p95Duration: 120, errors: 2 },
//     query: { count: 500, avgDuration: 30, avgResults: 10 },
//   },
//   ...
// }
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Waar hoort het:** **TypeScript DX Layer** (observability, monitoring)

**Impact:**

- Geen inzicht in performance
- Geen monitoring mogelijkheden
- Moeilijk om bottlenecks te vinden

**Wat nodig:**

```typescript
// packages/nucleus/src/metrics/collector.ts
export interface Metrics {
  operations: {
    append: OperationMetrics;
    query: OperationMetrics;
    verify: OperationMetrics;
  };
  wasm: {
    calls: number;
    avgDuration: number;
    errors: number;
  };
}

export class MetricsCollector {
  recordOperation(operation: string, duration: number, success: boolean): void;
  recordWasmCall(operation: string, duration: number, success: boolean): void;
  getMetrics(): Metrics;
  exportPrometheus(): string;
  exportJSON(): Metrics;
}
```

**Waarom TypeScript DX:**

- Metrics zijn observability (niet core integrity)
- Flexibele export formats (Prometheus, JSON, custom)
- TypeScript heeft betere metrics ecosystem
- Rust core blijft pure (geen metrics overhead)

**Notitie:** Metrics worden verzameld in TypeScript layer, inclusief WASM call metrics. Rust core blijft **pure** zonder metrics overhead.

**Prioriteit:** 🟡 **MEDIUM** (belangrijk voor production monitoring)

---

## 5. Tracing & Distributed Tracing

### Oude @ledger ✅

**Tracing Features:**

- `createTrace()` - Maak trace context
- `startSpan()` - Start span
- `endSpan()` - Eindig span
- Trace ID generation
- Span propagation
- Error tracking in spans

**Gebruik:**

```typescript
const ledger = await createLedger({
  enableTracing: true,
});

// Automatisch in append/query operations
const trace = createTrace();
const span = startSpan(trace, "ledger.append");
// ... operation
endSpan(trace, span);
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Impact:**

- Geen distributed tracing
- Moeilijk om request flows te volgen
- Geen correlation tussen operaties

**Prioriteit:** 🟢 **LAAG** (nice to have, niet kritiek)

---

## 6. Authentication & Request Context

### Oude @ledger ✅

**Auth Features:**

- `RequestContext` interface (oid, role, token, claims, source)
- `createAuthMiddleware()` - Auth middleware factory
- Token sources (ConnectToken, SessionToken, ServiceToken, DevToken, ApiKey)
- `getRequesterOid()` - Extract requester OID
- OID validation en parsing

**Gebruik:**

```typescript
const authMiddleware = createAuthMiddleware({
  env,
  publicPaths: ["/health"],
});

const context = await authMiddleware(req, env);
if (context) {
  const requesterOid = context.oid;
  // Use requesterOid for ACL checks
}
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Impact:**

- Geen request context
- Geen authentication support
- Geen manier om requesterOid te krijgen voor ACL checks

**Wat nodig:**

```typescript
// packages/nucleus/src/context/request.ts
export interface RequestContext {
  oid: string;
  role?: string;
  token: string;
  claims: Record<string, unknown>;
  source: "connect" | "session" | "service" | "dev" | "api_key";
}

export function createAuthMiddleware(options: AuthOptions): Middleware;
export function getRequesterOid(context: RequestContext | null): string | null;
```

**Prioriteit:** 🔴 **KRITIEK** (vereist voor UAL en ACL checks)

---

## 7. Database Adapters & Persistence

### Oude @ledger ✅

**Database Features:**

- `LedgerDatabase` interface
- SQLite adapter (`sqliteAdapter()`)
- PostgreSQL adapter (`postgresAdapter()`)
- Database schema migrations
- Connection pooling
- Transaction support

**Gebruik:**

```typescript
const ledger = await createLedger({
  database: sqliteAdapter({
    path: "ledger.db",
    enableWAL: true,
  }),
  // OF
  database: postgresAdapter({
    connectionString: "postgresql://...",
  }),
});
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT** (alleen in-memory)

**Impact:**

- Geen persistence
- Data gaat verloren bij restart
- Geen database support
- Niet geschikt voor productie

**Wat nodig:**

- Database adapter interface
- SQLite adapter implementatie
- PostgreSQL adapter implementatie
- Schema migrations
- Persistence layer in Rust core OF TypeScript DX

**Prioriteit:** 🔴 **KRITIEK** (vereist voor productie)

---

## 8. Module System & Lifecycle

### Oude @ledger ✅

**Module Features:**

- `OnoalLedgerModule` interface
- Module lifecycle: `load()` → register services → `start()`
- Module dependencies
- Module routes (REST API endpoints)
- Module schemas
- Module connectors
- `createCustomModule()` helper

**Gebruik:**

```typescript
const module = createCustomModule({
  id: "asset",
  version: "1.0.0",
  dependencies: ["proof"],
  services: {
    assetService: AssetService,
  },
  routes: [
    { method: "POST", path: "/asset/issue", handler: ... },
  ],
  load: async (ledger) => { /* setup */ },
  start: async (ledger) => { /* initialize */ },
});
```

### Nieuwe Nucleus Engine ⚠️

**Status:** **PARTIEEL** (alleen basis configuratie)

**Wat we hebben:**

- Module configuratie (id, version, config)
- Module helpers (`assetModule()`, `proofModule()`)

**Wat ontbreekt:**

- Module lifecycle hooks (load, start)
- Module services registratie
- Module routes
- Module dependencies
- Module connectors

**Prioriteit:** 🟡 **HOOG** (vereist voor volledige module functionaliteit)

---

## 9. UAL (Unified Access Layer)

### Oude @ledger ✅

**UAL Features:**

- `UnifiedAccessLayer` interface
- `grant()` - ACL grants
- `check()` - ACL checks
- `require()` - ACL require (throws if denied)
- `list()` - ACL-aware queries
- Automatische grants bij resource creation
- Database-backed ACL storage

**Gebruik:**

```typescript
const ual = ledger.getService<UnifiedAccessLayer>("ual");
if (ual) {
  await ual.grant([
    {
      resourceKind: "asset",
      resourceId: assetId,
      principalOid: ownerOid,
      scope: "full",
      grantedBy: issuerOid,
    },
  ]);

  const hasAccess = await ual.check(requesterOid, "read", {
    kind: "asset",
    id: assetId,
  });
}
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Waar hoort het:** **TypeScript DX Layer** (business logic, optioneel)

**Impact:**

- Geen access control
- Iedereen kan alles lezen (zie `NUCLEUS_ACCESS_CONTROL_ANALYSE.md`)
- Geen privacy bescherming

**Waarom TypeScript DX:**

- UAL is business logic (niet core integrity)
- Optioneel (core moet zonder kunnen werken)
- Database-backed (ACL grants in database)
- Flexibele implementatie mogelijk (verschillende UAL backends)

**Architectuur:**

```
TypeScript DX Layer
  └─> UAL Service (optioneel)
       └─> Database (ACL grants)
            └─> Filter query results
                 └─> Rust Engine (pure, geen ACL checks)
```

**Notitie:** Rust core blijft **pure** - geen ACL checks in Rust. Alle ACL logic in TypeScript DX layer. Rust engine retourneert alle records, TypeScript layer filtert op basis van ACL grants.

**Prioriteit:** 🔴 **KRITIEK** (vereist voor privacy/security)

**Zie:** `NUCLEUS_UAL_CONTEXT.md` voor implementatie plan

---

## 10. API Server & Routes

### Oude @ledger ✅

**Server Features:**

- `createLedgerServer()` - HTTP server factory
- Module routes (REST API endpoints)
- Core routes (`/health`, `/query`, `/get/:id`, etc.)
- Route handlers met RequestContext
- Request validation
- Error handling

**Gebruik:**

```typescript
const server = await createLedgerServer({
  ledger,
  port: 3000,
  auth: authMiddleware,
});

// Modules kunnen routes toevoegen
const module = createCustomModule({
  routes: [
    {
      method: "POST",
      path: "/asset/issue",
      handler: async (req, ledger, params) => {
        // Handler logic
        return Response.json({ ... });
      },
    },
  ],
});
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Impact:**

- Geen HTTP API
- Geen REST endpoints
- Geen server functionaliteit

**Prioriteit:** 🟡 **MEDIUM** (vereist voor HTTP API, maar niet voor core)

---

## 11. Testing Utilities

### Oude @ledger ✅

**Testing Features:**

- `createTestLedger()` - Test ledger factory
- `createTestServer()` - Test server factory
- `mockService()` - Service mocking
- `waitForHook()` - Hook testing
- `testEntries` - Test data helpers
- `testOids` - Test OID helpers

**Gebruik:**

```typescript
import { createTestLedger } from "@onoal/ledger-core/testing";

const ledger = await createTestLedger({
  modules: [assetModule()],
  plugins: [auditLogPlugin()],
});
```

### Nieuwe Nucleus Engine ⚠️

**Status:** **PARTIEEL** (alleen basis tests)

**Wat we hebben:**

- Unit tests
- E2E tests voor Rust core
- E2E tests voor WASM

**Wat ontbreekt:**

- Test ledger factory
- Test server factory
- Mock utilities
- Test data helpers

**Prioriteit:** 🟢 **LAAG** (nice to have)

---

## 12. Error Handling & Types

### Oude @ledger ✅

**Error Features:**

- `OnoalError` base class
- `ModuleError`, `ServiceError`, `SchemaError`, `RouteError`, `DatabaseError`, `HookError`
- `ErrorCodes` enum
- `formatError()`, `formatErrorAsJSON()`, `formatErrorAsString()`
- `isOnoalError()` type guard

**Gebruik:**

```typescript
try {
  await ledger.append({ ... });
} catch (error) {
  if (isOnoalError(error)) {
    console.error(formatErrorAsJSON(error));
  }
}
```

### Nieuwe Nucleus Engine ⚠️

**Status:** **PARTIEEL** (Rust heeft errors, TypeScript niet)

**Wat we hebben:**

- Rust error types (`EngineError`, etc.)
- WASM error conversion

**Wat ontbreekt:**

- TypeScript error types
- Error formatting utilities
- Error code enums

**Prioriteit:** 🟡 **MEDIUM** (belangrijk voor developer experience)

---

## 13. Schema Validation

### Oude @ledger ✅

**Schema Features:**

- `SchemaDefinition` interface
- `InferSchemaType<T>` - Type inference
- Custom schemas per module
- Schema validation
- Field-level validation

**Gebruik:**

```typescript
const ledger = await createLedger({
  customSchemas: {
    proof: {
      subject_oid: { type: "string", required: true },
      type: { type: "string", required: true },
    },
  },
});
```

### Nieuwe Nucleus Engine ⚠️

**Status:** **PARTIEEL** (module validation, geen custom schemas)

**Wat we hebben:**

- Module validation (proof, asset modules)

**Wat ontbreekt:**

- Custom schema definition
- Schema type inference
- Field-level validation

**Prioriteit:** 🟢 **LAAG** (nice to have)

---

## 14. OID Validation & Utilities

### Oude @ledger ✅

**OID Features:**

- `parseOid()` - Parse OID
- `validateOid()` - Validate OID
- `ensureOid()` - Ensure valid OID (throws if invalid)
- `isHierarchicalOid()` - Check hierarchical OID
- `isExternalNamespace()` - Check external namespace
- `getParentOid()` - Get parent OID
- `getRootOid()` - Get root OID
- `OidValidationError` - Error type

**Gebruik:**

```typescript
import { validateOid, ensureOid } from "@onoal/ledger-core";

const oid = ensureOid("oid:onoal:user:123", "user_oid");
if (isHierarchicalOid(oid)) {
  const parent = getParentOid(oid);
}
```

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Prioriteit:** 🟡 **MEDIUM** (belangrijk voor OID handling)

---

## 15. Cache System

### Oude @ledger ✅

**Cache Features:**

- In-memory cache
- Cache invalidation
- Cache metrics

### Nieuwe Nucleus Engine ❌

**Status:** **ONTBREEKT**

**Prioriteit:** 🟢 **LAAG** (performance optimization)

---

## Samenvatting: Kritieke Ontbrekende Features

### 🔴 KRITIEK (Vereist voor Productie)

1. **Service Container & Dependency Injection**

   - Service registry
   - `getService<T>()`, `hasService()`
   - Service metadata

2. **UAL (Unified Access Layer)**

   - ACL grants, checks, require, list
   - Database-backed ACL storage
   - Automatische grants bij resource creation

3. **Database Adapters & Persistence**

   - SQLite adapter
   - PostgreSQL adapter
   - Schema migrations
   - Persistence layer

4. **Authentication & Request Context**
   - `RequestContext` interface
   - Auth middleware
   - `getRequesterOid()` helper

### 🟡 HOOG (Belangrijk voor Enterprise)

5. **Plugin Systeem & Hooks**

   - Plugin interface
   - Hooks (beforeAppend, afterAppend, beforeQuery, etc.)
   - Plugin registry

6. **Module System & Lifecycle**

   - Module lifecycle hooks (load, start)
   - Module services registratie
   - Module routes
   - Module dependencies

7. **Logger & Structured Logging**

   - Structured logging met context
   - Log levels
   - Performance timing

8. **Metrics & Observability**

   - Metrics collector
   - Operation metrics
   - Prometheus export

9. **Error Handling & Types**
   - TypeScript error types
   - Error formatting utilities
   - Error codes

### 🟢 MEDIUM/LAAG (Nice to Have)

10. **API Server & Routes**
11. **Tracing & Distributed Tracing**
12. **OID Validation & Utilities**
13. **Schema Validation**
14. **Cache System**
15. **Testing Utilities**

---

## Implementatie Prioriteit

### Fase 6: Kritieke Missing Features

1. **Service Container** (1-2 weken)

   - Service registry implementatie
   - Ledger interface extensie
   - Service registration helpers

2. **UAL Implementation** (2-3 weken)

   - UAL package (`@onoal/nucleus-ual`)
   - Database schema
   - ACL grants, checks, require, list
   - Module integration

3. **Database Adapters** (2-3 weken)

   - Database adapter interface
   - SQLite adapter
   - PostgreSQL adapter
   - Persistence layer

4. **Authentication** (1-2 weken)
   - RequestContext interface
   - Auth middleware
   - OID extraction helpers

**Totaal:** ~6-10 weken voor kritieke features

### Fase 7: Enterprise Features

5. **Plugin Systeem** (2-3 weken)
6. **Module Lifecycle** (1-2 weken)
7. **Logger** (1 week)
8. **Metrics** (1-2 weken)

**Totaal:** ~5-8 weken voor enterprise features

---

## Conclusie

De nieuwe Nucleus Engine heeft een **solide basis** met:

- ✅ Rust core (hash chain, integrity, modules) - **Performance & Integrity**
- ✅ WASM bindings - **Interoperability**
- ✅ TypeScript DX layer (builder pattern, factory) - **Developer Experience**
- ✅ Basis module system - **Extensibility**

### Architectuur Voordelen

**Rust Core Optimalisaties:**

- ✅ **Canonical** - Deterministic serialization, hash computation
- ✅ **Performance** - Zero-cost abstractions, memory safety
- ✅ **Integrity** - Hash chain verification, module validation
- ✅ **Pure** - Geen business logic, alleen core ledger operations

**TypeScript DX Voordelen:**

- ✅ **Flexibiliteit** - Service container, plugins, extensibility
- ✅ **Developer Experience** - Builder pattern, type safety
- ✅ **Business Logic** - UAL, authentication, logging
- ✅ **Ecosystem** - Betere tooling voor HTTP, databases, monitoring

### Missing Features (met Architectuur Locatie)

**Kritieke Features:**

- ❌ **Service Container** → TypeScript DX (business logic)
- ❌ **UAL** → TypeScript DX (business logic, optioneel)
- ❌ **Database Persistence** → Rust Core (performance) + TypeScript DX (config)
- ❌ **Authentication** → TypeScript DX (HTTP/API layer)

**Enterprise Features:**

- ❌ **Plugin Systeem** → TypeScript DX (extensibility)
- ❌ **Logger** → TypeScript DX (developer experience)
- ❌ **Metrics** → TypeScript DX (observability)

**Aanbeveling:** Implementeer eerst de **kritieke features** (Fase 6) met juiste architectuur locatie:

1. **TypeScript DX**: Service Container, UAL, Authentication
2. **Rust Core**: Database Persistence (performance)
3. **TypeScript DX**: Plugin Systeem, Logger, Metrics

Dit behoudt de **Rust core optimalisaties** terwijl we **enterprise features** toevoegen in de TypeScript DX layer.

---

_Gap Analysis: Oude @ledger vs. Nieuwe Nucleus Engine_
