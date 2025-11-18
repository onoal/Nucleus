# @onoal/ledger-context

Context types and utilities for the Onoal Ledger framework.

This package contains:
- **RequestContext**: Authentication context extracted from requests
- **LogContext**: Structured logging context

## Installation

```bash
pnpm add @onoal/ledger-context
```

## Usage

### RequestContext

```typescript
import { createAuthMiddleware, type RequestContext } from "@onoal/ledger-context";

const authMiddleware = createAuthMiddleware({
  verifyConnectToken: async (token, env) => {
    // Verify Connect token
    return await verifyConnectToken(token, env);
  },
  verifySessionToken: async (token, env) => {
    // Verify Session token
    return await verifySessionToken(token, env);
  },
  publicPaths: ["/health", "/ledger/stats"],
});

// Use in route handler
const context = await authMiddleware(req, env);
if (!context) {
  return new Response("Unauthorized", { status: 401 });
}
```

### LogContext

```typescript
import { createLogger, type LogContext } from "@onoal/ledger-context";

const logger = createLogger({
  level: "info",
  enableColors: true,
  format: "pretty",
});

logger.setContext({ ledger: "my-ledger" });

logger.info("Operation completed", {
  module: "payment",
  service: "stripe",
  operation: "create_payment",
  entryId: entry.id,
  userId: user.oid,
});
```

## Migration from ledger/framework

This package was extracted from `ledger/framework/src/middleware/auth.ts` and `ledger/framework/src/utils/logger.ts` to provide a dedicated context module for Rust migration.

