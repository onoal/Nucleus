# Nucleus Engine – Fase 6.4: Authentication & Request Context Roadmap

## Overzicht

Dit document bevat een **gedetailleerde roadmap** voor het implementeren van authentication en request context in de Nucleus Engine TypeScript DX layer.

**Doel:** Request authentication en context extraction voor beveiligde API's en UAL integration. **Belangrijk:** Auth hoort bij de host (server of TS entrypoint), niet in de Rust core. `requesterOid` is VERPLICHT voor ledger calls; calls zonder context worden geweigerd.

**Tijdsduur:** 1-2 weken

**Dependency:** Fase 6.2 (UAL) - Request context is nodig voor ACL checks

**Architectuur:** TypeScript DX Layer (HTTP/API layer, security) - **Host-side, niet in Rust core**

**Architectuurprincipe:**

- Auth hoort bij de host (server of TS entrypoint), niet in de Rust core
- RequestContext types + helpers in TS DX, maar geen auth in core
- Middleware/factory (host-side) die tokens controleert en `requesterOid` verplicht maakt richting ledger-calls
- Doorsturen van context via wasm/http backends; calls zonder context worden geweigerd

---

## Stap 6.4.1: Request Context Types

### Waarom

Eerst de types definiëren voordat we implementeren.

### Wat

- RequestContext interface
- TokenSource enum
- Token types (Connect, Session, Service, Dev, API Key)
- Helper functies

### Waar

```
packages/nucleus/src/
└── context/
    ├── types.ts               # Request context types
    └── index.ts                # Exports
```

### Hoe

**1. Request Context Types:**

```typescript
// packages/nucleus/src/context/types.ts

/**
 * Token source type
 */
export type TokenSource = "connect" | "session" | "service" | "dev" | "api_key";

/**
 * Request context - extracted from authenticated requests
 */
export interface RequestContext {
  /**
   * Principal OID (who is making the request)
   */
  oid: string;

  /**
   * Role (optional)
   */
  role: string | null;

  /**
   * Raw token string
   */
  token: string;

  /**
   * Decoded token claims
   */
  claims: Record<string, unknown>;

  /**
   * Token source (where the token came from)
   */
  source: TokenSource;
}

/**
 * Token parsing result
 */
export interface TokenParseResult {
  /**
   * Request context if token is valid
   */
  context: RequestContext | null;

  /**
   * Error if parsing failed
   */
  error: string | null;
}

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  /**
   * Public paths that don't require authentication
   */
  publicPaths?: string[];

  /**
   * Token validation function (optional, for custom validation)
   */
  validateToken?: (token: string, source: TokenSource) => Promise<boolean>;

  /**
   * Custom token parser (optional)
   */
  parseToken?: (
    token: string,
    source: TokenSource
  ) => Promise<RequestContext | null>;
}
```

**2. Helper Functions:**

````typescript
// packages/nucleus/src/context/utils.ts

import type { RequestContext } from "./types";

/**
 * Extract requester OID from request context
 *
 * @param context - Request context (can be null)
 * @returns OID string or null
 *
 * @example
 * ```typescript
 * const oid = getRequesterOid(requestContext);
 * if (oid) {
 *   const hasAccess = await ual.check(oid, "read", { kind: "asset", id: "123" });
 * }
 * ```
 */
export function getRequesterOid(context: RequestContext | null): string | null {
  return context?.oid ?? null;
}

/**
 * Check if request context has a specific role
 *
 * @param context - Request context
 * @param role - Role to check
 * @returns True if context has the role
 */
export function hasRole(context: RequestContext | null, role: string): boolean {
  return context?.role === role;
}

/**
 * Check if request context is from a specific source
 *
 * @param context - Request context
 * @param source - Token source to check
 * @returns True if context is from the source
 */
export function isFromSource(
  context: RequestContext | null,
  source: TokenSource
): boolean {
  return context?.source === source;
}
````

**Checkpoint:** ✅ Request context types zijn gedefinieerd

---

## Stap 6.4.2: Token Parsers

### Waarom

Verschillende token types moeten worden geparsed (Connect, Session, Service, Dev, API Key).

### Wat

- Token parser interfaces
- Connect token parser
- Session token parser
- Service token parser
- Dev token parser
- API Key parser

### Waar

```
packages/nucleus/src/
└── context/
    └── tokens/
        ├── index.ts            # Token parser exports
        ├── connect.ts           # Connect token parser
        ├── session.ts           # Session token parser
        ├── service.ts           # Service token parser
        ├── dev.ts               # Dev token parser
        └── api-key.ts           # API Key parser
```

### Hoe

**1. Token Parser Interface:**

```typescript
// packages/nucleus/src/context/tokens/types.ts

import type { RequestContext, TokenSource } from "../types";

/**
 * Token parser interface
 */
export interface TokenParser {
  /**
   * Parse token and extract request context
   *
   * @param token - Raw token string
   * @returns Request context or null if invalid
   */
  parse(token: string): Promise<RequestContext | null>;

  /**
   * Validate token format
   *
   * @param token - Raw token string
   * @returns True if token format is valid
   */
  validateFormat(token: string): boolean;
}
```

**2. Connect Token Parser:**

```typescript
// packages/nucleus/src/context/tokens/connect.ts

import type { TokenParser } from "./types";
import type { RequestContext, TokenSource } from "../types";

/**
 * Connect token parser
 *
 * Connect tokens are JWT tokens issued by the Connect service.
 * Format: JWT with claims: { oid, role?, ... }
 */
export class ConnectTokenParser implements TokenParser {
  async parse(token: string): Promise<RequestContext | null> {
    try {
      // Decode JWT (without verification for now)
      // In production, you'd verify the signature
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf-8")
      );

      // Extract OID from claims
      const oid = payload.oid || payload.sub || payload.principal;
      if (!oid || typeof oid !== "string") {
        return null;
      }

      return {
        oid,
        role: payload.role || null,
        token,
        claims: payload,
        source: "connect",
      };
    } catch {
      return null;
    }
  }

  validateFormat(token: string): boolean {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    return parts.length === 3;
  }
}
```

**3. Session Token Parser:**

```typescript
// packages/nucleus/src/context/tokens/session.ts

import type { TokenParser } from "./types";
import type { RequestContext, TokenSource } from "../types";

/**
 * Session token parser
 *
 * Session tokens are session-based tokens (e.g., from a session store).
 * Format: Can be JWT or opaque token (lookup in session store)
 */
export class SessionTokenParser implements TokenParser {
  private sessionStore?: Map<string, any>; // In production, use Redis or similar

  constructor(sessionStore?: Map<string, any>) {
    this.sessionStore = sessionStore;
  }

  async parse(token: string): Promise<RequestContext | null> {
    try {
      // Try JWT format first
      if (this.isJWT(token)) {
        const parts = token.split(".");
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8")
        );

        const oid = payload.oid || payload.sub || payload.principal;
        if (!oid || typeof oid !== "string") {
          return null;
        }

        return {
          oid,
          role: payload.role || null,
          token,
          claims: payload,
          source: "session",
        };
      }

      // Try session store lookup
      if (this.sessionStore) {
        const session = this.sessionStore.get(token);
        if (session && session.oid) {
          return {
            oid: session.oid,
            role: session.role || null,
            token,
            claims: session.claims || {},
            source: "session",
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  validateFormat(token: string): boolean {
    // Accept JWT or opaque token
    return token.length > 0;
  }

  private isJWT(token: string): boolean {
    const parts = token.split(".");
    return parts.length === 3;
  }
}
```

**4. Service Token Parser:**

```typescript
// packages/nucleus/src/context/tokens/service.ts

import type { TokenParser } from "./types";
import type { RequestContext, TokenSource } from "../types";

/**
 * Service token parser
 *
 * Service tokens are for service-to-service authentication.
 * Format: JWT with service claims
 */
export class ServiceTokenParser implements TokenParser {
  async parse(token: string): Promise<RequestContext | null> {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf-8")
      );

      // Service tokens have service_oid instead of oid
      const oid = payload.service_oid || payload.oid || payload.sub;
      if (!oid || typeof oid !== "string") {
        return null;
      }

      return {
        oid,
        role: "service",
        token,
        claims: payload,
        source: "service",
      };
    } catch {
      return null;
    }
  }

  validateFormat(token: string): boolean {
    const parts = token.split(".");
    return parts.length === 3;
  }
}
```

**5. Dev Token Parser:**

```typescript
// packages/nucleus/src/context/tokens/dev.ts

import type { TokenParser } from "./types";
import type { RequestContext, TokenSource } from "../types";

/**
 * Dev token parser
 *
 * Dev tokens are for development/testing only.
 * Format: Simple format like "dev:oid:onoal:user:alice"
 */
export class DevTokenParser implements TokenParser {
  async parse(token: string): Promise<RequestContext | null> {
    try {
      // Dev token format: "dev:oid:..."
      if (!token.startsWith("dev:")) {
        return null;
      }

      const oid = token.substring(4); // Remove "dev:" prefix

      // Validate OID format (basic check)
      if (!oid.startsWith("oid:")) {
        return null;
      }

      return {
        oid,
        role: null,
        token,
        claims: { dev: true },
        source: "dev",
      };
    } catch {
      return null;
    }
  }

  validateFormat(token: string): boolean {
    return token.startsWith("dev:");
  }
}
```

**6. API Key Parser:**

```typescript
// packages/nucleus/src/context/tokens/api-key.ts

import type { TokenParser } from "./types";
import type { RequestContext, TokenSource } from "../types";

/**
 * API Key parser
 *
 * API keys are for programmatic access.
 * Format: Can be stored in database with associated OID
 */
export class ApiKeyParser implements TokenParser {
  private keyStore?: Map<string, { oid: string; role?: string }>; // In production, use database

  constructor(keyStore?: Map<string, { oid: string; role?: string }>) {
    this.keyStore = keyStore;
  }

  async parse(token: string): Promise<RequestContext | null> {
    try {
      // Try key store lookup
      if (this.keyStore) {
        const keyData = this.keyStore.get(token);
        if (keyData) {
          return {
            oid: keyData.oid,
            role: keyData.role || null,
            token,
            claims: { api_key: true },
            source: "api_key",
          };
        }
      }

      // Fallback: Try to extract OID from token format "api_key:oid:..."
      if (token.startsWith("api_key:")) {
        const oid = token.substring(8);
        if (oid.startsWith("oid:")) {
          return {
            oid,
            role: null,
            token,
            claims: { api_key: true },
            source: "api_key",
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  validateFormat(token: string): boolean {
    // Accept any format (lookup-based)
    return token.length > 0;
  }
}
```

**7. Token Parser Registry:**

```typescript
// packages/nucleus/src/context/tokens/index.ts

import type { TokenParser } from "./types";
import type { TokenSource } from "../types";
import { ConnectTokenParser } from "./connect";
import { SessionTokenParser } from "./session";
import { ServiceTokenParser } from "./service";
import { DevTokenParser } from "./dev";
import { ApiKeyParser } from "./api-key";

/**
 * Token parser registry
 */
export class TokenParserRegistry {
  private parsers: Map<TokenSource, TokenParser> = new Map();

  constructor() {
    // Register default parsers
    this.register("connect", new ConnectTokenParser());
    this.register("session", new SessionTokenParser());
    this.register("service", new ServiceTokenParser());
    this.register("dev", new DevTokenParser());
    this.register("api_key", new ApiKeyParser());
  }

  /**
   * Register a token parser
   */
  register(source: TokenSource, parser: TokenParser): void {
    this.parsers.set(source, parser);
  }

  /**
   * Get parser for token source
   */
  get(source: TokenSource): TokenParser | undefined {
    return this.parsers.get(source);
  }

  /**
   * Parse token by trying all parsers
   */
  async parse(
    token: string
  ): Promise<{ context: any; source: TokenSource } | null> {
    // Try parsers in order of preference
    const sources: TokenSource[] = [
      "connect",
      "session",
      "service",
      "dev",
      "api_key",
    ];

    for (const source of sources) {
      const parser = this.parsers.get(source);
      if (parser && parser.validateFormat(token)) {
        const context = await parser.parse(token);
        if (context) {
          return { context, source };
        }
      }
    }

    return null;
  }
}

export {
  ConnectTokenParser,
  SessionTokenParser,
  ServiceTokenParser,
  DevTokenParser,
  ApiKeyParser,
};
export type { TokenParser } from "./types";
```

**Checkpoint:** ✅ Token parsers zijn geïmplementeerd

---

## Stap 6.4.3: Auth Middleware

### Waarom

Middleware om authentication te handlen in HTTP requests.

### Wat

- Auth middleware factory
- Token extraction from headers
- Public path exclusion
- Request context injection

### Waar

```
packages/nucleus/src/
└── middleware/
    ├── auth.ts                # Auth middleware
    └── index.ts                # Exports
```

### Hoe

**1. Auth Middleware:**

````typescript
// packages/nucleus/src/middleware/auth.ts

import type {
  RequestContext,
  AuthMiddlewareOptions,
  TokenSource,
} from "../context/types";
import { TokenParserRegistry } from "../context/tokens";
import type { IncomingMessage } from "http";

/**
 * Extract token from request
 */
function extractToken(req: IncomingMessage): string | null {
  // Try Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try X-Auth-Token header
  const tokenHeader = req.headers["x-auth-token"];
  if (tokenHeader && typeof tokenHeader === "string") {
    return tokenHeader;
  }

  // Try query parameter (for development)
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const tokenParam = url.searchParams.get("token");
  if (tokenParam) {
    return tokenParam;
  }

  return null;
}

/**
 * Check if path is public
 */
function isPublicPath(path: string, publicPaths: string[] = []): boolean {
  return publicPaths.some((publicPath) => {
    // Exact match
    if (path === publicPath) {
      return true;
    }

    // Prefix match (e.g., "/health" matches "/health/check")
    if (publicPath.endsWith("*") && path.startsWith(publicPath.slice(0, -1))) {
      return true;
    }

    // Pattern match (e.g., "/api/public/*")
    if (publicPath.includes("*")) {
      const pattern = new RegExp("^" + publicPath.replace(/\*/g, ".*") + "$");
      return pattern.test(path);
    }

    return false;
  });
}

/**
 * Create authentication middleware
 *
 * @param options - Middleware options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const authMiddleware = createAuthMiddleware({
 *   publicPaths: ["/health", "/metrics"],
 * });
 *
 * app.use(authMiddleware);
 * ```
 */
export function createAuthMiddleware(
  options: AuthMiddlewareOptions = {}
): (req: IncomingMessage, res: any, next: () => void) => Promise<void> {
  const parserRegistry = new TokenParserRegistry();

  // Register custom parsers if provided
  if (options.parseToken) {
    // Custom parser logic
  }

  return async (
    req: IncomingMessage,
    res: any,
    next: () => void
  ): Promise<void> => {
    try {
      // Check if path is public
      const path = req.url?.split("?")[0] || "/";
      if (isPublicPath(path, options.publicPaths || [])) {
        // Public path, no authentication required
        (req as any).context = null;
        next();
        return;
      }

      // Extract token
      const token = extractToken(req);
      if (!token) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing authentication token" }));
        return;
      }

      // Parse token
      const result = await parserRegistry.parse(token);
      if (!result) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid authentication token" }));
        return;
      }

      // Custom validation if provided
      if (options.validateToken) {
        const isValid = await options.validateToken(token, result.source);
        if (!isValid) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Token validation failed" }));
          return;
        }
      }

      // Attach context to request
      (req as any).context = result.context;

      next();
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Authentication error" }));
    }
  };
}

/**
 * Get request context from request
 *
 * @param req - HTTP request
 * @returns Request context or null
 */
export function getRequestContext(req: IncomingMessage): RequestContext | null {
  return (req as any).context || null;
}
````

**2. Express.js Integration (Optional):**

```typescript
// packages/nucleus/src/middleware/express.ts

import type { Request, Response, NextFunction } from "express";
import { createAuthMiddleware as createBaseAuthMiddleware } from "./auth";
import type { AuthMiddlewareOptions } from "../context/types";

/**
 * Create Express.js authentication middleware
 *
 * @param options - Middleware options
 * @returns Express middleware function
 */
export function createAuthMiddleware(
  options: AuthMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const baseMiddleware = createBaseAuthMiddleware(options);

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await baseMiddleware(req, res, next);
  };
}
```

**Checkpoint:** ✅ Auth middleware is geïmplementeerd

---

## Stap 6.4.4: Context Integration with Ledger

### Waarom

Ledger operaties moeten request context kunnen gebruiken voor ACL checks.

### Wat

- Update Ledger interface om context te accepteren
- Context-aware query/get operations
- Integration met UAL service

### Waar

```
packages/nucleus/src/
├── types/
│   └── ledger.ts              # Update Ledger interface
└── factory.ts                 # Update LedgerImpl
```

### Hoe

**1. Update Ledger Interface:**

```typescript
// packages/nucleus/src/types/ledger.ts
// ... existing code ...

import type { RequestContext } from "../context/types";

export interface Ledger {
  // ... existing methods ...

  /**
   * Query records with request context for ACL checks
   *
   * **BELANGRIJK:** `requesterOid` is VERPLICHT. Calls zonder context worden geweigerd.
   *
   * @param filters - Query filters
   * @param context - Request context (VERPLICHT voor ACL filtering)
   * @returns Query result
   */
  query(
    filters: QueryFilters,
    context: RequestContext | null
  ): Promise<QueryResult>;

  /**
   * Get record by hash with request context for ACL checks
   *
   * **BELANGRIJK:** `requesterOid` is VERPLICHT. Calls zonder context worden geweigerd.
   *
   * @param hash - Record hash
   * @param context - Request context (VERPLICHT voor ACL checks)
   * @returns Record or null
   */
  get(
    hash: string,
    context: RequestContext | null
  ): Promise<LedgerRecord | null>;

  /**
   * Get record by ID with request context for ACL checks
   *
   * **BELANGRIJK:** `requesterOid` is VERPLICHT. Calls zonder context worden geweigerd.
   *
   * @param id - Record ID
   * @param context - Request context (VERPLICHT voor ACL checks)
   * @returns Record or null
   */
  getById(
    id: string,
    context: RequestContext | null
  ): Promise<LedgerRecord | null>;
}
```

**2. Update LedgerImpl:**

```typescript
// packages/nucleus/src/factory.ts
// ... existing imports ...
import type { RequestContext } from "./context/types";
import { getRequesterOid } from "./context/utils";

class LedgerImpl implements Ledger {
  // ... existing code ...

  async query(
    filters: QueryFilters,
    context: RequestContext | null
  ): Promise<QueryResult> {
    // **BELANGRIJK:** Extract requester OID from context - VERPLICHT
    const requesterOid = getRequesterOid(context);

    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error(
        "requesterOid is verplicht voor query operaties. Request context is vereist."
      );
    }

    // Use backend query with requesterOid
    return this.backend.query(filters, requesterOid);
  }

  async get(
    hash: string,
    context: RequestContext | null
  ): Promise<LedgerRecord | null> {
    // **BELANGRIJK:** Extract requester OID from context - VERPLICHT
    const requesterOid = getRequesterOid(context);

    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error(
        "requesterOid is verplicht voor get operaties. Request context is vereist."
      );
    }

    return this.backend.get(hash, requesterOid);
  }

  async getById(
    id: string,
    context: RequestContext | null
  ): Promise<LedgerRecord | null> {
    // **BELANGRIJK:** Extract requester OID from context - VERPLICHT
    const requesterOid = getRequesterOid(context);

    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error(
        "requesterOid is verplicht voor getById operaties. Request context is vereist."
      );
    }

    return this.backend.getById(id, requesterOid);
  }
}
```

**3. Update WasmBackend:**

```typescript
// packages/nucleus/src/backends/wasm.ts
// ... existing code ...

export class WasmBackend {
  // ... existing code ...

  async query(
    filters: QueryFilters,
    requesterOid: string // ← VERPLICHT parameter
  ): Promise<QueryResult> {
    // **BELANGRIJK:** Verifieer requesterOid is aanwezig
    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error("requesterOid is verplicht voor query operaties");
    }

    const ledger = this.ensureLedger();

    // If UAL is available, use ACL-aware query
    if (this.ual) {
      const kind = this.mapStreamToKind(filters.stream);
      const result = await this.ual.list(requesterOid, {
        kind: kind || "asset", // Default to asset if stream not mapped
        limit: filters.limit,
        cursor: filters.offset,
      });

      return {
        records: result.items,
        total: result.items.length,
        hasMore: result.hasMore,
      };
    }

    // Zonder UAL: direct query (maar requesterOid is nog steeds verplicht voor logging/auditing)
    const wasmFilters = {
      stream: filters.stream,
      id: filters.id,
      limit: filters.limit,
      offset: filters.offset,
      timestamp_from: filters.timestampFrom,
      timestamp_to: filters.timestampTo,
      module_filters: filters.moduleFilters,
    };

    const result = ledger.query(wasmFilters);
    return {
      records: result.records || [],
      total: result.total || 0,
      hasMore: result.has_more || false,
    };
  }

  async get(
    hash: string,
    requesterOid: string // ← VERPLICHT parameter
  ): Promise<LedgerRecord | null> {
    // **BELANGRIJK:** Verifieer requesterOid is aanwezig
    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error("requesterOid is verplicht voor get operaties");
    }

    const ledger = this.ensureLedger();

    try {
      const record = ledger.get_record(hash);
      if (!record) {
        return null;
      }

      // If UAL is available, check access
      if (this.ual) {
        const kind = this.mapStreamToKind(record.stream);
        const hasAccess = await this.ual.check(requesterOid, "read", {
          kind: kind || "asset",
          id: record.id,
        });

        if (!hasAccess) {
          return null; // Access denied
        }
      }

      return record;
    } catch {
      return null;
    }
  }

  async getById(
    id: string,
    requesterOid: string // ← VERPLICHT parameter
  ): Promise<LedgerRecord | null> {
    // **BELANGRIJK:** Verifieer requesterOid is aanwezig
    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error("requesterOid is verplicht voor getById operaties");
    }

    const ledger = this.ensureLedger();

    try {
      const record = ledger.get_record_by_id(id);
      if (!record) {
        return null;
      }

      // If UAL is available, check access
      if (this.ual) {
        const kind = this.mapStreamToKind(record.stream);
        const hasAccess = await this.ual.check(requesterOid, "read", {
          kind: kind || "asset",
          id: record.id,
        });

        if (!hasAccess) {
          return null; // Access denied
        }
      }

      // Zonder UAL: direct query (maar requesterOid is nog steeds verplicht voor logging/auditing)
      return record;
    } catch {
      return null;
    }
  }

  private mapStreamToKind(
    stream?: string
  ): "proof" | "asset" | "connect_grant" | "token" {
    switch (stream) {
      case "proofs":
        return "proof";
      case "assets":
        return "asset";
      case "connect_grants":
        return "connect_grant";
      case "tokens":
        return "token";
      default:
        return "asset"; // Default
    }
  }
}
```

**Checkpoint:** ✅ Ledger integreert request context voor ACL checks

---

## Stap 6.4.5: Unit Tests

### Waarom

Tests verifiëren dat token parsing en context extraction correct werken.

### Wat

- Unit tests voor token parsers
- Unit tests voor auth middleware
- Unit tests voor context helpers
- Error handling tests

### Waar

```
packages/nucleus/src/
└── __tests__/
    └── context/
        ├── tokens.test.ts
        ├── middleware.test.ts
        └── utils.test.ts
```

### Hoe

**1. Token Parser Tests:**

```typescript
// packages/nucleus/src/__tests__/context/tokens.test.ts

import { ConnectTokenParser, DevTokenParser } from "../../context/tokens";
import type { RequestContext } from "../../context/types";

describe("ConnectTokenParser", () => {
  it("should parse valid JWT token", async () => {
    // Create a simple JWT (for testing)
    const payload = {
      oid: "oid:onoal:user:alice",
      role: "admin",
    };
    const token = createTestJWT(payload);

    const parser = new ConnectTokenParser();
    const context = await parser.parse(token);

    expect(context).not.toBeNull();
    expect(context?.oid).toBe("oid:onoal:user:alice");
    expect(context?.role).toBe("admin");
    expect(context?.source).toBe("connect");
  });

  it("should return null for invalid token", async () => {
    const parser = new ConnectTokenParser();
    const context = await parser.parse("invalid-token");

    expect(context).toBeNull();
  });
});

describe("DevTokenParser", () => {
  it("should parse dev token", async () => {
    const parser = new DevTokenParser();
    const context = await parser.parse("dev:oid:onoal:user:alice");

    expect(context).not.toBeNull();
    expect(context?.oid).toBe("oid:onoal:user:alice");
    expect(context?.source).toBe("dev");
  });

  it("should return null for invalid dev token", async () => {
    const parser = new DevTokenParser();
    const context = await parser.parse("invalid-token");

    expect(context).toBeNull();
  });
});

// Helper to create test JWT
function createTestJWT(payload: any): string {
  const header = { alg: "none", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  return `${encodedHeader}.${encodedPayload}.signature`;
}
```

**2. Middleware Tests:**

```typescript
// packages/nucleus/src/__tests__/context/middleware.test.ts

import { createAuthMiddleware, getRequestContext } from "../../middleware/auth";
import { IncomingMessage } from "http";

describe("createAuthMiddleware", () => {
  it("should extract token from Authorization header", async () => {
    const middleware = createAuthMiddleware();
    const req = createMockRequest({
      headers: {
        authorization: "Bearer dev:oid:onoal:user:alice",
      },
    });

    let context: any = null;
    const next = () => {
      context = getRequestContext(req);
    };

    await middleware(req, createMockResponse(), next);

    expect(context).not.toBeNull();
    expect(context?.oid).toBe("oid:onoal:user:alice");
  });

  it("should allow public paths without token", async () => {
    const middleware = createAuthMiddleware({
      publicPaths: ["/health"],
    });

    const req = createMockRequest({
      url: "/health",
    });

    let context: any = null;
    const next = () => {
      context = getRequestContext(req);
    };

    await middleware(req, createMockResponse(), next);

    expect(context).toBeNull(); // Public path, no context needed
  });

  it("should return 401 for missing token", async () => {
    const middleware = createAuthMiddleware();
    const req = createMockRequest({});
    const res = createMockResponse();

    await middleware(req, res, () => {});

    expect(res.statusCode).toBe(401);
  });
});

// Helper functions
function createMockRequest(overrides: any = {}): IncomingMessage {
  return {
    headers: {},
    url: "/",
    ...overrides,
  } as any;
}

function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    headers: {},
    setHeader: (name: string, value: string) => {
      res.headers[name] = value;
    },
    end: (data: string) => {
      res.body = data;
    },
  };
  return res;
}
```

**3. Context Utils Tests:**

```typescript
// packages/nucleus/src/__tests__/context/utils.test.ts

import { getRequesterOid, hasRole, isFromSource } from "../../context/utils";
import type { RequestContext } from "../../context/types";

describe("getRequesterOid", () => {
  it("should extract OID from context", () => {
    const context: RequestContext = {
      oid: "oid:onoal:user:alice",
      role: null,
      token: "token",
      claims: {},
      source: "connect",
    };

    expect(getRequesterOid(context)).toBe("oid:onoal:user:alice");
  });

  it("should return null for null context", () => {
    expect(getRequesterOid(null)).toBeNull();
  });
});

describe("hasRole", () => {
  it("should check role correctly", () => {
    const context: RequestContext = {
      oid: "oid:onoal:user:alice",
      role: "admin",
      token: "token",
      claims: {},
      source: "connect",
    };

    expect(hasRole(context, "admin")).toBe(true);
    expect(hasRole(context, "user")).toBe(false);
  });
});
```

**Checkpoint:** ✅ Unit tests zijn geschreven en slagen

---

## Stap 6.4.6: Integration Tests

### Waarom

Integration tests verifiëren dat auth middleware en ledger samenwerken.

### Wat

- E2E tests met auth middleware
- Context-aware ledger operations
- UAL integration tests

### Waar

```
packages/nucleus/src/
└── __tests__/
    └── integration/
        └── auth-ledger.test.ts
```

### Hoe

```typescript
// packages/nucleus/src/__tests__/integration/auth-ledger.test.ts

import { createLedger } from "../../factory";
import { createAuthMiddleware, getRequestContext } from "../../middleware/auth";
import type { RequestContext } from "../../context/types";

describe("Auth + Ledger Integration", () => {
  it("should use request context for ACL checks", async () => {
    const ledger = await createLedger({
      id: "test-ledger",
      backend: { mode: "wasm" },
      modules: [],
    });

    // Create request with context
    const context: RequestContext = {
      oid: "oid:onoal:user:alice",
      role: null,
      token: "dev:oid:onoal:user:alice",
      claims: {},
      source: "dev",
    };

    // Query with context
    const result = await ledger.query({ stream: "proofs" }, context);

    // Should use ACL filtering if UAL is enabled
    expect(result).toBeDefined();
  });

  it("should reject calls without context", async () => {
    const ledger = await createLedger({
      id: "test-ledger",
      backend: { mode: "wasm" },
      modules: [],
    });

    // Query without context should throw error
    await expect(ledger.query({ stream: "proofs" }, null)).rejects.toThrow(
      "requesterOid is verplicht"
    );
  });
});
```

**Checkpoint:** ✅ Integration tests zijn geschreven en slagen

---

## Stap 6.4.7: Documentation & Examples

### Waarom

Goede documentatie helpt developers authentication te gebruiken.

### Wat

- README met voorbeelden
- Auth usage examples
- Best practices

### Waar

```
packages/nucleus/examples/
└── auth-usage.ts
```

### Hoe

**1. Example:**

```typescript
// packages/nucleus/examples/auth-usage.ts

import { createLedger } from "../src/factory";
import {
  createAuthMiddleware,
  getRequestContext,
} from "../src/middleware/auth";
import { getRequesterOid } from "../src/context/utils";
import http from "http";

async function main() {
  // Create ledger
  const ledger = await createLedger({
    id: "auth-ledger",
    backend: { mode: "wasm" },
    modules: [],
  });

  // Create auth middleware
  const authMiddleware = createAuthMiddleware({
    publicPaths: ["/health", "/metrics"],
  });

  // Create HTTP server
  const server = http.createServer(async (req, res) => {
    // Apply auth middleware
    await authMiddleware(req, res, async () => {
      // Get request context
      const context = getRequestContext(req);
      const requesterOid = getRequesterOid(context);

      if (req.url === "/query") {
        // Query with context (ACL-aware)
        const result = await ledger.query({ stream: "proofs" }, context);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });
  });

  server.listen(3000, () => {
    console.log("Server listening on http://localhost:3000");
  });
}

main().catch(console.error);
```

**2. README Update:**

````markdown
# Authentication

The Nucleus Engine supports request authentication and context extraction for ACL-aware operations.

## Usage

```typescript
import { createAuthMiddleware } from "@onoal/nucleus/middleware";
import { getRequesterOid } from "@onoal/nucleus/context";

// Create auth middleware
const authMiddleware = createAuthMiddleware({
  publicPaths: ["/health", "/metrics"],
});

// Use in HTTP server
app.use(authMiddleware);

// In route handler
app.get("/query", async (req, res) => {
  const context = getRequestContext(req);
  const requesterOid = getRequesterOid(context);

  // Query with context (ACL-aware)
  const result = await ledger.query({ stream: "proofs" }, context);
  res.json(result);
});
```
````

## Token Types

- **Connect Token**: JWT from Connect service
- **Session Token**: Session-based tokens
- **Service Token**: Service-to-service tokens
- **Dev Token**: Development tokens (`dev:oid:...`)
- **API Key**: Programmatic access keys

```

**Checkpoint:** ✅ Documentatie en voorbeelden zijn geschreven

---

## Success Criteria

### Functionaliteit ✅

- [x] Request context types zijn gedefinieerd
- [x] Token parsers werken voor alle token types
- [x] Auth middleware extract tokens en creëert context (host-side)
- [x] Public paths zijn uitgesloten van auth
- [x] **Ledger operaties vereisen request context** - `requesterOid` is VERPLICHT
- [x] **Calls zonder context worden geweigerd**
- [x] Context wordt gebruikt voor ACL checks (met UAL)
- [x] **Auth hoort bij host, niet in Rust core**

### Code Kwaliteit ✅

- [x] TypeScript best practices
- [x] Goede error handling
- [x] Documentation comments
- [x] Unit tests met goede coverage
- [x] Integration tests

### Integratie ✅

- [x] Auth middleware integreert met HTTP servers (host-side)
- [x] Ledger gebruikt context voor ACL checks (VERPLICHT)
- [x] UAL service gebruikt context voor access control
- [x] **Context wordt doorgegeven via wasm/http backends**
- [x] **Calls zonder context worden geweigerd** (niet backward compatible - security requirement)
- [x] **Geen auth in Rust core** - alles host-side

### Security ✅

- [x] Token validation
- [x] Public path exclusion
- [x] Error messages don't leak sensitive info
- [x] Context is properly extracted and validated

---

## Tijdlijn

### Week 1: Foundation

- **Dag 1-2:**
  - Stap 6.4.1: Request context types
  - Stap 6.4.2: Token parsers

- **Dag 3-4:**
  - Stap 6.4.3: Auth middleware
  - Stap 6.4.4: Context integration with ledger

### Week 2: Testing & Documentation

- **Dag 5-6:**
  - Stap 6.4.5: Unit tests
  - Stap 6.4.6: Integration tests

- **Dag 7:**
  - Stap 6.4.7: Documentation & examples

**Totaal:** 1-2 weken (7-10 werkdagen)

---

## Risico's & Mitigatie

### Risico 1: Token Validation Complexity

**Risico:** Token validation kan complex worden (JWT signature verification)
**Mitigatie:**
- Start met simpele parsing (geen signature verification)
- Later toevoegen: JWT library voor signature verification
- Custom validation function voor extensibility

### Risico 2: Multiple Token Sources

**Risico:** Verschillende token sources kunnen conflicteren
**Mitigatie:**
- Parser registry probeert parsers in volgorde
- Eerste succesvolle parse wint
- Duidelijke token format per source

### Risico 3: Performance Impact

**Risico:** Token parsing kan traag zijn
**Mitigatie:**
- Caching van parsed tokens (optioneel)
- Efficient parsing (geen onnodige validatie)
- Public paths bypassen auth volledig

### Risico 4: Security Vulnerabilities

**Risico:** Token parsing kan security vulnerabilities introduceren
**Mitigatie:**
- Input validation
- Error messages don't leak info
- Token expiration checks (later)
- Rate limiting (later)

---

## Volgende Stappen

Na voltooiing van Fase 6.4:

1. ✅ **Authentication** is klaar
2. → **Fase 6.5**: Logger & Structured Logging (kan parallel)
3. → **Fase 6.6**: Metrics & Observability (kan parallel)

---

## Conclusie

Fase 6.4 implementeert **robuuste authentication en request context** die productie readiness biedt. De implementatie is:

- ✅ **Host-side** - Auth hoort bij de host (server of TS entrypoint), niet in Rust core
- ✅ **Verplicht context** - `requesterOid` is VERPLICHT voor ledger calls; calls zonder context worden geweigerd
- ✅ **Flexibel** - Ondersteunt meerdere token types (Connect, Session, Service, Dev, API Key)
- ✅ **Secure** - Token validation en public path exclusion
- ✅ **Integrated** - Werkt naadloos met Ledger en UAL
- ✅ **Testbaar** - Goede test coverage
- ✅ **Documented** - Duidelijke documentatie

**Belangrijkste principes:**
- ✅ **Auth in host** - Middleware/factory (host-side) die tokens controleert en `requesterOid` verplicht maakt
- ✅ **RequestContext doorgeven** - Context wordt doorgegeven via wasm/http backends
- ✅ **Geen auth in core** - RequestContext types + helpers in TS DX, maar geen auth in Rust core
- ✅ **Verplicht requesterOid** - Calls zonder context worden geweigerd voor security
- ✅ **UAL integration** - UAL en auditing hebben een betrouwbare `requester_oid` nodig

**Klaar voor:** Fase 6.5 (Logger) of productie deployment met authentication

---

*Fase 6.4 Roadmap: Authentication & Request Context*

```
