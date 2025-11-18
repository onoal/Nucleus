# Nucleus Engine – UAL (Unified Access Layer) Context

## Overzicht

Dit document beschrijft de **Unified Access Layer (UAL)** functionaliteit die in het oude TypeScript @ledger framework aanwezig was, en hoe we dit moeten implementeren in de nieuwe Nucleus Engine (Rust + TypeScript DX).

## ⚠️ Kritiek: Huidige Situatie - Geen Access Control

**BELANGRIJK:** De huidige Nucleus Engine implementatie (Fase 1-5) heeft **GEEN access control**. Dit betekent:

- ❌ **Iedereen kan alle records lezen** - geen OID/principal checks
- ❌ **Geen privacy bescherming** - records zijn publiek toegankelijk via query()
- ❌ **Geen authorization** - query() retourneert alle matching records zonder permission checks

**Zie `NUCLEUS_ACCESS_CONTROL_ANALYSE.md` voor gedetailleerde analyse en oplossing.**

---

## Wat is UAL?

**UAL (Unified Access Layer)** is een optionele service die **Access Control List (ACL)** functionaliteit biedt voor ledger resources. Het maakt enterprise-level access control mogelijk zonder dat het de core ledger functionaliteit beïnvloedt.

### Kernfunctionaliteit

1. **ACL Grants** - Toekennen van toegangsrechten aan principals voor resources
2. **ACL Checks** - Verifiëren of een principal toegang heeft tot een resource
3. **ACL-aware Queries** - Filteren van query resultaten op basis van toegangsrechten
4. **Resource-based Authorization** - Per-resource toegangscontrole

---

## UAL in het Oude Framework

### Interface

```typescript
export interface UnifiedAccessLayer {
  /**
   * Grant ACL permissions
   */
  grant(grants: ACLGrant[]): Promise<void>;

  /**
   * Check if principal has access
   */
  check(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<boolean>;

  /**
   * Require access (throws if denied)
   */
  require(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<any>;

  /**
   * List resources with ACL filtering
   */
  list(
    principalOid: string,
    filters: ResourceFilters
  ): Promise<{ items: any[]; hasMore: boolean; nextCursor?: number }>;
}
```

### ACL Grant Structuur

```typescript
export interface ACLGrant {
  resourceKind: "proof" | "asset" | "connect_grant" | "token";
  resourceId: string; // Resource identifier (entry ID, asset_id, etc.)
  principalOid: string; // Principal die toegang krijgt
  scope: "read" | "write" | "full";
  grantedBy: string; // OID van degene die de grant geeft
  exp?: number; // Optional expiration (Unix seconds)
}
```

### Resource Predicate

```typescript
export interface ResourcePredicate {
  kind: "proof" | "asset" | "connect_grant" | "token";
  id?: string;
  subjectOid?: string;
  issuerOid?: string;
  status?: string;
  type?: string;
}
```

### Gebruik in Modules

**Asset Module:**

```typescript
// Automatische ACL grants bij asset creation
const ual = this.ledger.getService<UnifiedAccessLayer>("ual");
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
}

// ACL check bij query
if (ual && requesterOid) {
  const asset = await ual.require(requesterOid, "read", {
    kind: "asset",
    id: assetId,
  });
}
```

**Proof Module:**

```typescript
// Automatische grants bij proof creation
if (ual) {
  await ual.grant([
    {
      resourceKind: "proof",
      resourceId: proofId,
      principalOid: subjectOid,
      scope: "read",
      grantedBy: issuerOid,
    },
  ]);
}
```

---

## UAL in Nucleus Engine – Implementatie Plan

### Architectuur

UAL moet worden geïmplementeerd als een **optionele module** die bovenop de core ledger engine draait. Het is **niet** onderdeel van de Rust core, maar een **TypeScript service** die kan worden toegevoegd aan de DX layer.

```
┌─────────────────────────────────────┐
│   TypeScript DX Layer               │
│   (@onoal/nucleus)                  │
├─────────────────────────────────────┤
│   - UAL Service (optioneel)         │
│   - Module Services                 │
│   - Backend Wrappers                │
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
│   - Pure ledger logic               │
│   - Hash chain integrity            │
│   - Module system                   │
└─────────────────────────────────────┘
```

### Waarom UAL niet in Rust Core?

1. **Optioneel** - UAL is optioneel, core moet zonder kunnen werken
2. **Database Dependency** - UAL heeft een database nodig voor ACL storage
3. **Business Logic** - UAL bevat business logic die beter in TypeScript past
4. **Flexibiliteit** - Verschillende UAL implementaties mogelijk (database, in-memory, etc.)

---

## Implementatie Stappen

### Stap 1: UAL Module Structuur

```
packages/
└── nucleus-ual/              # Nieuwe package
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts          # Module export
        ├── types.ts          # UAL types
        ├── ual-service.ts   # UAL service implementatie
        └── schema.ts         # Database schema voor ACL grants
```

### Stap 2: UAL Types

```typescript
// packages/nucleus-ual/src/types.ts

export interface ACLGrant {
  resourceKind: "proof" | "asset" | "connect_grant" | "token";
  resourceId: string;
  principalOid: string;
  scope: "read" | "write" | "full";
  grantedBy: string;
  exp?: number;
}

export interface ResourcePredicate {
  kind: "proof" | "asset" | "connect_grant" | "token";
  id?: string;
  subjectOid?: string;
  issuerOid?: string;
  status?: string;
  type?: string;
}

export interface UnifiedAccessLayer {
  grant(grants: ACLGrant[]): Promise<void>;
  check(
    principalOid: string,
    action: string,
    resource: ResourcePredicate
  ): Promise<boolean>;
  require(
    principalOid: string,
    action: string,
    resource: ResourcePredicate
  ): Promise<any>;
  list(principalOid: string, filters: ResourceFilters): Promise<ListResult>;
}
```

### Stap 3: Database Schema

```typescript
// packages/nucleus-ual/src/schema.ts

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const aclGrants = sqliteTable("acl_grants", {
  id: text("id").primaryKey(),
  resourceKind: text("resource_kind").notNull(),
  resourceId: text("resource_id").notNull(),
  principalOid: text("principal_oid").notNull(),
  scope: text("scope").notNull(), // "read" | "write" | "full"
  grantedBy: text("granted_by").notNull(),
  exp: integer("exp"), // Optional expiration
  createdAt: integer("created_at").notNull(),
});

// Indexes
// - (resource_kind, resource_id) for fast resource lookups
// - (principal_oid, resource_kind) for fast principal lookups
// - (principal_oid, resource_kind, resource_id) for check operations
```

### Stap 4: UAL Service Implementatie

```typescript
// packages/nucleus-ual/src/ual-service.ts

import type { Ledger } from "@onoal/nucleus";
import type { UnifiedAccessLayer, ACLGrant, ResourcePredicate } from "./types";

export class UALService implements UnifiedAccessLayer {
  constructor(
    private ledger: Ledger,
    private db: Database // Database adapter (SQLite/PostgreSQL)
  ) {}

  async grant(grants: ACLGrant[]): Promise<void> {
    // Insert grants into database
    // Use onConflictDoNothing for idempotency
    for (const grant of grants) {
      await this.db
        .insert(aclGrants)
        .values({
          id: `${grant.resourceKind}:${grant.resourceId}:${grant.principalOid}`,
          resourceKind: grant.resourceKind,
          resourceId: grant.resourceId,
          principalOid: grant.principalOid,
          scope: grant.scope,
          grantedBy: grant.grantedBy,
          exp: grant.exp,
          createdAt: Date.now(),
        })
        .onConflictDoNothing();
    }
  }

  async check(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<boolean> {
    // Query database for matching grants
    const grants = await this.db
      .select()
      .from(aclGrants)
      .where(
        and(
          eq(aclGrants.principalOid, principalOid),
          eq(aclGrants.resourceKind, resource.kind),
          resource.id ? eq(aclGrants.resourceId, resource.id) : undefined,
          // Check expiration
          or(
            isNull(aclGrants.exp),
            gt(aclGrants.exp, Math.floor(Date.now() / 1000))
          )
        )
      );

    // Check if any grant has sufficient scope
    return grants.some((grant) => {
      if (action === "read")
        return grant.scope === "read" || grant.scope === "full";
      if (action === "write")
        return grant.scope === "write" || grant.scope === "full";
      return grant.scope === "full";
    });
  }

  async require(
    principalOid: string,
    action: "read" | "write" | "full",
    resource: ResourcePredicate
  ): Promise<any> {
    const hasAccess = await this.check(principalOid, action, resource);
    if (!hasAccess) {
      throw new Error(
        `Access denied: ${principalOid} does not have ${action} access to ${resource.kind}:${resource.id}`
      );
    }

    // Get resource from ledger
    if (resource.id) {
      return await this.ledger.getById(resource.id);
    }

    // Query resource by predicate
    const results = await this.ledger.query({
      stream:
        resource.kind === "proof"
          ? "proofs"
          : resource.kind === "asset"
          ? "assets"
          : resource.kind === "connect_grant"
          ? "connect_grants"
          : "tokens",
      id: resource.id,
      // ... other filters
    });

    return results.records[0] || null;
  }

  async list(
    principalOid: string,
    filters: ResourceFilters
  ): Promise<ListResult> {
    // Get all grants for this principal and resource kind
    const grants = await this.db
      .select()
      .from(aclGrants)
      .where(
        and(
          eq(aclGrants.principalOid, principalOid),
          eq(aclGrants.resourceKind, filters.kind),
          or(
            isNull(aclGrants.exp),
            gt(aclGrants.exp, Math.floor(Date.now() / 1000))
          )
        )
      );

    // Extract resource IDs
    const resourceIds = grants.map((g) => g.resourceId);

    // Query ledger for these resources
    const results = await this.ledger.query({
      stream:
        filters.kind === "proof"
          ? "proofs"
          : filters.kind === "asset"
          ? "assets"
          : filters.kind === "connect_grant"
          ? "connect_grants"
          : "tokens",
      // Filter by resource IDs
      // Apply additional filters
      limit: filters.limit,
      offset: filters.cursor,
    });

    // Filter results to only include resources with grants
    const filtered = results.records.filter((r) => resourceIds.includes(r.id));

    return {
      items: filtered,
      hasMore: results.hasMore,
      nextCursor: filters.cursor ? filters.cursor + filtered.length : undefined,
    };
  }
}
```

### Stap 5: UAL Module Integration

```typescript
// packages/nucleus-ual/src/index.ts

import type { Ledger } from "@onoal/nucleus";
import { UALService } from "./ual-service";

export function ualModule(db: Database) {
  return {
    id: "ual",
    version: "1.0.0",
    initialize: async (ledger: Ledger) => {
      const ualService = new UALService(ledger, db);

      // Register as service
      // Note: This requires extending the Ledger interface to support services
      // For now, we can use a service registry pattern

      return ualService;
    },
  };
}

export { UALService };
export type { UnifiedAccessLayer, ACLGrant, ResourcePredicate } from "./types";
```

### Stap 6: Integratie met Nucleus DX

```typescript
// packages/nucleus/src/ual-integration.ts

import type { Ledger } from "./types";
import type { UnifiedAccessLayer } from "@onoal/nucleus-ual";

/**
 * Extended Ledger interface with UAL support
 */
export interface LedgerWithUAL extends Ledger {
  /**
   * Get UAL service if available
   */
  getUAL(): UnifiedAccessLayer | null;
}

/**
 * Helper to check if UAL is available
 */
export function hasUAL(ledger: Ledger): ledger is LedgerWithUAL {
  return "getUAL" in ledger && typeof (ledger as any).getUAL === "function";
}
```

---

## Integratie met Modules

### Asset Module met UAL

```typescript
// packages/nucleus-module-asset/src/asset-service.ts

import type { Ledger } from "@onoal/nucleus";
import { hasUAL } from "@onoal/nucleus/ual-integration";

export class AssetService {
  constructor(private ledger: Ledger) {}

  async issueAsset(options: IssueAssetOptions) {
    // 1. Create asset in ledger
    const asset = await this.ledger.append({
      id: generateId(),
      stream: "assets",
      timestamp: Date.now(),
      payload: {
        asset_id: assetId,
        owner_oid: options.owner_oid,
        issuer_oid: options.issuer_oid,
        type: options.type,
        // ...
      },
    });

    // 2. Grant ACL via UAL (if available)
    if (hasUAL(this.ledger)) {
      const ual = this.ledger.getUAL();
      if (ual) {
        await ual.grant([
          {
            resourceKind: "asset",
            resourceId: assetId,
            principalOid: options.owner_oid,
            scope: "full",
            grantedBy: options.issuer_oid,
          },
        ]);
      }
    }

    return asset;
  }

  async getAsset(id: string, requesterOid?: string) {
    // ACL check if UAL available
    if (hasUAL(this.ledger) && requesterOid) {
      const ual = this.ledger.getUAL();
      if (ual) {
        return await ual.require(requesterOid, "read", {
          kind: "asset",
          id,
        });
      }
    }

    // Fallback to direct query
    return await this.ledger.getById(id);
  }
}
```

---

## Database Schema Migratie

### SQLite Schema

```sql
-- Migration: 001_create_acl_grants.sql

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
```

### PostgreSQL Schema

```sql
-- Migration: 001_create_acl_grants_pg.sql

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
```

---

## Service Registry Pattern

Om UAL (en andere services) te integreren met de Nucleus Engine, hebben we een **Service Registry** nodig in de TypeScript DX layer:

```typescript
// packages/nucleus/src/services/registry.ts

export class ServiceRegistry {
  private services = new Map<string, any>();

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T | null {
    return (this.services.get(name) as T) || null;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }
}

// Extend Ledger interface
export interface Ledger {
  // ... existing methods

  /**
   * Get a service by name
   */
  getService<T>(name: string): T | null;

  /**
   * Check if service exists
   */
  hasService(name: string): boolean;
}
```

---

## Implementatie Roadmap

### Fase 1: UAL Package Setup

- [ ] Maak `@onoal/nucleus-ual` package
- [ ] Definieer types en interfaces
- [ ] Setup database schema

### Fase 2: UAL Service Core

- [ ] Implementeer `grant()` method
- [ ] Implementeer `check()` method
- [ ] Implementeer `require()` method
- [ ] Implementeer `list()` method

### Fase 3: Database Integration

- [ ] SQLite adapter
- [ ] PostgreSQL adapter
- [ ] Migrations

### Fase 4: Service Registry

- [ ] Service registry in nucleus package
- [ ] Ledger interface extensie
- [ ] Service registration helpers

### Fase 5: Module Integration

- [ ] Asset module UAL integration
- [ ] Proof module UAL integration
- [ ] Token module UAL integration
- [ ] Connect module UAL integration

### Fase 6: Testing & Documentation

- [ ] Unit tests
- [ ] Integration tests
- [ ] API documentation
- [ ] Usage examples

---

## Belangrijke Overwegingen

### 1. Optioneel Character

- UAL moet **optioneel** zijn - ledger moet zonder kunnen werken
- Modules moeten graceful degradation hebben als UAL niet beschikbaar is

### 2. Performance

- ACL checks moeten snel zijn (indexes!)
- Consider caching voor veelgebruikte checks
- Batch grants waar mogelijk

### 3. Expiration Handling

- Grants met expiration moeten automatisch worden opgeruimd
- Consider background job voor cleanup

### 4. Idempotency

- `grant()` moet idempotent zijn (onConflictDoNothing)
- Meerdere calls metzelfde grant moeten geen error geven

### 5. Scope Hierarchy

- `full` > `write` > `read`
- Check logic moet scope hierarchy respecteren

---

## Conclusie

UAL is een **kritieke enterprise feature** die moet worden geïmplementeerd in de TypeScript DX layer. Het is **niet** onderdeel van de Rust core, maar een **optionele service** die bovenop de engine draait.

**Key Points:**

- ✅ UAL is optioneel - core werkt zonder
- ✅ UAL is TypeScript service - niet in Rust core
- ✅ Database-backed - SQLite/PostgreSQL
- ✅ Module integration - automatische grants bij resource creation
- ✅ ACL-aware queries - filter op basis van permissions

**Next Steps:**

1. Implementeer UAL package (`@onoal/nucleus-ual`)
2. Integreer met service registry
3. Update modules voor UAL support
4. Test en documenteer

---

_Context Document: Nucleus Engine UAL Implementation_
