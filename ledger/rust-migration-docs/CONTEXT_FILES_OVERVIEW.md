# Context Files Overview - Ledger Framework

Dit document geeft een overzicht van alle bestanden die context-gerelateerd zijn en up-to-date zijn met de ledger framework.

## Hoofdbestanden met Context Types

### 1. RequestContext (Authentication Context)

**Bestand:** `ledger/framework/src/middleware/auth.ts`
- **RequestContext interface** - Context geëxtraheerd uit authenticatie
  - `oid: string` - OID van de requester
  - `role?: string` - Rol van de requester
  - `token: string` - Token gebruikt voor authenticatie
  - `claims: Record<string, unknown>` - JWT claims
  - `source` - Token source type (connect_token, session_token, service_token, dev_token, api_key)
- **AuthMiddlewareOptions interface** - Configuratie voor auth middleware
- **createAuthMiddleware function** - Factory voor auth middleware
- **getRequesterOid function** - Helper om OID uit context te halen

### 2. LogContext (Logging Context)

**Bestand:** `ledger/framework/src/utils/logger.ts`
- **LogContext interface** - Context voor structured logging
  - `ledger?: string` - Ledger naam
  - `module?: string` - Module naam
  - `service?: string` - Service naam
  - `operation?: string` - Operatie naam
  - `entryId?: string` - Entry ID
  - `userId?: string` - User ID
  - `[key: string]: unknown` - Extra context velden
- **LogEntry interface** - Log entry structuur
- **LoggerConfig interface** - Logger configuratie
- **Logger class** - Enterprise-grade structured logging met context awareness

## Bestanden die Context gebruiken

### 3. Server Implementation

**Bestand:** `ledger/framework/src/server/index.ts`
- Gebruikt `RequestContext` voor request handling
- Extract request context via auth middleware
- Pass context door naar route handlers via `_request_context` parameter

### 4. Core Types

**Bestand:** `ledger/framework/src/core/types.ts`
- Exporteert `RequestContext` type
- Gebruikt `RequestContext` in route handler types
- `LedgerRouteHandler` type bevat `_request_context` parameter

### 5. Ledger Module Adapter

**Bestand:** `ledger/framework/src/core/ledger-module-adapter.ts`
- Adapteert universele modules naar ledger-specifieke modules
- Converteert routes met `_request_context` parameter
- Route hooks gebruiken `RequestContext`

### 6. Ledger Core

**Bestand:** `ledger/framework/src/core/ledger.ts`
- Gebruikt `Logger` met `LogContext`
- Set context op logger: `logger.setContext({ ledger: config.name })`
- Gebruikt context in logging operaties

### 7. Testing Utilities

**Bestand:** `ledger/framework/src/testing/index.ts`
- Gebruikt `LogContext` in test logger configuratie
- `enableContext: false` voor test logger

### 8. Main Export

**Bestand:** `ledger/framework/src/index.ts`
- Exporteert alle context types:
  - `RequestContext`, `AuthMiddlewareOptions` (van auth.ts)
  - `LogContext`, `LogEntry`, `LoggerConfig`, `LogLevel` (van logger.ts)
- Exporteert context utilities:
  - `createAuthMiddleware`, `getRequesterOid` (van auth.ts)
  - `Logger`, `createLogger`, `defaultLogger` (van logger.ts)

## Context Usage Patterns

### RequestContext Pattern
```typescript
// In route handlers
handler: async (req, ledger, params) => {
  const context = params._request_context; // RequestContext | null
  const requesterOid = context?.oid;
  // ...
}
```

### LogContext Pattern
```typescript
// In logging
logger.info("Operation completed", {
  module: "payment",
  service: "stripe",
  operation: "create_payment",
  entryId: entry.id,
  userId: user.oid
});
```

## Migratie Prioriteit naar Rust

1. **RequestContext** (`auth.ts`) - Hoogste prioriteit
   - Core authenticatie context
   - Gebruikt in alle route handlers
   - Performance kritiek

2. **LogContext** (`logger.ts`) - Hoge prioriteit
   - Structured logging
   - Gebruikt door alle modules
   - Performance verbetering mogelijk

3. **Server Integration** (`server/index.ts`) - Medium prioriteit
   - Integreert RequestContext
   - Kan na context types gemigreerd worden

4. **Type Definitions** (`types.ts`) - Low prioriteit
   - Type exports
   - Kan via TypeScript bindings blijven

## Bestanden die NIET gemigreerd hoeven

- `ledger/docs/content/docs/authentication.mdx` - Documentatie alleen
- Bestanden die alleen types exporteren zonder implementatie

