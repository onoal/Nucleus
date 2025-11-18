/**
 * Core types for Onoal Ledger
 */

import type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
  ChainVerificationResult,
} from "./types-internal.js";
import { createCustomModule as createUniversalModule } from "@onoal/core";
import { adaptModuleToLedger } from "./ledger-module-adapter.js";
import type { OnoalRoute } from "@onoal/core";

export interface LoggerConfig {
  level?: "debug" | "info" | "warn" | "error";
  enableColors?: boolean;
  enableTimestamp?: boolean;
  enableContext?: boolean;
  format?: "json" | "pretty";
}

export interface OnoalLedgerConfig {
  name: string;
  signingKey: Uint8Array; // Ed25519 private key
  database: LedgerDatabase | (() => LedgerDatabase);
  modules?: OnoalLedgerModule[];
  plugins?: OnoalLedgerPlugin[];
  customSchemas?: SchemaDefinition;
  logger?: LoggerConfig;
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Enable tracing */
  enableTracing?: boolean;
}

export interface LedgerDatabase {
  id: string;
  db: any; // Drizzle database instance
  provider: "sqlite" | "postgres" | "d1";
  migrate?: () => Promise<void>;
  pool?: any; // Database connection pool (for raw SQL queries, e.g., PostgreSQL Pool)
}

/**
 * Connector for external service integration
 *
 * Connectors allow modules to integrate with external services (e.g., payment providers,
 * notification services, storage providers) and sync their state with the ledger.
 *
 * Connectors can define their own database schemas using declarative schema definitions,
 * which are automatically converted to Drizzle tables and merged with module schemas.
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
   *       { id: "id", name: "id", type: "text", required: true, primaryKey: true },
   *       { id: "account_oid", name: "account_oid", type: "text", required: true },
   *       // ...
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

/**
 * Type helper to extract database provider type
 * Useful for type-safe database selection
 */
export type DatabaseProvider = LedgerDatabase["provider"];

/**
 * Type helper to check if database is of specific provider type
 * @example
 * ```typescript
 * if (database.provider === "postgres") {
 *   // TypeScript knows this is a PostgreSQL database
 * }
 * ```
 */
export type DatabaseByProvider<T extends DatabaseProvider> = LedgerDatabase & {
  provider: T;
};

export interface OnoalLedgerModule {
  id: string;
  label?: string;
  version?: string;
  dependencies?: string[];
  load?: (ledger: OnoalLedger) => Promise<void>;
  start?: (ledger: OnoalLedger) => Promise<void>;
  stop?: (ledger: OnoalLedger) => Promise<void>;
  services?: Record<string, new (ledger: OnoalLedger) => any>;
  routes?: Array<{
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    path: string;
    handler: (
      req: Request,
      ledger: OnoalLedger,
      params: Record<string, string | undefined> & {
        _requester_oid?: string;
        _request_context?:
          | import("../middleware/auth.js").RequestContext
          | null;
      }
    ) => Promise<Response>;
  }>;
  /**
   * Route hooks (called before/after route handlers)
   *
   * Similar to plugin hooks pattern but for routes.
   * `beforeRoute` can short-circuit by returning a Response.
   * `afterRoute` can modify the response (headers, logging, etc.).
   */
  routeHooks?: {
    beforeRoute?: (
      req: Request,
      route: import("../server/index.js").LedgerRoute,
      ledger: OnoalLedger
    ) => Promise<void | Response>; // Return Response to short-circuit
    afterRoute?: (
      req: Request,
      route: import("../server/index.js").LedgerRoute,
      response: Response,
      ledger: OnoalLedger
    ) => Promise<Response>; // Can modify response
  };
  /**
   * Drizzle schema tables for database adapters
   *
   * Modules can export Drizzle table definitions that will be
   * automatically registered with the database adapter.
   *
   * @example
   * ```typescript
   * drizzleSchema: {
   *   myTable: pgTable("my_table", {
   *     id: text("id").primaryKey(),
   *     // ...
   *   }),
   * }
   * ```
   */
  drizzleSchema?: Record<string, any>;

  /**
   * Connectors for external service integration
   *
   * Modules can define connectors to integrate with external services
   * (e.g., payment providers, notification services, storage providers).
   * Connectors are automatically registered in the service container and
   * their declarative schemas are merged with module schemas.
   *
   * @example
   * ```typescript
   * connectors: {
   *   stripe: {
   *     id: "stripe",
   *     name: "Stripe",
   *     type: "payment",
   *     declarativeSchema: [
   *       {
   *         id: "payment_accounts",
   *         name: "payment_accounts",
   *         type: "table",
   *         fields: [
   *           { id: "id", name: "id", type: "text", required: true, primaryKey: true },
   *           // ...
   *         ],
   *       },
   *     ],
   *     connect: async () => {
   *       // Initialize Stripe client
   *     },
   *   },
   * }
   * ```
   */
  connectors?: Record<string, LedgerConnector>;
}

/**
 * Route handler type for custom modules
 * Provides type-safe route handler signature
 */
export type LedgerRouteHandler = (
  req: Request,
  ledger: OnoalLedger,
  params: Record<string, string | undefined> & {
    _requester_oid?: string;
    _request_context?: import("../middleware/auth.js").RequestContext | null;
  }
) => Promise<Response>;

/**
 * Route definition for custom modules
 * Simplified route definition with type safety
 */
export interface LedgerRoute {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: LedgerRouteHandler;
}

/**
 * Service definition for custom modules
 *
 * Can be:
 * - Service class constructor: `new (ledger: OnoalLedger) => any`
 * - Service factory function: `(ledger: OnoalLedger) => any`
 * - Direct service instance: `any` (object)
 *
 * @example
 * ```typescript
 * services: {
 *   // Class constructor (traditional)
 *   myService: MyService,
 *
 *   // Factory function (inline service)
 *   myService2: (ledger) => ({
 *     method: () => {...},
 *     anotherMethod: () => {...}
 *   }),
 *
 *   // Direct object (static service)
 *   myService3: {
 *     method: () => {...}
 *   }
 * }
 * ```
 */
export type LedgerServices = Record<
  string,
  (new (ledger: OnoalLedger) => any) | ((ledger: OnoalLedger) => any) | any
>;

/**
 * Database Schema Field Definition
 * Similar to BetterAuth's schema field definition
 */
export interface SchemaField {
  /** Field type */
  type: "string" | "number" | "boolean" | "date" | "bigint" | "json";
  /** Whether field is required */
  required?: boolean;
  /** Whether field is unique */
  unique?: boolean;
  /** Reference to another table (foreign key) */
  references?: {
    table: string;
    column: string;
  } | null;
  /** Default value */
  default?: unknown;
}

/**
 * Module Schema Definition
 * Allows modules to extend database schemas (BetterAuth pattern)
 *
 * @example
 * ```typescript
 * schema: {
 *   ledger_entries: {
 *     fields: {
 *       custom_field: {
 *         type: "string",
 *         required: false,
 *       },
 *     },
 *   },
 * },
 * ```
 */
export interface ModuleSchema {
  /** Extend existing tables */
  [tableName: string]: {
    fields: Record<string, SchemaField>;
  };
}

/**
 * Ledger Operation Hooks
 * Hooks for ledger operations (BetterAuth pattern)
 */
export interface LedgerHooks {
  /** Before append hook */
  beforeAppend?: (
    entry: {
      type: string;
      issuer_oid: string;
      subject_oid?: string;
      payload: unknown;
      meta?: Record<string, unknown>;
      stream?: LedgerStream;
    },
    ledger: OnoalLedger
  ) => Promise<void | {
    entry?: {
      type: string;
      issuer_oid: string;
      subject_oid?: string;
      payload: unknown;
      meta?: Record<string, unknown>;
      stream?: LedgerStream;
    }; // Can modify entry
    shortCircuit?: LedgerEntry & { proof_jwt: string }; // Can short-circuit
  }>;
  /** After append hook */
  afterAppend?: (
    entry: LedgerEntry & { proof_jwt: string },
    ledger: OnoalLedger
  ) => Promise<void>;
  /** Before query hook */
  beforeQuery?: (
    filters: {
      stream?: LedgerStream;
      subject_oid?: string;
      issuer_oid?: string;
      status?: EntryStatus;
      limit?: number;
      cursor?: number;
    },
    ledger: OnoalLedger
  ) => Promise<void | {
    filters?: {
      stream?: LedgerStream;
      subject_oid?: string;
      issuer_oid?: string;
      status?: EntryStatus;
      limit?: number;
      cursor?: number;
    }; // Can modify filters
    shortCircuit?: {
      entries: LedgerEntry[];
      nextCursor: number | null;
      hasMore: boolean;
    }; // Can short-circuit
  }>;
  /** After query hook */
  afterQuery?: (
    result: {
      entries: LedgerEntry[];
      nextCursor: number | null;
      hasMore: boolean;
    },
    filters: {
      stream?: LedgerStream;
      subject_oid?: string;
      issuer_oid?: string;
      status?: EntryStatus;
      limit?: number;
      cursor?: number;
    },
    ledger: OnoalLedger
  ) => Promise<{
    entries: LedgerEntry[];
    nextCursor: number | null;
    hasMore: boolean;
  }>; // Can modify result

  /** Before get hook */
  beforeGet?: (id: string, ledger: OnoalLedger) => Promise<void | LedgerEntry>; // Can short-circuit by returning entry

  /** After get hook */
  afterGet?: (
    entry: LedgerEntry | null,
    id: string,
    ledger: OnoalLedger
  ) => Promise<LedgerEntry | null>; // Can modify result

  /** Before verify chain hook */
  beforeVerifyChain?: (
    startId: string | undefined,
    limit: number | undefined,
    ledger: OnoalLedger
  ) => Promise<void>;

  /** After verify chain hook */
  afterVerifyChain?: (
    result: ChainVerificationResult,
    ledger: OnoalLedger
  ) => Promise<ChainVerificationResult>; // Can modify result
}

/**
 * Custom Module Options
 * Simplified options for creating custom modules (BetterAuth pattern)
 */
export interface CustomModuleOptions {
  /** Module ID (required, must be unique) */
  id: string;
  /** Human-readable label */
  label?: string;
  /** Module version */
  version?: string;
  /** Module dependencies (other module IDs) */
  dependencies?: string[];
  /** Service classes to register */
  services?: LedgerServices;
  /** API routes */
  routes?: LedgerRoute[];
  /** Database schema extensions (BetterAuth pattern) */
  schema?: ModuleSchema;
  /**
   * Drizzle schema tables for database adapters
   *
   * Modules can export Drizzle table definitions that will be
   * automatically registered with the database adapter.
   *
   * @example
   * ```typescript
   * drizzleSchema: {
   *   myTable: pgTable("my_table", {
   *     id: text("id").primaryKey(),
   *     // ...
   *   }),
   * }
   * ```
   */
  drizzleSchema?: Record<string, any>;
  /**
   * Declarative schema definition
   *
   * Een declaratieve manier om database tabellen te definiëren.
   * Dit is gebruiksvriendelijker dan Drizzle table definitions.
   *
   * @example
   * ```typescript
   * declarativeSchema: [
   *   {
   *     id: "tokens",
   *     name: "tokens",
   *     type: "table",
   *     fields: [
   *       { id: "id", name: "id", type: "text", required: true, primaryKey: true },
   *       { id: "symbol", name: "symbol", type: "text" },
   *     ],
   *   },
   * ]
   * ```
   */
  declarativeSchema?: import("@onoal/core").DeclarativeTableSchema[];
  /** Ledger operation hooks (BetterAuth pattern) */
  hooks?: LedgerHooks;
  /** Route hooks (before/after) */
  routeHooks?: {
    beforeRoute?: (
      req: Request,
      route: import("../server/index.js").LedgerRoute,
      ledger: OnoalLedger
    ) => Promise<void | Response>;
    afterRoute?: (
      req: Request,
      route: import("../server/index.js").LedgerRoute,
      response: Response,
      ledger: OnoalLedger
    ) => Promise<Response>;
  };
  /** Lifecycle hooks */
  lifecycle?: {
    load?: (ledger: OnoalLedger) => Promise<void>;
    start?: (ledger: OnoalLedger) => Promise<void>;
    stop?: (ledger: OnoalLedger) => Promise<void>;
  };
}

/**
 * Create a custom module
 *
 * Helper function to create a custom module with type safety.
 * This makes it easier to create modules that work alongside built-in modules.
 *
 * **Note:** Deze functie gebruikt nu de universele `@onoal/core` helper
 * en adapteert het naar ledger-specifieke types. Dit zorgt voor backward
 * compatibility en maakt modules herbruikbaar tussen frameworks.
 *
 * @example
 * ```typescript
 * import { createCustomModule } from "@onoal/ledger-core";
 * import { MyService } from "./services/my-service.js";
 *
 * export const myModule = createCustomModule({
 *   id: "my-module",
 *   label: "My Custom Module",
 *   version: "1.0.0",
 *   services: {
 *     myService: MyService,
 *   },
 *   routes: [
 *     {
 *       method: "POST",
 *       path: "/my-module/create",
 *       handler: async (req, ledger, params) => {
 *         const service = ledger.getService<MyService>("myService");
 *         // ...
 *       },
 *     },
 *   ],
 * });
 * ```
 */
/**
 * Create a custom module (BetterAuth pattern)
 *
 * Helper function to create a custom module with type safety.
 * This makes it easier to create modules that work alongside built-in modules.
 *
 * Similar to BetterAuth's plugin pattern:
 * - Schema extensions for database tables
 * - Hooks for ledger operations
 * - Services and routes
 * - Type inference support
 *
 * **Implementation:** Gebruikt universele `@onoal/core` helper en adapteert
 * naar ledger-specifieke interface voor backward compatibility.
 *
 * @example
 * ```typescript
 * import { createCustomModule } from "@onoal/ledger-core";
 * import { MyService } from "./services/my-service.js";
 *
 * export const myModule = createCustomModule({
 *   id: "my-module",
 *   label: "My Custom Module",
 *   version: "1.0.0",
 *   schema: {
 *     ledger_entries: {
 *       fields: {
 *         custom_field: {
 *           type: "string",
 *           required: false,
 *         },
 *       },
 *     },
 *   },
 *   hooks: {
 *     beforeAppend: async (entry, ledger) => {
 *       // Validate or modify entry
 *     },
 *   },
 *   services: {
 *     myService: MyService,
 *   },
 *   routes: [
 *     {
 *       method: "POST",
 *       path: "/my-module/create",
 *       handler: async (req, ledger, params) => {
 *         const service = ledger.getService<MyService>("myService");
 *         // ...
 *       },
 *     },
 *   ],
 * });
 * ```
 */
export function createCustomModule(
  options: CustomModuleOptions
): OnoalLedgerModule {
  // Gebruik universele helper met ledger context
  const universalModule = createUniversalModule<OnoalLedger>({
    id: options.id,
    label: options.label,
    version: options.version,
    dependencies: options.dependencies,
    services: options.services,
    routes: options.routes?.map((route) => ({
      method: route.method,
      path: route.path,
      // Map ledger route handler to universele handler
      // Ledger handler has extra params (_requester_oid, _request_context)
      // but universele handler has optional params
      handler: async (
        req: Request,
        context: OnoalLedger,
        params?: Record<string, string | undefined>
      ) => {
        // Convert optional params to ledger params format
        // Ledger expects params with _requester_oid and _request_context
        const ledgerParams = {
          ...(params || {}),
        } as Record<string, string | undefined> & {
          _requester_oid?: string;
          _request_context?:
            | import("../middleware/auth.js").RequestContext
            | null;
        };
        return route.handler(req, context, ledgerParams);
      },
    })),
    schema: options.schema,
    drizzleSchema: options.drizzleSchema,
    declarativeSchema: options.declarativeSchema,
    hooks: options.hooks as Record<string, (...args: any[]) => any>,
    routeHooks: options.routeHooks
      ? {
          beforeRoute: options.routeHooks.beforeRoute
            ? async (
                req: Request,
                route: OnoalRoute<OnoalLedger>,
                ledger: OnoalLedger
              ) => {
                const ledgerRoute: LedgerRoute = {
                  method: route.method,
                  path: route.path,
                  handler: route.handler as LedgerRouteHandler,
                };
                return options.routeHooks!.beforeRoute!(
                  req,
                  ledgerRoute,
                  ledger
                );
              }
            : undefined,
          afterRoute: options.routeHooks.afterRoute
            ? async (
                req: Request,
                route: OnoalRoute<OnoalLedger>,
                response: Response,
                ledger: OnoalLedger
              ) => {
                const ledgerRoute: LedgerRoute = {
                  method: route.method,
                  path: route.path,
                  handler: route.handler as LedgerRouteHandler,
                };
                return options.routeHooks!.afterRoute!(
                  req,
                  ledgerRoute,
                  response,
                  ledger
                );
              }
            : undefined,
        }
      : undefined,
    lifecycle: options.lifecycle,
  });

  // Adapt naar ledger-specifieke interface
  return adaptModuleToLedger(universalModule);
}

export interface OnoalLedgerPlugin {
  id: string;
  version: string;
  hooks?: {
    // Existing append hooks
    beforeAppend?: (
      entry: {
        type: string;
        issuer_oid: string;
        subject_oid?: string;
        payload: unknown;
        meta?: Record<string, unknown>;
        stream?: LedgerStream;
      },
      ledger: OnoalLedger
    ) => Promise<void>;
    afterAppend?: (
      entry: LedgerEntry & { proof_jwt: string },
      ledger: OnoalLedger
    ) => Promise<void>;

    // Query hooks
    beforeQuery?: (
      filters: {
        stream?: LedgerStream;
        subject_oid?: string;
        issuer_oid?: string;
        status?: EntryStatus;
        limit?: number;
        cursor?: number;
      },
      ledger: OnoalLedger
    ) => Promise<void | {
      filters?: {
        stream?: LedgerStream;
        subject_oid?: string;
        issuer_oid?: string;
        status?: EntryStatus;
        limit?: number;
        cursor?: number;
      }; // Can modify filters
      shortCircuit?: {
        entries: LedgerEntry[];
        nextCursor: number | null;
        hasMore: boolean;
      }; // Can short-circuit
    }>;
    afterQuery?: (
      result: {
        entries: LedgerEntry[];
        nextCursor: number | null;
        hasMore: boolean;
      },
      filters: {
        stream?: LedgerStream;
        subject_oid?: string;
        issuer_oid?: string;
        status?: EntryStatus;
        limit?: number;
        cursor?: number;
      },
      ledger: OnoalLedger
    ) => Promise<{
      entries: LedgerEntry[];
      nextCursor: number | null;
      hasMore: boolean;
    }>; // Can modify result

    // Get hooks
    beforeGet?: (
      id: string,
      ledger: OnoalLedger
    ) => Promise<void | LedgerEntry>; // Can short-circuit by returning entry
    afterGet?: (
      entry: LedgerEntry | null,
      id: string,
      ledger: OnoalLedger
    ) => Promise<LedgerEntry | null>; // Can modify result

    // Chain verification hooks
    beforeVerifyChain?: (
      startId: string | undefined,
      limit: number | undefined,
      ledger: OnoalLedger
    ) => Promise<void>;
    afterVerifyChain?: (
      result: ChainVerificationResult,
      ledger: OnoalLedger
    ) => Promise<ChainVerificationResult>; // Can modify result
  };
}

export interface SchemaDefinition {
  [type: string]: {
    type: "object";
    required?: string[];
    properties: Record<
      string,
      {
        type: string;
        format?: string; // e.g., "oid", "timestamp"
        pattern?: string; // e.g., "^oid:onoal:"
        default?: unknown;
      }
    >;
  };
}

export type InferSchemaType<T> = T extends {
  type: "object";
  properties: infer P;
}
  ? {
      [K in keyof P]: P[K] extends { type: "string" }
        ? string
        : P[K] extends { type: "number" }
          ? number
          : P[K] extends { type: "boolean" }
            ? boolean
            : unknown;
    }
  : never;

export interface OnoalLedger {
  config: OnoalLedgerConfig;
  append<T extends keyof SchemaDefinition>(entry: {
    type: T;
    issuer_oid: string;
    subject_oid?: string;
    payload: InferSchemaType<SchemaDefinition[T]>;
    meta?: Record<string, unknown>;
    stream?: LedgerStream;
  }): Promise<LedgerEntry & { proof_jwt: string }>;
  /**
   * Batch append multiple entries atomically
   *
   * All entries are appended in a single transaction. If any entry fails,
   * the entire batch is rolled back.
   */
  appendBatch<T extends keyof SchemaDefinition>(
    entries: Array<{
      type: T;
      issuer_oid: string;
      subject_oid?: string;
      payload: InferSchemaType<SchemaDefinition[T]>;
      meta?: Record<string, unknown>;
      stream?: LedgerStream;
    }>
  ): Promise<Array<LedgerEntry & { proof_jwt: string }>>;
  get(id: string): Promise<LedgerEntry | null>;
  query(filters: {
    stream?: LedgerStream;
    subject_oid?: string;
    issuer_oid?: string;
    status?: EntryStatus;
    limit?: number;
    cursor?: number;
  }): Promise<{
    entries: LedgerEntry[];
    nextCursor: number | null;
    hasMore: boolean;
  }>;
  verifyChain(
    startId?: string,
    limit?: number
  ): Promise<ChainVerificationResult>;
  /**
   * Verify a single entry's integrity
   *
   * Checks hash, signature, and chain link for a single entry.
   *
   * @param entryId - Entry ID to verify
   * @returns Verification result with errors array
   */
  verifyEntry(entryId: string): Promise<{
    valid: boolean;
    errors: string[];
    entry_id: string;
  }>;
  getService<T>(serviceName: string): T;
  hasService(serviceName: string): boolean;
  getServiceNames(): string[];
  use(plugin: OnoalLedgerPlugin): this;
  useModule(module: OnoalLedgerModule): this;
  getModules(): OnoalLedgerModule[];
  getPlugins(): OnoalLedgerPlugin[];
  /** Get metrics collector (if enabled) */
  getMetrics?(): import("@onoal/core").Metrics;
  /** Get metrics summary (if enabled) */
  getMetricsSummary?(): ReturnType<
    import("@onoal/core").MetricsCollector["getMetricsSummary"]
  >;
  /**
   * Get a connector by ID
   *
   * @param connectorId - Connector identifier
   * @returns Connector instance or undefined if not found
   */
  getConnector<T extends LedgerConnector = LedgerConnector>(
    connectorId: string
  ): T | undefined;
  /**
   * Get all connectors of a specific type
   *
   * @param type - Connector type (e.g., "payment", "notification")
   * @returns Array of connector instances
   */
  getConnectorsByType<T extends LedgerConnector = LedgerConnector>(
    type: string
  ): T[];
  /**
   * Get all connectors
   *
   * @returns Array of all connector instances
   */
  getConnectors(): LedgerConnector[];
}
