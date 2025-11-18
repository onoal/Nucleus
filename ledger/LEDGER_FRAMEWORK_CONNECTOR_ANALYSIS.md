# Ledger Framework Connector Pattern - Analyse

**Laatste update**: 2025-01-27  
**Doel**: Analyse van benodigde framework updates voor Connector Pattern support

---

## 📋 Overzicht

Deze analyse beschrijft welke wijzigingen nodig zijn in het Ledger Framework om het **Connector Pattern** te ondersteunen. Connectors zijn een nieuw framework concept voor het synchroniseren van external services met het ledger, vergelijkbaar met database adapters maar voor external services.

---

## 🎯 Connector Pattern Concept

### Wat zijn Connectors?

**Connectors** zijn een nieuw framework concept voor external service integratie:

- **Gelijk aan Database Adapters**: Maar voor external services (Stripe, Mollie, etc.)
- **Sync Capability**: Synchroniseren external service state met ledger
- **Bidirectional**: Sync in beide richtingen (ledger ↔ external service)
- **Webhook Support**: Verwerken webhook events en update ledger
- **Lifecycle Hooks**: Connect, disconnect, sync, error handling

### Verschil met Database Adapters

| Feature         | Database Adapters     | Connectors                       |
| --------------- | --------------------- | -------------------------------- |
| **Doel**        | Database operations   | External service sync            |
| **Interface**   | `LedgerDatabase`      | `LedgerConnector` (nieuw)        |
| **Registratie** | Via `config.database` | Via module `connectors` property |
| **Lifecycle**   | Migrate, query        | Connect, sync, webhook           |
| **State**       | Database schema       | External service state           |
| **Schema**      | Core schema           | Connector declarative schema     |

---

## 🔍 Huidige Framework Structuur

### Database Adapter Pattern

```typescript
// 1. Interface definitie
export interface LedgerDatabase {
  id: string;
  db: any;
  provider: "sqlite" | "postgres" | "d1";
  migrate?: () => Promise<void>;
  pool?: any;
}

// 2. Registratie in createLedger()
serviceContainer.register("database", database);

// 3. Gebruik in services
const database = ledger.getService<LedgerDatabase>("database");
```

### Service Container

```typescript
class ServiceContainer {
  private services = new Map<string, any>();

  register<T>(name: string, service: T, moduleId?: string): void;
  resolve<T>(name: string): T;
  has(name: string): boolean;
}
```

### Module System

```typescript
export interface OnoalLedgerModule {
  id: string;
  services?: Record<string, new (ledger: OnoalLedger) => any>;
  routes?: Array<{...}>;
  // ❌ Geen connectors property
}
```

---

## 🚀 Benodigde Framework Updates

### 1. Connector Interface Definitie

**Waar**: `ledger/framework/src/core/types.ts`

**Wat**: Nieuwe interface voor connectors

**Waarom**: Unified interface voor alle connectors (gelijk aan `LedgerDatabase`)

**Hoe**:

````typescript
/**
 * Base Connector Interface
 *
 * Connectors synchronize external services with the ledger.
 * Gelijk aan database adapters, maar voor external services.
 *
 * @example
 * ```typescript
 * interface PaymentConnector extends LedgerConnector {
 *   id: "stripe" | "mollie" | "ledger_token";
 *   createPayment(options: CreatePaymentOptions): Promise<Payment>;
 *   verifyWebhook(request: Request, secret: string): Promise<WebhookEvent>;
 * }
 * ```
 */
export interface LedgerConnector {
  /**
   * Connector identifier (must be unique)
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Connector type/category (e.g., "payment", "notification", "storage")
   */
  type: string;

  /**
   * Declarative schema definition
   *
   * Een declaratieve manier om database tabellen te definiëren.
   * Dit is veel gebruiksvriendelijker dan Drizzle table definitions.
   * Gelijk aan module declarativeSchema, maar voor connector-specifieke tabellen.
   *
   * **Note**: Voor nu ondersteunen we alleen declarative schema voor connectors.
   * Drizzle schema support kan later worden toegevoegd indien nodig.
   *
   * @example
   * ```typescript
   * declarativeSchema: [
   *   {
   *     id: "payment_accounts",
   *     name: "payment_accounts",
   *     type: "table",
   *     fields: [
   *       {
   *         id: "id",
   *         name: "id",
   *         type: "text",
   *         required: true,
   *         primaryKey: true,
   *       },
   *       {
   *         id: "account_oid",
   *         name: "account_oid",
   *         type: "text",
   *         required: true,
   *       },
   *       {
   *         id: "provider",
   *         name: "provider",
   *         type: "text",
   *         required: true,
   *       },
   *       {
   *         id: "status",
   *         name: "status",
   *         type: "text",
   *         required: true,
   *         default: "active",
   *       },
   *       {
   *         id: "metadata",
   *         name: "metadata",
   *         type: "json",
   *         required: false,
   *       },
   *       {
   *         id: "created_at",
   *         name: "created_at",
   *         type: "bigint",
   *         required: true,
   *       },
   *     ],
   *     indexes: [
   *       {
   *         name: "idx_payment_accounts_account_oid",
   *         fields: ["account_oid"],
   *       },
   *       {
   *         name: "idx_payment_accounts_provider",
   *         fields: ["provider"],
   *       },
   *     ],
   *     constraints: [
   *       {
   *         name: "uq_payment_accounts_account_provider",
   *         type: "unique",
   *         fields: ["account_oid", "provider"],
   *       },
   *     ],
   *   },
   *   {
   *     id: "payments",
   *     name: "payments",
   *     type: "table",
   *     fields: [
   *       {
   *         id: "id",
   *         name: "id",
   *         type: "text",
   *         required: true,
   *         primaryKey: true,
   *       },
   *       {
   *         id: "account_oid",
   *         name: "account_oid",
   *         type: "text",
   *         required: true,
   *       },
   *       {
   *         id: "provider",
   *         name: "provider",
   *         type: "text",
   *         required: true,
   *       },
   *       {
   *         id: "amount",
   *         name: "amount",
   *         type: "bigint",
   *         required: true,
   *       },
   *       {
   *         id: "status",
   *         name: "status",
   *         type: "text",
   *         required: true,
   *         default: "pending",
   *       },
   *       {
   *         id: "created_at",
   *         name: "created_at",
   *         type: "bigint",
   *         required: true,
   *       },
   *     ],
   *     indexes: [
   *       {
   *         name: "idx_payments_account_oid",
   *         fields: ["account_oid"],
   *       },
   *       {
   *         name: "idx_payments_status",
   *         fields: ["status"],
   *       },
   *     ],
   *   },
   * ]
   * ```
   */
  declarativeSchema?: import("@onoal/core").DeclarativeTableSchema[];

  /**
   * Connect to external service
   * Called during module start lifecycle
   */
  connect?(): Promise<void>;

  /**
   * Disconnect from external service
   * Called during module stop lifecycle
   */
  disconnect?(): Promise<void>;

  /**
   * Sync state from external service to ledger
   * Called periodically or on-demand
   */
  sync?(options?: Record<string, unknown>): Promise<void>;

  /**
   * Get connector health status
   */
  health?(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    message?: string;
    lastSync?: number;
  }>;
}
````

**Codebase Analyse**:

- **Database Adapter**: `ledger/framework/src/core/types.ts` (regel 37-43) - Referentie voor interface structuur
- **Module Declarative Schema**: `ledger/framework/src/core/types.ts` (regel 366-387) - Referentie voor `declarativeSchema` property
- **Service Pattern**: Gelijk aan hoe services worden gedefinieerd
- **Schema Pattern**: Gelijk aan module `declarativeSchema` voor database extensies
- **Declarative Schema Example**: `ledger-test/src/modules/example-declarative-schema.ts` - Voorbeeld van declarative schema definitie

---

### 2. Module Connectors Property

**Waar**: `ledger/framework/src/core/types.ts`

**Wat**: Nieuwe `connectors` property in `OnoalLedgerModule`

**Waarom**: Modules moeten connectors kunnen definiëren en registreren

**Hoe**:

````typescript
export interface OnoalLedgerModule {
  id: string;
  label?: string;
  version?: string;
  dependencies?: string[];
  load?: (ledger: OnoalLedger) => Promise<void>;
  start?: (ledger: OnoalLedger) => Promise<void>;
  stop?: (ledger: OnoalLedger) => Promise<void>;
  services?: Record<string, new (ledger: OnoalLedger) => any>;
  routes?: Array<{...}>;

  /**
   * Connectors for external service integration
   *
   * Connectors synchronize external services with the ledger.
   * Gelijk aan database adapters, maar voor external services.
   *
   * @example
   * ```typescript
   * connectors: {
   *   stripe: new StripeConnector({ apiKey: env.STRIPE_KEY }),
   *   mollie: new MollieConnector({ apiKey: env.MOLLIE_KEY }),
   * }
   * ```
   */
  connectors?: Record<string, LedgerConnector>;
}
````

**Codebase Analyse**:

- **Services Property**: `ledger/framework/src/core/types.ts` (regel 72) - Referentie voor property structuur
- **Declarative Schema**: Gelijk patroon voor declarative schema definitie
- **Connector Schema**: Connectors kunnen `declarativeSchema` hebben, net zoals modules

---

### 3. Connector Registry in createLedger()

**Waar**: `ledger/framework/src/core/ledger.ts`

**Wat**: Connector registratie en lifecycle management

**Waarom**: Connectors moeten geregistreerd worden en lifecycle hooks moeten worden aangeroepen

**Hoe**:

```typescript
export async function createLedger(
  config: OnoalLedgerConfig
): Promise<OnoalLedger> {
  // ... existing code ...

  // Collect connectors from modules
  const moduleConnectors: Array<{
    moduleId: string;
    connectorId: string;
    connector: LedgerConnector;
  }> = [];

  // Collect connector schemas (gelijk aan module schemas)
  const connectorDrizzleSchemas: Array<{
    connectorId: string;
    moduleId: string;
    tables: Record<string, any>;
  }> = [];

  for (const module of modules) {
    if (module.connectors) {
      for (const [connectorId, connector] of Object.entries(
        module.connectors
      )) {
        // Validate connector
        if (!connector.id || !connector.name || !connector.type) {
          throw new ModuleError(
            `Invalid connector in module ${module.id}: missing required properties`,
            ErrorCodes.MODULE_LOAD_FAILED,
            "Connectors must have id, name, and type properties",
            { moduleId: module.id, connectorId }
          );
        }

        // Check for duplicate connector IDs
        const existing = moduleConnectors.find(
          (c) => c.connector.id === connector.id
        );
        if (existing) {
          throw new ModuleError(
            `Duplicate connector ID: ${connector.id}`,
            ErrorCodes.MODULE_LOAD_FAILED,
            `Connector ${connector.id} is already registered by module ${existing.moduleId}`,
            {
              moduleId: module.id,
              connectorId,
              existingModuleId: existing.moduleId,
            }
          );
        }

        moduleConnectors.push({
          moduleId: module.id,
          connectorId,
          connector,
        });

        // Collect connector declarative schema
        // Declarative schemas worden geconverteerd naar Drizzle tables door database adapter
        // Gelijk aan hoe modules declarative schemas verwerken
        if (
          connector.declarativeSchema &&
          connector.declarativeSchema.length > 0
        ) {
          // Convert declarative schema to Drizzle format
          // Database adapter zal dit automatisch converteren naar Drizzle tables
          // Gelijk aan hoe modules declarative schemas verwerken
          const declarativeTables: Record<string, any> = {};
          for (const tableSchema of connector.declarativeSchema) {
            // Mark as declarative schema (database adapter zal dit converteren)
            // Zie: ledger/database/postgres/src/index.ts (regel 112-122)
            declarativeTables[tableSchema.name] = {
              _declarativeSchema: tableSchema,
            };
          }

          connectorDrizzleSchemas.push({
            connectorId: connector.id,
            moduleId: module.id,
            tables: declarativeTables,
          });
          logger.debug(
            `Found declarative schema in connector: ${connector.id}`,
            {
              module: module.id,
              connector: connector.id,
              tableCount: connector.declarativeSchema.length,
              tableNames: connector.declarativeSchema.map((t) => t.name),
            }
          );
        }

        logger.debug(`Found connector in module: ${module.id}`, {
          module: module.id,
          connectorId,
          connectorType: connector.type,
          connectorName: connector.name,
          hasDeclarativeSchema: !!connector.declarativeSchema,
          declarativeSchemaCount: connector.declarativeSchema?.length || 0,
        });
      }
    }
  }

  // Merge connector schemas with module schemas
  // Connector schemas worden toegevoegd aan moduleDrizzleSchemas
  // zodat ze samen met module schemas worden geregistreerd
  for (const connectorSchema of connectorDrizzleSchemas) {
    moduleDrizzleSchemas.push({
      moduleId: connectorSchema.moduleId,
      tables: connectorSchema.tables,
    });
    logger.debug(`Added connector schema to module schemas`, {
      connector: connectorSchema.connectorId,
      module: connectorSchema.moduleId,
      tableCount: Object.keys(connectorSchema.tables).length,
    });
  }

  // Register connectors in service container
  // Connectors are registered with key: `connector:${connector.id}`
  for (const { moduleId, connectorId, connector } of moduleConnectors) {
    const serviceName = `connector:${connector.id}`;
    serviceContainer.register(serviceName, connector, moduleId);
    logger.debug(`Registered connector: ${connector.id}`, {
      module: moduleId,
      connectorId,
      serviceName,
    });
  }

  // Also register connectors by type for easy lookup
  // e.g., `connectors:payment` returns all payment connectors
  const connectorsByType = new Map<string, LedgerConnector[]>();
  for (const { connector } of moduleConnectors) {
    if (!connectorsByType.has(connector.type)) {
      connectorsByType.set(connector.type, []);
    }
    connectorsByType.get(connector.type)!.push(connector);
  }

  // Register connector collections by type
  for (const [type, connectors] of connectorsByType.entries()) {
    serviceContainer.register(`connectors:${type}`, connectors);
  }

  // ... rest of createLedger() code ...

  // Call connector.connect() during module start lifecycle
  // (see lifecycle hooks section below)
}
```

**Codebase Analyse**:

- **Service Registration**: `ledger/framework/src/core/ledger.ts` (regel 288-324) - Referentie voor service registratie
- **Module Schema Collection**: Gelijk patroon voor schema collection (regel 128-164)
- **Declarative Schema Detection**: `ledger/framework/src/core/ledger.ts` (regel 142) - Detectie van `_declarativeSchema` marker
- **Declarative Conversion**: Database adapter converteert declarative schemas automatisch naar Drizzle tables
- **Schema Merging**: Connector declarative schemas worden gemerged met module schemas voor database registratie

---

### 4. Connector Lifecycle Hooks

**Waar**: `ledger/framework/src/core/ledger.ts`

**Wat**: Lifecycle hooks voor connectors (connect, disconnect, sync)

**Waarom**: Connectors moeten kunnen connecten/disconnecten en synchroniseren

**Hoe**:

```typescript
// In createLedger(), after module load but before start:

// 1. Call connector.connect() during module start
for (const module of modules) {
  // ... existing module.start() call ...

  // Also call connector.connect() for connectors in this module
  if (module.connectors) {
    for (const connector of Object.values(module.connectors)) {
      if (connector.connect) {
        try {
          await connector.connect();
          logger.debug(`Connected connector: ${connector.id}`, {
            module: module.id,
            connector: connector.id,
          });
        } catch (error) {
          logger.error(`Failed to connect connector: ${connector.id}`, {
            module: module.id,
            connector: connector.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Don't throw - allow ledger to start even if connector fails
          // Connector can retry later
        }
      }
    }
  }
}

// 2. Call connector.disconnect() during module stop
// (in ledger.stop() method)
async stop(): Promise<void> {
  // ... existing stop logic ...

  // Disconnect all connectors
  const connectors = this.serviceContainer
    .getServiceNames()
    .filter((name) => name.startsWith("connector:"))
    .map((name) => this.serviceContainer.resolve<LedgerConnector>(name));

  for (const connector of connectors) {
    if (connector.disconnect) {
      try {
        await connector.disconnect();
        this.logger.debug(`Disconnected connector: ${connector.id}`);
      } catch (error) {
        this.logger.error(`Failed to disconnect connector: ${connector.id}`, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }
}

// 3. Sync method (can be called manually or via scheduled task)
async syncConnectors(type?: string): Promise<void> {
  const connectors = type
    ? this.serviceContainer.resolve<LedgerConnector[]>(`connectors:${type}`)
    : this.serviceContainer
        .getServiceNames()
        .filter((name) => name.startsWith("connector:"))
        .map((name) => this.serviceContainer.resolve<LedgerConnector>(name));

  for (const connector of connectors) {
    if (connector.sync) {
      try {
        await connector.sync();
        this.logger.debug(`Synced connector: ${connector.id}`);
      } catch (error) {
        this.logger.error(`Failed to sync connector: ${connector.id}`, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }
}
```

**Codebase Analyse**:

- **Module Lifecycle**: `ledger/framework/src/core/ledger.ts` (regel 275-340) - Referentie voor lifecycle hooks
- **Error Handling**: Gelijk patroon voor error handling in lifecycle

---

### 5. Connector Helper Methods in OnoalLedger

**Waar**: `ledger/framework/src/core/ledger.ts` (OnoalLedgerImpl class)

**Wat**: Helper methods voor connector access

**Waarom**: Developers moeten connectors kunnen ophalen en gebruiken

**Hoe**:

````typescript
class OnoalLedgerImpl implements OnoalLedger {
  // ... existing code ...

  /**
   * Get connector by ID
   *
   * @param connectorId - Connector ID (e.g., "stripe", "mollie")
   * @returns Connector instance
   * @throws Error if connector not found
   *
   * @example
   * ```typescript
   * const stripeConnector = ledger.getConnector<StripeConnector>("stripe");
   * ```
   */
  getConnector<T extends LedgerConnector = LedgerConnector>(
    connectorId: string
  ): T {
    const serviceName = `connector:${connectorId}`;
    if (!this.serviceContainer.has(serviceName)) {
      const availableConnectors = this.serviceContainer
        .getServiceNames()
        .filter((name) => name.startsWith("connector:"))
        .map((name) => name.replace("connector:", ""));

      throw new ServiceError(
        `Connector not found: ${connectorId}`,
        ErrorCodes.SERVICE_NOT_FOUND,
        availableConnectors,
        `Available connectors: ${availableConnectors.join(", ")}`
      );
    }
    return this.serviceContainer.resolve<T>(serviceName);
  }

  /**
   * Get all connectors of a specific type
   *
   * @param type - Connector type (e.g., "payment", "notification")
   * @returns Array of connectors
   *
   * @example
   * ```typescript
   * const paymentConnectors = ledger.getConnectorsByType<PaymentConnector>("payment");
   * ```
   */
  getConnectorsByType<T extends LedgerConnector = LedgerConnector>(
    type: string
  ): T[] {
    const serviceName = `connectors:${type}`;
    if (!this.serviceContainer.has(serviceName)) {
      return [];
    }
    return this.serviceContainer.resolve<T[]>(serviceName);
  }

  /**
   * Get all connectors
   *
   * @returns Array of all connectors
   */
  getAllConnectors(): LedgerConnector[] {
    return this.serviceContainer
      .getServiceNames()
      .filter((name) => name.startsWith("connector:") && !name.includes(":"))
      .map((name) => this.serviceContainer.resolve<LedgerConnector>(name));
  }

  /**
   * Check if connector exists
   *
   * @param connectorId - Connector ID
   * @returns true if connector exists
   */
  hasConnector(connectorId: string): boolean {
    return this.serviceContainer.has(`connector:${connectorId}`);
  }

  /**
   * Sync all connectors or connectors of a specific type
   *
   * @param type - Optional connector type to sync
   */
  async syncConnectors(type?: string): Promise<void> {
    // Implementation from previous section
  }
}
````

**Codebase Analyse**:

- **getService Method**: `ledger/framework/src/core/ledger.ts` (OnoalLedgerImpl) - Referentie voor service access pattern
- **Type Safety**: Gelijk patroon voor type-safe service resolution

---

### 6. Update OnoalLedger Interface

**Waar**: `ledger/framework/src/core/types.ts`

**Wat**: Nieuwe methods toevoegen aan `OnoalLedger` interface

**Waarom**: Interface moet connector methods bevatten

**Hoe**:

```typescript
export interface OnoalLedger {
  // ... existing methods ...

  /**
   * Get connector by ID
   */
  getConnector<T extends LedgerConnector = LedgerConnector>(
    connectorId: string
  ): T;

  /**
   * Get all connectors of a specific type
   */
  getConnectorsByType<T extends LedgerConnector = LedgerConnector>(
    type: string
  ): T[];

  /**
   * Get all connectors
   */
  getAllConnectors(): LedgerConnector[];

  /**
   * Check if connector exists
   */
  hasConnector(connectorId: string): boolean;

  /**
   * Sync connectors
   */
  syncConnectors(type?: string): Promise<void>;
}
```

**Codebase Analyse**:

- **OnoalLedger Interface**: `ledger/framework/src/core/types.ts` (regel 712-780) - Referentie voor interface structuur

---

## 📊 Implementatie Volgorde

### Fase 1: Core Interface & Types (Prioriteit 1)

1. ✅ **Connector Interface**: `LedgerConnector` interface definiëren
2. ✅ **Connector Declarative Schema Property**: `declarativeSchema` toevoegen
3. ✅ **Module Property**: `connectors` property toevoegen aan `OnoalLedgerModule`
4. ✅ **Ledger Interface**: Connector methods toevoegen aan `OnoalLedger`

**Impact**: Laag - Alleen type definitions, geen breaking changes

**Files**:

- `ledger/framework/src/core/types.ts`

---

### Fase 2: Connector Registry & Schema (Prioriteit 1)

4. ✅ **Connector Collection**: Collect connectors van modules
5. ✅ **Connector Declarative Schema Collection**: Collect connector `declarativeSchema`
6. ✅ **Declarative Schema Conversion**: Converteer declarative schemas naar Drizzle format (met `_declarativeSchema` marker)
7. ✅ **Schema Merging**: Merge connector declarative schemas met module schemas
8. ✅ **Service Registration**: Registreer connectors in service container
9. ✅ **Type-based Registration**: Registreer connectors by type

**Impact**: Laag - Nieuwe functionaliteit, geen breaking changes

**Files**:

- `ledger/framework/src/core/ledger.ts` (createLedger function)

---

### Fase 3: Lifecycle Hooks (Prioriteit 2)

7. ✅ **Connect Hook**: Call `connector.connect()` tijdens module start
8. ✅ **Disconnect Hook**: Call `connector.disconnect()` tijdens module stop
9. ✅ **Error Handling**: Graceful error handling voor connector failures

**Impact**: Medium - Nieuwe lifecycle behavior

**Files**:

- `ledger/framework/src/core/ledger.ts` (module lifecycle)

---

### Fase 4: Helper Methods (Prioriteit 2)

10. ✅ **getConnector()**: Get connector by ID
11. ✅ **getConnectorsByType()**: Get connectors by type
12. ✅ **getAllConnectors()**: Get all connectors
13. ✅ **hasConnector()**: Check connector existence
14. ✅ **syncConnectors()**: Sync connectors

**Impact**: Laag - Nieuwe helper methods

**Files**:

- `ledger/framework/src/core/ledger.ts` (OnoalLedgerImpl class)

---

## 🔍 Codebase Referenties

### Database Adapter Pattern:

- **Interface**: `ledger/framework/src/core/types.ts` (regel 37-43) - `LedgerDatabase` interface
- **Registration**: `ledger/framework/src/core/ledger.ts` (regel 229-230) - Database registratie
- **Usage**: Services gebruiken `ledger.getService<LedgerDatabase>("database")`

### Module Schema Pattern:

- **Module Declarative Schema**: `ledger/framework/src/core/types.ts` (regel 366-387) - `declarativeSchema` property
- **Schema Collection**: `ledger/framework/src/core/ledger.ts` (regel 128-164) - Schema collection pattern
- **Declarative Schema Detection**: `ledger/framework/src/core/ledger.ts` (regel 142) - `_declarativeSchema` marker detection
- **Schema Registration**: `ledger/framework/src/core/ledger.ts` (regel 174-226) - Schema registratie met database adapter
- **Declarative Example**: `ledger-test/src/modules/example-declarative-schema.ts` - Voorbeeld declarative schema definitie

### Service Container:

- **Implementation**: `ledger/framework/src/core/service-container.ts` - ServiceContainer class
- **Registration**: `ledger/framework/src/core/ledger.ts` (regel 288-324) - Service registratie pattern
- **Resolution**: `ledger/framework/src/core/ledger.ts` (OnoalLedgerImpl.getService)

### Module System:

- **Module Interface**: `ledger/framework/src/core/types.ts` (regel 64-124) - `OnoalLedgerModule`
- **Schema Collection**: `ledger/framework/src/core/ledger.ts` (regel 128-164) - Schema collection pattern
- **Lifecycle**: `ledger/framework/src/core/ledger.ts` (regel 275-340) - Module lifecycle hooks

---

## ✅ Checklist

### Fase 1: Core Interface & Types

- [ ] `LedgerConnector` interface definiëren in `types.ts`
- [ ] `declarativeSchema` property toevoegen aan `LedgerConnector` interface
- [ ] `connectors` property toevoegen aan `OnoalLedgerModule`
- [ ] Connector methods toevoegen aan `OnoalLedger` interface

### Fase 2: Connector Registry & Schema

- [ ] Connector collection in `createLedger()`
- [ ] Connector validation (id, name, type)
- [ ] Duplicate connector ID detection
- [ ] Connector declarativeSchema collection (`connector.declarativeSchema`)
- [ ] Declarative schema conversion naar Drizzle format (met `_declarativeSchema` marker)
- [ ] Schema merging met module schemas
- [ ] Service container registratie (`connector:${id}`)
- [ ] Type-based registratie (`connectors:${type}`)

### Fase 3: Lifecycle Hooks

- [ ] `connector.connect()` call tijdens module start
- [ ] `connector.disconnect()` call tijdens module stop
- [ ] Error handling voor connector failures
- [ ] Logging voor connector lifecycle events

### Fase 4: Helper Methods

- [ ] `getConnector<T>(id)` method
- [ ] `getConnectorsByType<T>(type)` method
- [ ] `getAllConnectors()` method
- [ ] `hasConnector(id)` method
- [ ] `syncConnectors(type?)` method

---

## 🚀 Next Steps

Na implementatie van framework updates:

1. **Payment Module**: Implementeer payment connectors met nieuwe framework support
2. **Documentation**: Update framework docs met connector pattern
3. **Examples**: Voeg connector examples toe aan documentation
4. **Testing**: Unit tests voor connector registry en lifecycle

---

## 📝 Samenvatting

### Wat wordt toegevoegd:

1. **`LedgerConnector` Interface**: Basis interface voor alle connectors
2. **Connector `declarativeSchema` Property**: Connectors kunnen declarative schema definitions definiëren (gebruiksvriendelijk)
3. **Module `connectors` Property**: Modules kunnen connectors definiëren
4. **Connector Declarative Schema Collection**: Automatische schema collection van connector declarative schemas
5. **Declarative Schema Conversion**: Automatische conversie van declarative schemas naar Drizzle format
6. **Schema Merging**: Connector declarative schemas worden gemerged met module schemas
7. **Connector Registry**: Automatische registratie in service container
8. **Lifecycle Hooks**: Connect/disconnect tijdens module lifecycle
9. **Helper Methods**: Easy access tot connectors via ledger instance

### Breaking Changes:

**Geen** - Alle wijzigingen zijn backwards compatible:

- Bestaande modules blijven werken
- Nieuwe `connectors` property is optioneel
- Database adapters blijven ongewijzigd

### Benefits:

- ✅ **Unified Pattern**: Gelijk aan database adapters en modules
- ✅ **Declarative Schema Support**: Connectors kunnen eigen database schema's hebben via declarative schema
- ✅ **Developer Experience**: Declarative schemas zijn veel makkelijker te schrijven dan Drizzle tables
- ✅ **Type Safety**: Volledige TypeScript support
- ✅ **Lifecycle Management**: Automatische connect/disconnect
- ✅ **Easy Access**: Helper methods voor connector access
- ✅ **Extensible**: Nieuwe connector types toevoegen zonder framework changes
- ✅ **Consistent**: Gelijk patroon als modules voor declarative schema extensies

### Use Cases voor Connector Declarative Schemas:

- **Payment Connectors**: `payment_accounts`, `payments`, `refunds` tabellen
  - **Voorbeeld**: Zie `example-declarative-schema.ts` voor declarative schema pattern
- **Notification Connectors**: `notifications`, `notification_templates` tabellen
- **Storage Connectors**: `storage_files`, `storage_buckets` tabellen
- **Analytics Connectors**: `analytics_events`, `analytics_sessions` tabellen
- **Webhook Connectors**: `webhook_endpoints`, `webhook_events` tabellen

### Waarom Alleen Declarative Schema?

- ✅ **Gebruiksvriendelijk**: Veel makkelijker te schrijven en onderhouden
- ✅ **Consistent**: Gelijk patroon als modules (modules gebruiken ook declarative schema)
- ✅ **Type Safe**: Volledige TypeScript support via automatische conversie
- ✅ **Minder Boilerplate**: Geen complexe Drizzle table definitions nodig
- ✅ **Eenvoudig**: Simpel object structure, geen Drizzle imports nodig

**Note**: Drizzle schema support kan later worden toegevoegd indien nodig voor advanced use cases.
