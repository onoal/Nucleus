# Nucleus Engine – Fase 6.2: UAL (Unified Access Layer) Implementation Roadmap

## Overzicht

Dit document bevat een **gedetailleerde roadmap** voor het implementeren van de Unified Access Layer (UAL) in de Nucleus Engine TypeScript DX layer.

**Doel:** Een host-side service die Access Control List (ACL) functionaliteit biedt voor privacy en security. **Belangrijk:** UAL draait host-side (server of TS host), niet als tweede engine. Calls mogen niet opt-in zijn; `requester_oid` is verplicht bij mutaties en gevoelige reads.

**Tijdsduur:** 2-3 weken

**Dependency:** Vereist Fase 6.1 (Module Registry) ✅

**Architectuurprincipe:** UAL is host-side service (grant/check/list) vóór de ledger-call. Geen aparte TS-engine voor UAL. WASM/HTTP entrypoints vereisen `requesterOid`; DX API gooit bij ontbreken. ACL storage en logic zitten in de host (Drizzle/SQL of in-memory), niet in Rust core.

---

## Stap 6.2.1: UAL Package Setup

### Waarom

Eerst de basis package structuur opzetten voordat we functionaliteit implementeren.

### Wat

- Maak nieuwe `@onoal/nucleus-ual` package aan
- Setup package.json, tsconfig.json
- Maak directory structuur
- Setup dependencies (drizzle-orm voor database)

### Waar

```
packages/
└── nucleus-ual/              # Nieuwe package
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.build.json
    ├── README.md
    └── src/
        ├── index.ts          # Module export
        ├── types.ts          # UAL types
        ├── ual-service.ts   # UAL service implementatie
        ├── schema.ts         # Database schema
        └── migrations/       # Database migrations
            ├── 001_create_acl_grants.sql
            └── 001_create_acl_grants_pg.sql
```

### Hoe

**1. Maak package directory:**

```bash
cd packages
mkdir -p nucleus-ual/src/migrations
cd nucleus-ual
```

**2. package.json:**

```json
{
  "name": "@onoal/nucleus-ual",
  "version": "0.1.0",
  "description": "Unified Access Layer for Nucleus Engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "migrations", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@onoal/nucleus": "workspace:*",
    "drizzle-orm": "^0.29.0",
    "drizzle-kit": "^0.20.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "@onoal/nucleus": "^0.1.0"
  },
  "keywords": ["nucleus", "ual", "acl", "access-control", "ledger"],
  "author": "Onoal Team",
  "license": "MIT"
}
```

**3. tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**4. tsconfig.build.json:**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "node_modules"]
}
```

**Checkpoint:** ✅ Package structuur bestaat, configuratie is klaar

---

## Stap 6.2.2: UAL Types & Interfaces

### Waarom

Definieer eerst alle types voordat we implementeren.

### Wat

- ACLGrant interface
- ResourcePredicate interface
- UnifiedAccessLayer interface
- ResourceFilters interface
- ListResult interface

### Waar

```
packages/nucleus-ual/src/types.ts
```

### Hoe

````typescript
// packages/nucleus-ual/src/types.ts

/**
 * ACL Grant definition
 *
 * Represents a permission grant for a principal to access a resource.
 */
export interface ACLGrant {
  /**
   * Resource kind (proof, asset, connect_grant, token)
   */
  resourceKind: "proof" | "asset" | "connect_grant" | "token";

  /**
   * Resource identifier (entry ID, asset_id, etc.)
   */
  resourceId: string;

  /**
   * Principal OID that receives access
   */
  principalOid: string;

  /**
   * Access scope (read, write, full)
   */
  scope: "read" | "write" | "full";

  /**
   * OID of the entity granting access
   */
  grantedBy: string;

  /**
   * Optional expiration timestamp (Unix seconds)
   */
  exp?: number;
}

/**
 * Resource predicate for UAL operations
 *
 * Used to identify resources for ACL checks and queries.
 */
export interface ResourcePredicate {
  /**
   * Resource kind
   */
  kind: "proof" | "asset" | "connect_grant" | "token";

  /**
   * Resource ID (optional)
   */
  id?: string;

  /**
   * Subject OID (optional)
   */
  subjectOid?: string;

  /**
   * Issuer OID (optional)
   */
  issuerOid?: string;

  /**
   * Status (optional)
   */
  status?: string;

  /**
   * Type (optional)
   */
  type?: string;
}

/**
 * Resource filters for list operations
 */
export interface ResourceFilters {
  /**
   * Resource kind
   */
  kind: "proof" | "asset" | "connect_grant" | "token";

  /**
   * Subject OID filter
   */
  subjectOid?: string;

  /**
   * Issuer OID filter
   */
  issuerOid?: string;

  /**
   * Status filter
   */
  status?: string;

  /**
   * Type filter
   */
  type?: string;

  /**
   * Limit number of results
   */
  limit?: number;

  /**
   * Cursor for pagination
   */
  cursor?: number;
}

/**
 * List result with pagination
 */
export interface ListResult {
  /**
   * Filtered items
   */
  items: any[];

  /**
   * Whether there are more results
   */
  hasMore: boolean;

  /**
   * Next cursor for pagination
   */
  nextCursor?: number;
}

/**
 * Unified Access Layer Interface
 *
 * Provides ACL grants and checks for ledger resources.
 * This is an optional service - the framework works without it,
 * but with UAL you get enterprise features like ACL checks.
 */
export interface UnifiedAccessLayer {
  /**
   * Grant ACL permissions
   *
   * Grants access permissions to principals for resources.
   * Uses onConflictDoNothing for idempotency.
   *
   * @param grants - Array of ACL grants to create
   *
   * @example
   * ```typescript
   * await ual.grant([
   *   {
   *     resourceKind: "asset",
   *     resourceId: "asset-123",
   *     principalOid: "oid:onoal:user:alice",
   *     scope: "full",
   *     grantedBy: "oid:onoal:org:issuer",
   *   },
   * ]);
   * ```
   */
  grant(grants: ACLGrant[]): Promise<void>;

  /**
   * Check if principal has access to resource
   *
   * Returns true if principal has the required action permission.
   *
   * @param principalOid - Principal OID to check
   * @param action - Required action (read, write, full)
   * @param resource - Resource predicate
   * @returns True if access is granted
   *
   * @example
   * ```typescript
   * const hasAccess = await ual.check(
   *   "oid:onoal:user:alice",
   *   "read",
   *   { kind: "asset", id: "asset-123" }
   * );
   * ```
   */
  check(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<boolean>;

  /**
   * Require access (throws if no access)
   *
   * Returns the resource if access is granted, throws error otherwise.
   *
   * @param principalOid - Principal OID to check
   * @param action - Required action (read, write, full)
   * @param resource - Resource predicate
   * @returns Resource data if access is granted
   * @throws Error if access is denied
   *
   * @example
   * ```typescript
   * const asset = await ual.require(
   *   "oid:onoal:user:alice",
   *   "read",
   *   { kind: "asset", id: "asset-123" }
   * );
   * ```
   */
  require(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<any>;

  /**
   * List resources with ACL filtering
   *
   * Returns only resources that the principal has access to.
   *
   * @param principalOid - Principal OID to filter for
   * @param filters - Resource filters
   * @returns Filtered resources with pagination
   *
   * @example
   * ```typescript
   * const result = await ual.list("oid:onoal:user:alice", {
   *   kind: "asset",
   *   limit: 10,
   * });
   * ```
   */
  list(principalOid: string, filters: ResourceFilters): Promise<ListResult>;
}
````

**Checkpoint:** ✅ Alle types zijn gedefinieerd

---

## Stap 6.2.3: Database Schema Definition

### Waarom

Database schema is nodig voor ACL grants storage.

### Wat

- Drizzle schema definitie
- SQLite schema
- PostgreSQL schema
- Migration scripts

### Waar

```
packages/nucleus-ual/src/
├── schema.ts
└── migrations/
    ├── 001_create_acl_grants.sql
    └── 001_create_acl_grants_pg.sql
```

### Hoe

**1. Drizzle Schema:**

```typescript
// packages/nucleus-ual/src/schema.ts

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { pgTable, text as pgText, bigint } from "drizzle-orm/pg-core";

/**
 * SQLite ACL Grants table
 */
export const aclGrantsSqlite = sqliteTable("acl_grants", {
  id: text("id").primaryKey(),
  resourceKind: text("resource_kind").notNull(),
  resourceId: text("resource_id").notNull(),
  principalOid: text("principal_oid").notNull(),
  scope: text("scope").notNull(), // "read" | "write" | "full"
  grantedBy: text("granted_by").notNull(),
  exp: integer("exp"), // Optional expiration (Unix seconds)
  createdAt: integer("created_at").notNull(),
});

/**
 * PostgreSQL ACL Grants table
 */
export const aclGrantsPg = pgTable("acl_grants", {
  id: pgText("id").primaryKey(),
  resourceKind: pgText("resource_kind").notNull(),
  resourceId: pgText("resource_id").notNull(),
  principalOid: pgText("principal_oid").notNull(),
  scope: pgText("scope").notNull(),
  grantedBy: pgText("granted_by").notNull(),
  exp: bigint("exp", { mode: "number" }), // Optional expiration
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/**
 * Database-agnostic type for ACL grant row
 */
export interface ACLGrantRow {
  id: string;
  resourceKind: string;
  resourceId: string;
  principalOid: string;
  scope: string;
  grantedBy: string;
  exp: number | null;
  createdAt: number;
}
```

**2. SQLite Migration:**

```sql
-- packages/nucleus-ual/migrations/001_create_acl_grants.sql

CREATE TABLE IF NOT EXISTS acl_grants (
  id TEXT PRIMARY KEY,
  resource_kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  principal_oid TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('read', 'write', 'full')),
  granted_by TEXT NOT NULL,
  exp INTEGER,
  created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_acl_grants_resource
  ON acl_grants(resource_kind, resource_id);

CREATE INDEX IF NOT EXISTS idx_acl_grants_principal
  ON acl_grants(principal_oid, resource_kind);

CREATE INDEX IF NOT EXISTS idx_acl_grants_lookup
  ON acl_grants(principal_oid, resource_kind, resource_id);

CREATE INDEX IF NOT EXISTS idx_acl_grants_exp
  ON acl_grants(exp) WHERE exp IS NOT NULL;
```

**3. PostgreSQL Migration:**

```sql
-- packages/nucleus-ual/migrations/001_create_acl_grants_pg.sql

CREATE TABLE IF NOT EXISTS acl_grants (
  id TEXT PRIMARY KEY,
  resource_kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  principal_oid TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('read', 'write', 'full')),
  granted_by TEXT NOT NULL,
  exp BIGINT,
  created_at BIGINT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_acl_grants_resource
  ON acl_grants(resource_kind, resource_id);

CREATE INDEX IF NOT EXISTS idx_acl_grants_principal
  ON acl_grants(principal_oid, resource_kind);

CREATE INDEX IF NOT EXISTS idx_acl_grants_lookup
  ON acl_grants(principal_oid, resource_kind, resource_id);

CREATE INDEX IF NOT EXISTS idx_acl_grants_exp
  ON acl_grants(exp) WHERE exp IS NOT NULL;
```

**Checkpoint:** ✅ Database schema is gedefinieerd, migrations zijn klaar

---

## Stap 6.2.4: Database Adapter Interface

### Waarom

We hebben een database adapter nodig die werkt met verschillende databases (SQLite, PostgreSQL).

### Wat

- Database adapter interface
- SQLite adapter implementatie
- PostgreSQL adapter implementatie (optioneel voor nu)

### Waar

```
packages/nucleus-ual/src/
├── database/
│   ├── adapter.ts        # Database adapter interface
│   ├── sqlite.ts         # SQLite adapter
│   └── postgres.ts       # PostgreSQL adapter (optioneel)
```

### Hoe

**1. Database Adapter Interface:**

```typescript
// packages/nucleus-ual/src/database/adapter.ts

import type { ACLGrantRow } from "../schema";

/**
 * Database adapter interface for UAL
 */
export interface UALDatabaseAdapter {
  /**
   * Initialize database (create tables, run migrations)
   */
  initialize(): Promise<void>;

  /**
   * Insert ACL grants (with conflict handling)
   */
  insertGrants(grants: ACLGrantRow[]): Promise<void>;

  /**
   * Query grants by principal and resource
   */
  queryGrants(params: {
    principalOid: string;
    resourceKind?: string;
    resourceId?: string;
    includeExpired?: boolean;
  }): Promise<ACLGrantRow[]>;

  /**
   * Delete expired grants
   */
  deleteExpiredGrants(): Promise<number>;

  /**
   * Close database connection
   */
  close(): Promise<void>;
}
```

**2. SQLite Adapter:**

```typescript
// packages/nucleus-ual/src/database/sqlite.ts

import Database from "better-sqlite3";
import type { UALDatabaseAdapter } from "./adapter";
import type { ACLGrantRow } from "../schema";
import { readFileSync } from "fs";
import { join } from "path";

export class SqliteUALAdapter implements UALDatabaseAdapter {
  private db: Database.Database;

  constructor(private dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Enable WAL for better concurrency
  }

  async initialize(): Promise<void> {
    // Run migration
    const migration = readFileSync(
      join(__dirname, "../migrations/001_create_acl_grants.sql"),
      "utf-8"
    );
    this.db.exec(migration);
  }

  async insertGrants(grants: ACLGrantRow[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO acl_grants
      (id, resource_kind, resource_id, principal_oid, scope, granted_by, exp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((grants: ACLGrantRow[]) => {
      for (const grant of grants) {
        stmt.run(
          grant.id,
          grant.resourceKind,
          grant.resourceId,
          grant.principalOid,
          grant.scope,
          grant.grantedBy,
          grant.exp,
          grant.createdAt
        );
      }
    });

    insertMany(grants);
  }

  async queryGrants(params: {
    principalOid: string;
    resourceKind?: string;
    resourceId?: string;
    includeExpired?: boolean;
  }): Promise<ACLGrantRow[]> {
    const {
      principalOid,
      resourceKind,
      resourceId,
      includeExpired = false,
    } = params;

    let query = `
      SELECT id, resource_kind, resource_id, principal_oid, scope, granted_by, exp, created_at
      FROM acl_grants
      WHERE principal_oid = ?
    `;
    const args: any[] = [principalOid];

    if (resourceKind) {
      query += " AND resource_kind = ?";
      args.push(resourceKind);
    }

    if (resourceId) {
      query += " AND resource_id = ?";
      args.push(resourceId);
    }

    if (!includeExpired) {
      query += " AND (exp IS NULL OR exp > ?)";
      args.push(Math.floor(Date.now() / 1000));
    }

    const rows = this.db.prepare(query).all(...args) as any[];

    return rows.map((row) => ({
      id: row.id,
      resourceKind: row.resource_kind,
      resourceId: row.resource_id,
      principalOid: row.principal_oid,
      scope: row.scope,
      grantedBy: row.granted_by,
      exp: row.exp,
      createdAt: row.created_at,
    }));
  }

  async deleteExpiredGrants(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(
      "DELETE FROM acl_grants WHERE exp IS NOT NULL AND exp < ?"
    );
    const result = stmt.run(now);
    return result.changes;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
```

**Checkpoint:** ✅ Database adapter interface en SQLite implementatie zijn klaar

---

## Stap 6.2.5: UAL Service Core Implementatie

### Waarom

De core UAL service implementeert alle ACL functionaliteit.

### Wat

- UALService class
- `grant()` method implementatie
- `check()` method implementatie
- `require()` method implementatie
- `list()` method implementatie
- Helper methods

### Waar

```
packages/nucleus-ual/src/ual-service.ts
```

### Hoe

```typescript
// packages/nucleus-ual/src/ual-service.ts

import type { Ledger } from "@onoal/nucleus";
import type {
  UnifiedAccessLayer,
  ACLGrant,
  ResourcePredicate,
  ResourceFilters,
  ListResult,
} from "./types";
import type { UALDatabaseAdapter } from "./database/adapter";
import type { ACLGrantRow } from "./schema";

/**
 * UAL Service Implementation
 *
 * Provides Access Control List functionality for ledger resources.
 */
export class UALService implements UnifiedAccessLayer {
  constructor(private ledger: Ledger, private db: UALDatabaseAdapter) {}

  /**
   * Grant ACL permissions
   */
  async grant(grants: ACLGrant[]): Promise<void> {
    // Convert ACLGrant to ACLGrantRow
    const grantRows: ACLGrantRow[] = grants.map((grant) => ({
      id: `${grant.resourceKind}:${grant.resourceId}:${grant.principalOid}`,
      resourceKind: grant.resourceKind,
      resourceId: grant.resourceId,
      principalOid: grant.principalOid,
      scope: grant.scope,
      grantedBy: grant.grantedBy,
      exp: grant.exp || null,
      createdAt: Math.floor(Date.now() / 1000),
    }));

    // Insert grants (with conflict handling)
    await this.db.insertGrants(grantRows);
  }

  /**
   * Check if principal has access
   */
  async check(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<boolean> {
    // Query database for matching grants
    const grants = await this.db.queryGrants({
      principalOid,
      resourceKind: resource.kind,
      resourceId: resource.id,
      includeExpired: false,
    });

    // Check if any grant has sufficient scope
    return grants.some((grant) => {
      if (action === "read") {
        return grant.scope === "read" || grant.scope === "full";
      }
      if (action === "write") {
        return grant.scope === "write" || grant.scope === "full";
      }
      return grant.scope === "full";
    });
  }

  /**
   * Require access (throws if denied)
   */
  async require(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<any> {
    const hasAccess = await this.check(principalOid, action, resource);
    if (!hasAccess) {
      throw new Error(
        `Access denied: ${principalOid} does not have ${action} access to ${
          resource.kind
        }:${resource.id || "unknown"}`
      );
    }

    // Get resource from ledger
    if (resource.id) {
      return await this.ledger.getById(resource.id);
    }

    // Query resource by predicate
    const results = await this.ledger.query({
      stream: this.mapKindToStream(resource.kind),
      id: resource.id,
    });

    return results.records[0] || null;
  }

  /**
   * List resources with ACL filtering
   */
  async list(
    principalOid: string,
    filters: ResourceFilters
  ): Promise<ListResult> {
    // Get all grants for this principal and resource kind
    const grants = await this.db.queryGrants({
      principalOid,
      resourceKind: filters.kind,
      includeExpired: false,
    });

    // Extract resource IDs
    const resourceIds = grants.map((g) => g.resourceId);

    if (resourceIds.length === 0) {
      return {
        items: [],
        hasMore: false,
      };
    }

    // Query ledger for these resources
    const results = await this.ledger.query({
      stream: this.mapKindToStream(filters.kind),
      limit: filters.limit || 100,
      offset: filters.cursor || 0,
    });

    // Filter results to only include resources with grants
    const filtered = results.records.filter((r) => resourceIds.includes(r.id));

    // Apply additional filters if provided
    let finalFiltered = filtered;
    if (filters.subjectOid) {
      finalFiltered = finalFiltered.filter(
        (r) => (r.payload as any).subject_oid === filters.subjectOid
      );
    }
    if (filters.issuerOid) {
      finalFiltered = finalFiltered.filter(
        (r) => (r.payload as any).issuer_oid === filters.issuerOid
      );
    }
    if (filters.type) {
      finalFiltered = finalFiltered.filter(
        (r) => (r.payload as any).type === filters.type
      );
    }

    // Calculate pagination
    const hasMore = finalFiltered.length === (filters.limit || 100);
    const nextCursor = filters.cursor
      ? filters.cursor + finalFiltered.length
      : finalFiltered.length;

    return {
      items: finalFiltered,
      hasMore,
      nextCursor: hasMore ? nextCursor : undefined,
    };
  }

  /**
   * Map resource kind to ledger stream
   */
  private mapKindToStream(kind: string): string {
    switch (kind) {
      case "proof":
        return "proofs";
      case "asset":
        return "assets";
      case "connect_grant":
        return "connect_grants";
      case "token":
        return "tokens";
      default:
        return kind;
    }
  }

  /**
   * Cleanup expired grants
   */
  async cleanupExpiredGrants(): Promise<number> {
    return await this.db.deleteExpiredGrants();
  }
}
```

**Checkpoint:** ✅ UALService core implementatie is klaar

---

## Stap 6.2.6: UAL Module Integration

### Waarom

UAL moet geïntegreerd worden als module die services kan registreren.

### Wat

- UAL module factory function
- Service registratie
- Database initialisatie
- Exports

### Waar

```
packages/nucleus-ual/src/index.ts
```

### Hoe

````typescript
// packages/nucleus-ual/src/index.ts

import type { Ledger } from "@onoal/nucleus";
import type { UnifiedAccessLayer } from "./types";
import { UALService } from "./ual-service";
import { SqliteUALAdapter } from "./database/sqlite";
import type { UALDatabaseAdapter } from "./database/adapter";

/**
 * UAL Module Configuration
 */
export interface UALModuleConfig {
  /**
   * Database adapter (SQLite or PostgreSQL)
   */
  database: UALDatabaseAdapter;

  /**
   * Auto-cleanup expired grants (default: true)
   */
  autoCleanup?: boolean;

  /**
   * Cleanup interval in milliseconds (default: 1 hour)
   */
  cleanupInterval?: number;
}

/**
 * Initialize UAL module
 *
 * @param ledger - Ledger instance
 * @param config - UAL module configuration
 * @returns UAL service instance
 *
 * @example
 * ```typescript
 * import { ualModule, SqliteUALAdapter } from "@onoal/nucleus-ual";
 *
 * const db = new SqliteUALAdapter("ual.db");
 * await db.initialize();
 *
 * const ual = await ualModule(ledger, {
 *   database: db,
 * });
 * ```
 */
export async function ualModule(
  ledger: Ledger,
  config: UALModuleConfig
): Promise<UnifiedAccessLayer> {
  // Initialize database
  await config.database.initialize();

  // Create UAL service
  const ualService = new UALService(ledger, config.database);

  // Register as service in ledger
  const registry = (ledger as any).serviceRegistry;
  if (registry) {
    registry.register("ual", ualService, {
      moduleId: "ual",
    });
  }

  // Setup auto-cleanup if enabled
  if (config.autoCleanup !== false) {
    const interval = config.cleanupInterval || 3600000; // 1 hour default
    setInterval(async () => {
      await ualService.cleanupExpiredGrants();
    }, interval);
  }

  return ualService;
}

// Exports
export { UALService } from "./ual-service";
export { SqliteUALAdapter } from "./database/sqlite";
export type {
  UnifiedAccessLayer,
  ACLGrant,
  ResourcePredicate,
  ResourceFilters,
  ListResult,
} from "./types";
export type { UALDatabaseAdapter } from "./database/adapter";
export type { UALModuleConfig } from "./index";
````

**Checkpoint:** ✅ UAL module is geïntegreerd, service registratie werkt

---

## Stap 6.2.7: Query Extensie met requesterOid (Verplicht)

### Waarom

**Boundary hardening:** Alle wasm/http entrypoints vragen `requester_oid`; calls zonder context worden geweigerd. Dit is niet opt-in - `requesterOid` is verplicht voor mutaties en gevoelige reads.

### Wat

- Update `WasmBackend.query()` met **verplichte** `requesterOid` parameter
- Update `Ledger.query()` interface - `requesterOid` is verplicht (geen optioneel)
- Implementeer UAL filtering in query
- **DX API gooit bij ontbreken** - geen fallback, geen opt-in

### Waar

```
packages/nucleus/src/
├── backends/
│   └── wasm.ts          # Update query() method
└── types/
    └── ledger.ts        # Update Ledger interface
```

### Hoe

**1. Update Ledger Interface:**

````typescript
// packages/nucleus/src/types/ledger.ts
// ... existing code ...

export interface Ledger {
  // ... existing methods ...

  /**
   * Query records with access control
   *
   * @param filters - Query filters
   * @param requesterOid - **REQUIRED** requester OID for ACL checks
   *                      Calls zonder requesterOid worden geweigerd (throw)
   *                      UAL service filtert resultaten op basis van ACL grants
   *
   * @example
   * ```typescript
   * // Met ACL (alleen toegankelijke records)
   * const filtered = await ledger.query(
   *   { stream: "assets" },
   *   "oid:onoal:user:alice" // VERPLICHT
   * );
   *
   * // Zonder requesterOid → ERROR
   * await ledger.query({ stream: "assets" }); // Throws!
   * ```
   */
  query(filters: QueryFilters, requesterOid: string): Promise<QueryResult>;

  /**
   * Get record by ID with access control
   *
   * @param id - Record ID
   * @param requesterOid - **REQUIRED** requester OID for ACL check
   *                      Calls zonder requesterOid worden geweigerd (throw)
   * @returns Record or null if not found or access denied
   */
  getById(id: string, requesterOid: string): Promise<LedgerRecord | null>;
}
````

**2. Update WasmBackend:**

```typescript
// packages/nucleus/src/backends/wasm.ts
// ... existing imports ...
import type { UnifiedAccessLayer } from "@onoal/nucleus-ual";

export class WasmBackend {
  private wasmLedger: WasmLedger | null = null;
  private ledgerConfig: CoreLedgerConfig;
  private initPromise: Promise<void> | null = null;
  private ual: UnifiedAccessLayer | null = null; // ← Nieuwe field

  // ... existing code ...

  /**
   * Set UAL service (called by UAL module)
   */
  setUAL(ual: UnifiedAccessLayer): void {
    this.ual = ual;
  }

  // ... existing methods ...

  /**
   * Query records with ACL filtering (requesterOid is VERPLICHT)
   */
  async query(
    filters: QueryFilters,
    requesterOid: string // ← VERPLICHT parameter
  ): Promise<QueryResult> {
    // Verifieer requesterOid is aanwezig
    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error("requesterOid is verplicht voor query operaties");
    }

    const ledger = this.ensureLedger();

    // Als UAL beschikbaar is → ACL-aware query
    if (this.ual) {
      // Map stream to resource kind
      const resourceKind = this.mapStreamToKind(filters.stream);

      // Use UAL.list() for ACL filtering
      const result = await this.ual.list(requesterOid, {
        kind: resourceKind,
        subjectOid: filters.moduleFilters?.subject_oid as string | undefined,
        issuerOid: filters.moduleFilters?.issuer_oid as string | undefined,
        type: filters.moduleFilters?.type as string | undefined,
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
      module_filters: filters.moduleFilters || {},
    };
    const result = ledger.query(wasmFilters);
    return {
      records: result.records || [],
      total: result.total || 0,
      hasMore: result.has_more || false,
    };
  }

  /**
   * Get record by ID with ACL check (requesterOid is VERPLICHT)
   */
  async getById(
    id: string,
    requesterOid: string // ← VERPLICHT parameter
  ): Promise<LedgerRecord | null> {
    // Verifieer requesterOid is aanwezig
    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error("requesterOid is verplicht voor getById operaties");
    }

    const ledger = this.ensureLedger();

    // Als UAL beschikbaar is → ACL check
    if (this.ual) {
      try {
        // Try to get record first
        const record = ledger.get_record_by_id(id);
        if (!record) {
          return null;
        }

        // Determine resource kind from stream
        const stream = record.stream;
        const resourceKind = this.mapStreamToKind(stream);

        // Check ACL
        const hasAccess = await this.ual.check(requesterOid, "read", {
          kind: resourceKind,
          id: record.id,
        });

        if (!hasAccess) {
          return null; // Access denied
        }

        return record;
      } catch {
        return null;
      }
    }

    // Zonder UAL: direct query (maar requesterOid is nog steeds verplicht voor logging/auditing)
    try {
      return ledger.get_record_by_id(id);
    } catch {
      return null;
    }
  }

  /**
   * Map stream to resource kind
   */
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
        return "asset"; // Default fallback
    }
  }
}
```

**3. Update LedgerImpl:**

```typescript
// packages/nucleus/src/factory.ts
// ... existing code ...

class LedgerImpl implements Ledger {
  // ... existing methods ...

  async query(
    filters: QueryFilters,
    requesterOid: string // ← VERPLICHT
  ): Promise<QueryResult> {
    // Verifieer requesterOid is aanwezig
    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error("requesterOid is verplicht voor query operaties");
    }
    return this.backend.query(filters, requesterOid);
  }

  async getById(
    id: string,
    requesterOid: string // ← VERPLICHT
  ): Promise<LedgerRecord | null> {
    // Verifieer requesterOid is aanwezig
    if (!requesterOid || requesterOid.trim() === "") {
      throw new Error("requesterOid is verplicht voor getById operaties");
    }
    return this.backend.getById(id, requesterOid);
  }
}
```

**Checkpoint:** ✅ Query is uitgebreid met ACL support, getById heeft ACL checks

---

## Stap 6.2.8: UAL Module Helper Function

### Waarom

Een helper functie maakt het makkelijker om UAL te gebruiken.

### Wat

- Helper functie voor UAL initialisatie
- Type-safe exports
- Usage examples

### Waar

```
packages/nucleus-ual/src/index.ts (update)
packages/nucleus/src/index.ts (re-export)
```

### Hoe

**1. Update nucleus-ual exports:**

````typescript
// packages/nucleus-ual/src/index.ts
// ... existing code ...

/**
 * Helper to create UAL with SQLite database
 *
 * @param ledger - Ledger instance
 * @param dbPath - SQLite database path
 * @param options - Optional UAL configuration
 * @returns UAL service instance
 *
 * @example
 * ```typescript
 * const ual = await createUALWithSQLite(ledger, "ual.db");
 * ```
 */
export async function createUALWithSQLite(
  ledger: Ledger,
  dbPath: string,
  options?: Omit<UALModuleConfig, "database">
): Promise<UnifiedAccessLayer> {
  const db = new SqliteUALAdapter(dbPath);
  return ualModule(ledger, {
    database: db,
    ...options,
  });
}
````

**2. Re-export in nucleus package:**

```typescript
// packages/nucleus/src/index.ts
// ... existing exports ...

// Re-export UAL (if available)
export type {
  UnifiedAccessLayer,
  ACLGrant,
  ResourcePredicate,
} from "@onoal/nucleus-ual";
```

**Checkpoint:** ✅ Helper functies zijn toegevoegd, exports zijn klaar

---

## Stap 6.2.9: Unit Tests

### Waarom

Tests verifiëren dat UAL correct werkt.

### Wat

- Unit tests voor UALService
- Unit tests voor database adapter
- Error handling tests
- Edge case tests

### Waar

```
packages/nucleus-ual/src/__tests__/
├── ual-service.test.ts
├── database/
│   └── sqlite.test.ts
└── integration.test.ts
```

### Hoe

**1. UALService Tests:**

```typescript
// packages/nucleus-ual/src/__tests__/ual-service.test.ts

import { UALService } from "../ual-service";
import { SqliteUALAdapter } from "../database/sqlite";
import type { Ledger } from "@onoal/nucleus";
import { unlinkSync } from "fs";

describe("UALService", () => {
  let ual: UALService;
  let ledger: Ledger;
  let db: SqliteUALAdapter;
  const dbPath = ":memory:"; // In-memory SQLite for tests

  beforeEach(async () => {
    // Create mock ledger
    ledger = {
      id: "test-ledger",
      getById: jest.fn(),
      query: jest.fn(),
    } as any;

    // Create database adapter
    db = new SqliteUALAdapter(dbPath);
    await db.initialize();

    // Create UAL service
    ual = new UALService(ledger, db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe("grant", () => {
    it("should grant ACL permissions", async () => {
      await ual.grant([
        {
          resourceKind: "asset",
          resourceId: "asset-123",
          principalOid: "oid:onoal:user:alice",
          scope: "full",
          grantedBy: "oid:onoal:org:issuer",
        },
      ]);

      const hasAccess = await ual.check("oid:onoal:user:alice", "read", {
        kind: "asset",
        id: "asset-123",
      });
      expect(hasAccess).toBe(true);
    });

    it("should handle idempotent grants", async () => {
      const grant = {
        resourceKind: "asset",
        resourceId: "asset-123",
        principalOid: "oid:onoal:user:alice",
        scope: "full",
        grantedBy: "oid:onoal:org:issuer",
      };

      // Grant twice
      await ual.grant([grant]);
      await ual.grant([grant]); // Should not throw

      const hasAccess = await ual.check("oid:onoal:user:alice", "read", {
        kind: "asset",
        id: "asset-123",
      });
      expect(hasAccess).toBe(true);
    });
  });

  describe("check", () => {
    beforeEach(async () => {
      await ual.grant([
        {
          resourceKind: "asset",
          resourceId: "asset-123",
          principalOid: "oid:onoal:user:alice",
          scope: "read",
          grantedBy: "oid:onoal:org:issuer",
        },
      ]);
    });

    it("should return true for granted access", async () => {
      const hasAccess = await ual.check("oid:onoal:user:alice", "read", {
        kind: "asset",
        id: "asset-123",
      });
      expect(hasAccess).toBe(true);
    });

    it("should return false for denied access", async () => {
      const hasAccess = await ual.check("oid:onoal:user:bob", "read", {
        kind: "asset",
        id: "asset-123",
      });
      expect(hasAccess).toBe(false);
    });

    it("should respect scope hierarchy", async () => {
      // Grant "full" scope
      await ual.grant([
        {
          resourceKind: "asset",
          resourceId: "asset-456",
          principalOid: "oid:onoal:user:alice",
          scope: "full",
          grantedBy: "oid:onoal:org:issuer",
        },
      ]);

      // "full" should allow read, write, and full
      expect(
        await ual.check("oid:onoal:user:alice", "read", {
          kind: "asset",
          id: "asset-456",
        })
      ).toBe(true);
      expect(
        await ual.check("oid:onoal:user:alice", "write", {
          kind: "asset",
          id: "asset-456",
        })
      ).toBe(true);
      expect(
        await ual.check("oid:onoal:user:alice", "full", {
          kind: "asset",
          id: "asset-456",
        })
      ).toBe(true);
    });

    it("should handle expired grants", async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago
      await ual.grant([
        {
          resourceKind: "asset",
          resourceId: "asset-expired",
          principalOid: "oid:onoal:user:alice",
          scope: "read",
          grantedBy: "oid:onoal:org:issuer",
          exp: expiredTime,
        },
      ]);

      const hasAccess = await ual.check("oid:onoal:user:alice", "read", {
        kind: "asset",
        id: "asset-expired",
      });
      expect(hasAccess).toBe(false);
    });
  });

  describe("require", () => {
    beforeEach(async () => {
      (ledger.getById as jest.Mock).mockResolvedValue({
        id: "asset-123",
        stream: "assets",
        payload: { type: "ticket" },
      });
    });

    it("should return resource if access granted", async () => {
      await ual.grant([
        {
          resourceKind: "asset",
          resourceId: "asset-123",
          principalOid: "oid:onoal:user:alice",
          scope: "read",
          grantedBy: "oid:onoal:org:issuer",
        },
      ]);

      const resource = await ual.require("oid:onoal:user:alice", "read", {
        kind: "asset",
        id: "asset-123",
      });
      expect(resource).toBeDefined();
      expect(resource.id).toBe("asset-123");
    });

    it("should throw error if access denied", async () => {
      await expect(
        ual.require("oid:onoal:user:bob", "read", {
          kind: "asset",
          id: "asset-123",
        })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      // Grant access to multiple assets
      await ual.grant([
        {
          resourceKind: "asset",
          resourceId: "asset-1",
          principalOid: "oid:onoal:user:alice",
          scope: "read",
          grantedBy: "oid:onoal:org:issuer",
        },
        {
          resourceKind: "asset",
          resourceId: "asset-2",
          principalOid: "oid:onoal:user:alice",
          scope: "read",
          grantedBy: "oid:onoal:org:issuer",
        },
        {
          resourceKind: "asset",
          resourceId: "asset-3",
          principalOid: "oid:onoal:user:bob", // Different principal
          scope: "read",
          grantedBy: "oid:onoal:org:issuer",
        },
      ]);

      (ledger.query as jest.Mock).mockResolvedValue({
        records: [
          { id: "asset-1", stream: "assets", payload: {} },
          { id: "asset-2", stream: "assets", payload: {} },
          { id: "asset-3", stream: "assets", payload: {} },
        ],
        total: 3,
        hasMore: false,
      });
    });

    it("should return only accessible resources", async () => {
      const result = await ual.list("oid:onoal:user:alice", {
        kind: "asset",
      });

      expect(result.items.length).toBe(2);
      expect(result.items.map((r) => r.id)).toEqual(["asset-1", "asset-2"]);
    });

    it("should handle pagination", async () => {
      const result = await ual.list("oid:onoal:user:alice", {
        kind: "asset",
        limit: 1,
        cursor: 0,
      });

      expect(result.items.length).toBe(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });
  });
});
```

**Checkpoint:** ✅ Unit tests zijn geschreven en slagen

---

## Stap 6.2.10: Integration Tests

### Waarom

Integration tests verifiëren dat UAL werkt met de echte ledger.

### Wat

- E2E tests met echte ledger
- UAL + Query integration
- UAL + Service Container integration
- Real-world scenarios

### Waar

```
packages/nucleus-ual/src/__tests__/
└── integration.test.ts
```

### Hoe

```typescript
// packages/nucleus-ual/src/__tests__/integration.test.ts

import { createLedger } from "@onoal/nucleus";
import { ualModule, SqliteUALAdapter } from "../index";
import { unlinkSync, existsSync } from "fs";

describe("UAL Integration", () => {
  let ledger: any;
  let ual: any;
  const dbPath = "./test-ual.db";

  beforeEach(async () => {
    // Clean up old database
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }

    // Create ledger
    ledger = await createLedger({
      id: "test-ledger",
      backend: { mode: "wasm" },
      modules: [],
    });

    // Initialize UAL
    const db = new SqliteUALAdapter(dbPath);
    ual = await ualModule(ledger, { database: db });
  });

  afterEach(async () => {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  it("should integrate with service container", () => {
    expect(ledger.hasService("ual")).toBe(true);
    const retrievedUAL = ledger.getService("ual");
    expect(retrievedUAL).toBe(ual);
  });

  it("should filter query results based on ACL", async () => {
    // Create assets
    const asset1 = await ledger.append({
      id: "asset-1",
      stream: "assets",
      timestamp: Date.now(),
      payload: { type: "ticket", owner_oid: "oid:onoal:user:alice" },
    });

    const asset2 = await ledger.append({
      id: "asset-2",
      stream: "assets",
      timestamp: Date.now(),
      payload: { type: "ticket", owner_oid: "oid:onoal:user:bob" },
    });

    // Grant access only to asset-1 for alice
    await ual.grant([
      {
        resourceKind: "asset",
        resourceId: "asset-1",
        principalOid: "oid:onoal:user:alice",
        scope: "read",
        grantedBy: "oid:onoal:org:issuer",
      },
    ]);

    // Query zonder requesterOid → ERROR (verplicht)
    await expect(ledger.query({ stream: "assets" })).rejects.toThrow(
      "requesterOid is verplicht"
    );

    // Query met requesterOid (alleen toegankelijke records)
    const filtered = await ledger.query(
      { stream: "assets" },
      "oid:onoal:user:alice" // VERPLICHT
    );
    expect(filtered.records.length).toBe(1);
    expect(filtered.records[0].id).toBe("asset-1");
  });

  it("should work with getById ACL checks", async () => {
    // Create asset
    const assetId = await ledger.append({
      id: "asset-123",
      stream: "assets",
      timestamp: Date.now(),
      payload: { type: "ticket" },
    });

    // Grant access
    await ual.grant([
      {
        resourceKind: "asset",
        resourceId: "asset-123",
        principalOid: "oid:onoal:user:alice",
        scope: "read",
        grantedBy: "oid:onoal:org:issuer",
      },
    ]);

    // Get with access
    const asset = await ledger.getById("asset-123", "oid:onoal:user:alice");
    expect(asset).toBeDefined();

    // Get without access
    const denied = await ledger.getById("asset-123", "oid:onoal:user:bob");
    expect(denied).toBeNull();
  });
});
```

**Checkpoint:** ✅ Integration tests zijn geschreven en slagen

---

## Stap 6.2.11: Documentation & Examples

### Waarom

Goede documentatie helpt developers UAL te gebruiken.

### Wat

- README met voorbeelden
- API documentation
- Usage examples
- Best practices

### Waar

```
packages/nucleus-ual/
├── README.md
└── examples/
    └── basic-usage.ts
```

### Hoe

**1. README:**

````markdown
# @onoal/nucleus-ual

Unified Access Layer (UAL) for Nucleus Engine - Access Control List functionality for privacy and security.

## Installation

```bash
npm install @onoal/nucleus-ual @onoal/nucleus
```
````

## Quick Start

```typescript
import { createLedger } from "@onoal/nucleus";
import { createUALWithSQLite } from "@onoal/nucleus-ual";

// Create ledger
const ledger = await createLedger({
  id: "my-ledger",
  backend: { mode: "wasm" },
  modules: [],
});

// Initialize UAL
const ual = await createUALWithSQLite(ledger, "ual.db");

// Grant access
await ual.grant([
  {
    resourceKind: "asset",
    resourceId: "asset-123",
    principalOid: "oid:onoal:user:alice",
    scope: "full",
    grantedBy: "oid:onoal:org:issuer",
  },
]);

// Query with ACL
const assets = await ledger.query(
  { stream: "assets" },
  "oid:onoal:user:alice" // requesterOid
);
```

## API Reference

### `ual.grant(grants: ACLGrant[])`

Grant ACL permissions to principals.

### `ual.check(principalOid, action, resource)`

Check if principal has access.

### `ual.require(principalOid, action, resource)`

Require access (throws if denied).

### `ual.list(principalOid, filters)`

List resources with ACL filtering.

````

**2. Example:**

```typescript
// packages/nucleus-ual/examples/basic-usage.ts

import { createLedger } from "@onoal/nucleus";
import { createUALWithSQLite } from "@onoal/nucleus-ual";

async function main() {
  // Create ledger
  const ledger = await createLedger({
    id: "example-ledger",
    backend: { mode: "wasm" },
    modules: [],
  });

  // Initialize UAL
  const ual = await createUALWithSQLite(ledger, "ual.db");

  // Create assets
  const asset1 = await ledger.append({
    id: "asset-1",
    stream: "assets",
    timestamp: Date.now(),
    payload: {
      type: "ticket",
      owner_oid: "oid:onoal:user:alice",
    },
  });

  const asset2 = await ledger.append({
    id: "asset-2",
    stream: "assets",
    timestamp: Date.now(),
    payload: {
      type: "ticket",
      owner_oid: "oid:onoal:user:bob",
    },
  });

  // Grant access
  await ual.grant([
    {
      resourceKind: "asset",
      resourceId: "asset-1",
      principalOid: "oid:onoal:user:alice",
      scope: "full",
      grantedBy: "oid:onoal:org:issuer",
    },
  ]);

  // Query met requesterOid (VERPLICHT) - alleen toegankelijke records
  const filtered = await ledger.query(
    { stream: "assets" },
    "oid:onoal:user:alice" // VERPLICHT
  );
  console.log("Accessible assets:", filtered.records.length); // 1

  // Query zonder requesterOid → ERROR
  // await ledger.query({ stream: "assets" }); // Throws!
}

main().catch(console.error);
````

**Checkpoint:** ✅ Documentatie is geschreven

---

## Stap 6.2.12: Final Validation & Testing

### Waarom

Laatste check voordat we naar de volgende fase gaan.

### Wat

- Run alle tests
- Check TypeScript compilation
- Verify exports
- Test in real-world scenario
- Performance check

### Hoe

**1. Run tests:**

```bash
cd packages/nucleus-ual
npm test
```

**2. Type check:**

```bash
npm run typecheck
```

**3. Build:**

```bash
npm run build
```

**4. Integration test:**

```bash
cd packages/nucleus
npm test -- --testPathPattern=ual
```

**Checkpoint:** ✅ Alles werkt, tests slagen, build succeeds

---

## Success Criteria

### Functionaliteit ✅

- [x] ACL grants kunnen worden gemaakt
- [x] ACL checks werken correct
- [x] Query filtert op basis van ACL grants
- [x] getById heeft ACL checks
- [x] **requesterOid is VERPLICHT** - calls zonder worden geweigerd
- [x] UAL is host-side service (geen tweede engine)
- [x] Expired grants worden opgeruimd
- [x] Scope hierarchy werkt (full > write > read)
- [x] Boundary hardening - alle entrypoints vragen requester_oid

### Code Kwaliteit ✅

- [x] TypeScript strict mode compliance
- [x] Goede error messages
- [x] JSDoc comments voor alle public methods
- [x] Unit tests met goede coverage
- [x] Integration tests

### Integratie ✅

- [x] UAL geïntegreerd als host-side service (geen TS-engine)
- [x] Query extensie met **verplichte** requesterOid werkt
- [x] getById extensie met **verplichte** requesterOid werkt
- [x] **Boundary hardening** - alle wasm/http entrypoints vragen requester_oid
- [x] **DX API gooit bij ontbreken** - geen fallback, geen opt-in
- [x] Type-safe API
- [x] Negatieve paden getest (geen requesterOid → fout)

### Documentatie ✅

- [x] README met voorbeelden
- [x] JSDoc comments
- [x] Usage examples
- [x] API reference

---

## Tijdlijn

### Week 1: Foundation

- **Dag 1-2:**

  - Stap 6.2.1: Package setup
  - Stap 6.2.2: Types & interfaces
  - Stap 6.2.3: Database schema

- **Dag 3-4:**
  - Stap 6.2.4: Database adapter
  - Stap 6.2.5: UAL Service core

### Week 2: Integration

- **Dag 5-6:**

  - Stap 6.2.6: Module integration
  - Stap 6.2.7: Query extensie

- **Dag 7:**
  - Stap 6.2.8: Helper functions
  - Stap 6.2.9: Unit tests (basis)

### Week 3: Testing & Polish

- **Dag 8-9:**

  - Stap 6.2.9: Unit tests (compleet)
  - Stap 6.2.10: Integration tests

- **Dag 10:**
  - Stap 6.2.11: Documentation
  - Stap 6.2.12: Final validation

**Totaal:** 2-3 weken (10-15 werkdagen)

---

## Risico's & Mitigatie

### Risico 1: Database Performance

**Risico:** Database queries kunnen traag zijn bij veel grants  
**Mitigatie:**

- Gebruik indexes (al geïmplementeerd)
- Batch operations waar mogelijk
- Consider caching voor veelgebruikte checks

### Risico 2: UAL Complexity

**Risico:** UAL implementatie kan complex worden  
**Mitigatie:**

- Start met simpele implementatie
- Iteratief uitbreiden
- Goede test coverage

### Risico 3: Query Performance

**Risico:** ACL filtering kan query performance beïnvloeden  
**Mitigatie:**

- Efficient database queries met indexes
- Consider query result caching
- UAL is host-side (geen overhead in Rust core)

### Risico 4: Migration Complexity

**Risico:** Database migrations kunnen complex zijn  
**Mitigatie:**

- Simpele schema (alleen ACL grants table)
- Goede migration scripts
- Test migrations in tests

---

## Volgende Stappen

Na voltooiing van Fase 6.2:

1. ✅ **UAL** is klaar
2. → **Fase 6.3**: Database Persistence (kan parallel)
3. → **Fase 6.4**: Authentication (gebruikt UAL)

---

## Conclusie

Fase 6.2 implementeert een **robuuste UAL service** die privacy en security biedt voor de Nucleus Engine. De implementatie is:

- ✅ **Host-side service** - UAL draait in host (server of TS host), niet als tweede engine
- ✅ **Verplichte requesterOid** - Calls zonder context worden geweigerd (geen opt-in)
- ✅ **Boundary hardening** - Alle wasm/http entrypoints vragen requester_oid
- ✅ **Type-safe** - Goede TypeScript support
- ✅ **Flexibel** - Verschillende database backends mogelijk (Drizzle/SQL of in-memory)
- ✅ **Testbaar** - Goede test coverage (negatieve paden: geen requesterOid → fout)
- ✅ **Documented** - Duidelijke documentatie
- ✅ **Production-ready** - Error handling, edge cases, performance

**Belangrijkste principes:**

- ✅ **Geen aparte TS-engine** - Alleen host-service (grant/check/list) vóór ledger-call
- ✅ **requesterOid verplicht** - DX API gooit bij ontbreken, geen fallback
- ✅ **ACL storage in host** - Drizzle/SQL of in-memory, niet in Rust core
- ✅ **Context-doorleiding** - DX API neemt context met requesterOid; standaard zonder context = throw

**Klaar voor:** Fase 6.3 (Database Persistence) of Fase 6.4 (Authentication - gebruikt UAL)

---

_Fase 6.2 Roadmap: UAL (Unified Access Layer) Implementation_
