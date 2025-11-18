/**
 * Ledger creation factory and implementation
 *
 * @module core/ledger
 */

import type {
  OnoalLedgerConfig,
  OnoalLedger,
  OnoalLedgerModule,
  OnoalLedgerPlugin,
  SchemaDefinition,
  InferSchemaType,
  LedgerDatabase,
  LedgerConnector,
} from "./types.js";
import { ServiceContainer } from "./service-container.js";
import { LedgerCore } from "./ledger-core.js";
import { HashChain } from "./hash-chain.js";
import { LedgerSigner } from "./signer.js";
import { createLogger, type Logger } from "../utils/logger.js";
import type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
} from "./types-internal.js";
import {
  ModuleError,
  ErrorCodes,
  SchemaError,
  createMetricsCollector,
  type MetricsCollector,
  createTrace,
  startSpan,
  endSpan,
  generateTraceId,
  type TraceContext,
} from "@onoal/core";

/**
 * Helper to convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a new Onoal Ledger instance
 *
 * Factory function (BetterAuth pattern) that creates a configured ledger instance
 * with modules, plugins, and databases.
 *
 * @param config - Ledger configuration
 * @returns Configured ledger instance
 *
 * @example
 * ```typescript
 * const ledger = await createLedger({
 *   name: "my-ledger",
 *   signingKey: privateKey,
 *   database: sqliteAdapter("ledger.db"),
 *   modules: [proofModule(), assetModule()],
 *   plugins: [webhookPlugin()],
 * });
 * ```
 */
export async function createLedger(
  config: OnoalLedgerConfig
): Promise<OnoalLedger> {
  // Validate config
  if (!config.name || typeof config.name !== "string") {
    throw new ModuleError(
      "Ledger name is required",
      ErrorCodes.MODULE_LOAD_FAILED,
      "Provide a valid ledger name in the configuration",
      {
        config: {
          ...config,
          signingKey: config.signingKey ? "[REDACTED]" : undefined,
        },
      }
    );
  }
  if (!config.signingKey || !(config.signingKey instanceof Uint8Array)) {
    throw new ModuleError(
      "Signing key must be Uint8Array (Ed25519 private key)",
      ErrorCodes.MODULE_LOAD_FAILED,
      "Generate a signing key using: crypto.getRandomValues(new Uint8Array(32))",
      { signingKeyType: typeof config.signingKey }
    );
  }
  if (!config.database) {
    throw new ModuleError(
      "Database is required",
      ErrorCodes.MODULE_LOAD_FAILED,
      "Provide a database adapter (e.g., sqliteAdapter, postgresAdapter)",
      {}
    );
  }

  // Initialize service container
  const serviceContainer = new ServiceContainer();

  // Create logger with config
  const logger = createLogger({
    level: config.logger?.level || "info",
    enableColors: config.logger?.enableColors ?? true,
    enableTimestamp: config.logger?.enableTimestamp ?? true,
    enableContext: config.logger?.enableContext ?? true,
    format: config.logger?.format || "pretty",
  });
  logger.setContext({ ledger: config.name });
  serviceContainer.register("logger", logger);

  // Initialize modules and plugins (before database registration)
  // This allows us to collect schema information from modules
  const modules: OnoalLedgerModule[] = config.modules || [];
  const plugins: OnoalLedgerPlugin[] = config.plugins || [];

  // Collect Drizzle schemas from modules
  // Modules can export Drizzle table definitions via drizzleSchema property
  const moduleDrizzleSchemas: Array<{
    moduleId: string;
    tables: Record<string, any>;
  }> = [];

  // Collect connectors from modules
  // Connectors can export declarative schema definitions
  const allConnectors: Array<{
    connectorId: string;
    moduleId: string;
    connector: import("./types.js").LedgerConnector;
  }> = [];
  const connectorDrizzleSchemas: Array<{
    connectorId: string;
    moduleId: string;
    tables: Record<string, any>;
  }> = [];
  const connectorIds = new Set<string>();

  for (const module of modules) {
    // Debug: log module structure
    logger.debug(`Checking module for schemas: ${module.id}`, {
      module: module.id,
      hasDrizzleSchema: !!module.drizzleSchema,
      drizzleSchemaKeys: module.drizzleSchema
        ? Object.keys(module.drizzleSchema)
        : [],
      drizzleSchemaContent: module.drizzleSchema
        ? JSON.stringify(
            Object.keys(module.drizzleSchema).reduce(
              (acc, key) => {
                const val = module.drizzleSchema![key];
                acc[key] =
                  val && typeof val === "object" && "_declarativeSchema" in val
                    ? "DECLARATIVE"
                    : "DRIZZLE";
                return acc;
              },
              {} as Record<string, string>
            )
          )
        : null,
    });

    if (module.drizzleSchema && Object.keys(module.drizzleSchema).length > 0) {
      moduleDrizzleSchemas.push({
        moduleId: module.id,
        tables: module.drizzleSchema,
      });
      logger.debug(`Found Drizzle schema in module: ${module.id}`, {
        module: module.id,
        tableCount: Object.keys(module.drizzleSchema).length,
        tableNames: Object.keys(module.drizzleSchema),
      });
    }

    // Collect connectors from module
    if (module.connectors && Object.keys(module.connectors).length > 0) {
      for (const [connectorId, connector] of Object.entries(
        module.connectors
      )) {
        // Validate connector
        if (!connector.id || !connector.name || !connector.type) {
          throw new Error(
            `Invalid connector in module ${module.id}: connector must have id, name, and type`
          );
        }

        // Check for duplicate connector IDs
        if (connectorIds.has(connector.id)) {
          throw new Error(
            `Duplicate connector ID: ${connector.id} (found in module ${module.id})`
          );
        }
        connectorIds.add(connector.id);

        // Store connector
        allConnectors.push({
          connectorId: connector.id,
          moduleId: module.id,
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
          connectorId: connector.id,
          connectorType: connector.type,
          connectorName: connector.name,
          hasDeclarativeSchema: !!connector.declarativeSchema,
          declarativeSchemaCount: connector.declarativeSchema?.length || 0,
        });
      }
    }
  }

  // Resolve database adapter (support factory function for dynamic schema injection)
  let database: LedgerDatabase;

  if (typeof config.database === "function") {
    // Database factory function - call with module schemas
    // This allows adapters to be created with module schemas automatically
    database = config.database();

    // Merge connector schemas with module schemas
    const allModuleSchemas = [
      ...moduleDrizzleSchemas,
      ...connectorDrizzleSchemas,
    ];

    // If adapter supports addModuleSchemas, add schemas dynamically
    if (
      allModuleSchemas.length > 0 &&
      "addModuleSchemas" in database &&
      typeof (database as any).addModuleSchemas === "function"
    ) {
      (database as any).addModuleSchemas(allModuleSchemas);
      logger.debug("Added module and connector schemas to database adapter", {
        moduleCount: moduleDrizzleSchemas.length,
        connectorCount: connectorDrizzleSchemas.length,
        totalCount: allModuleSchemas.length,
      });

      // Note: Migrations are no longer run automatically
      // Use CLI command: onoal db:generate and onoal db:migrate
      logger.debug(
        "Module and connector schemas added (migrations must be run manually via CLI)",
        {
          moduleCount: moduleDrizzleSchemas.length,
          connectorCount: connectorDrizzleSchemas.length,
        }
      );
    }
  } else {
    // Direct database instance
    database = config.database;

    // Merge connector schemas with module schemas
    const allModuleSchemas = [
      ...moduleDrizzleSchemas,
      ...connectorDrizzleSchemas,
    ];

    // If adapter supports addModuleSchemas, add schemas dynamically
    if (
      allModuleSchemas.length > 0 &&
      "addModuleSchemas" in database &&
      typeof (database as any).addModuleSchemas === "function"
    ) {
      (database as any).addModuleSchemas(allModuleSchemas);
      logger.debug("Added module and connector schemas to database adapter", {
        moduleCount: moduleDrizzleSchemas.length,
        connectorCount: connectorDrizzleSchemas.length,
        totalCount: allModuleSchemas.length,
      });

      // Note: Migrations are no longer run automatically
      // Use CLI command: onoal db:generate and onoal db:migrate
      logger.debug(
        "Module and connector schemas added (migrations must be run manually via CLI)",
        {
          moduleCount: moduleDrizzleSchemas.length,
          connectorCount: connectorDrizzleSchemas.length,
        }
      );
    } else if (moduleDrizzleSchemas.length > 0) {
      // Warn if schemas found but adapter doesn't support dynamic addition
      logger.warn(
        `Found ${moduleDrizzleSchemas.length} module schema(s) but database adapter doesn't support dynamic schema addition. ` +
          `Consider using a database factory function or passing moduleSchemas during adapter creation.`,
        {
          modules: moduleDrizzleSchemas.map((m) => m.moduleId),
        }
      );
    }
  }

  // Register database as service (needed by other services)
  serviceContainer.register("database", database);

  // Create ledger signer
  // Based on: onoal/ledger/src/lib/signer-factory.ts
  const privateKeyHex = bytesToHex(config.signingKey);
  const kid = config.name; // Use ledger name as key ID
  const signer = new LedgerSigner(privateKeyHex, kid);
  serviceContainer.register("signer", signer);

  // Collect module hooks (naast plugins)
  // Module hooks worden opgeslagen in _hooks property
  const moduleHooks: import("./types.js").LedgerHooks[] = [];
  for (const module of modules) {
    const hooks = (module as any)._hooks as
      | import("./types.js").LedgerHooks
      | undefined;
    if (hooks) {
      moduleHooks.push(hooks);
    }
  }

  // Create metrics collector if enabled
  const metricsCollector =
    config.enableMetrics !== false ? createMetricsCollector() : undefined;
  if (metricsCollector) {
    serviceContainer.register("metrics", metricsCollector);
  }

  // Register connectors in service container
  // Connectors are registered by ID and by type for easy access
  for (const { connectorId, connector } of allConnectors) {
    // Register by ID: connector:${id}
    serviceContainer.register(`connector:${connectorId}`, connector);

    // Register by type: connectors:${type}
    // This allows getting all connectors of a specific type
    const typeKey = `connectors:${connector.type}`;
    const existingConnectors =
      serviceContainer.resolve<LedgerConnector[]>(typeKey) || [];
    serviceContainer.register(typeKey, [...existingConnectors, connector]);

    logger.debug(`Registered connector: ${connectorId}`, {
      connectorId: connector.id,
      connectorType: connector.type,
      connectorName: connector.name,
    });
  }

  // Create ledger instance (needed for module loading)
  const ledger = new OnoalLedgerImpl(
    config,
    serviceContainer,
    modules,
    plugins,
    signer,
    moduleHooks,
    database,
    metricsCollector,
    allConnectors.map((c) => c.connector)
  );

  // Load modules (Medusa.js pattern)
  // Order: load → register services → start
  for (const module of modules) {
    try {
      logger.debug(`Loading module: ${module.id}`, { module: module.id });

      // 1. Load module (setup, validation, etc.)
      if (module.load) {
        await logger.time(
          `module.${module.id}.load`,
          async () => {
            await module.load!(ledger);
          },
          { module: module.id }
        );
      }

      // 2. Register module services
      if (module.services) {
        for (const [serviceName, serviceDef] of Object.entries(
          module.services
        )) {
          let service: any;

          // Support multiple service definition formats:
          // 1. Class constructor: new ServiceClass(ledger)
          // 2. Factory function: (ledger) => serviceObject
          // 3. Direct object: serviceObject
          if (typeof serviceDef === "function") {
            // Check if it's a class constructor (has prototype with constructor)
            if (
              serviceDef.prototype &&
              serviceDef.prototype.constructor === serviceDef
            ) {
              // Class constructor
              service = new (serviceDef as new (ledger: OnoalLedger) => any)(
                ledger
              );
            } else {
              // Factory function
              service = (serviceDef as unknown as (ledger: OnoalLedger) => any)(
                ledger
              );
            }
          } else {
            // Direct object
            service = serviceDef;
          }

          // Store factory for type inference
          serviceContainer.register(
            serviceName,
            service,
            module.id,
            serviceDef // Pass factory for type inference
          );
          logger.debug(`Registered service: ${serviceName}`, {
            module: module.id,
            service: serviceName,
          });
        }
      }

      // 3. Start module (initialize, connect to external services, etc.)
      if (module.start) {
        await logger.time(
          `module.${module.id}.start`,
          async () => {
            await module.start!(ledger);
          },
          { module: module.id }
        );
      }

      // 4. Connect module connectors (after module start)
      if (module.connectors) {
        for (const connector of Object.values(module.connectors)) {
          if (connector.connect) {
            try {
              await logger.time(
                `connector.${connector.id}.connect`,
                async () => {
                  await connector.connect!();
                },
                { connector: connector.id, module: module.id }
              );
              logger.debug(`Connected connector: ${connector.id}`, {
                connector: connector.id,
                module: module.id,
              });
            } catch (error) {
              logger.error(
                `Failed to connect connector: ${connector.id}`,
                error instanceof Error ? error : new Error(String(error)),
                { connector: connector.id, module: module.id }
              );
              // Don't throw - allow module to continue even if connector fails
            }
          }
        }
      }

      logger.info(`Module loaded: ${module.id}`, { module: module.id });
    } catch (error) {
      logger.error(
        `Failed to load module: ${module.id}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          module: module.id,
        }
      );
      throw new Error(
        `Failed to load module ${module.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Initialize plugins (BetterAuth pattern)
  for (const plugin of plugins) {
    // Plugins are registered but hooks are called during ledger operations
    // No initialization needed here
  }

  return ledger;
}

/**
 * OnoalLedger implementation
 *
 * Based on: onoal/ledger/src/ledger-core.ts
 */
class OnoalLedgerImpl implements OnoalLedger {
  private logger: Logger;
  private database: LedgerDatabase;
  private metricsCollector?: MetricsCollector;
  private enableTracing: boolean;
  private connectors: import("./types.js").LedgerConnector[];

  constructor(
    public config: OnoalLedgerConfig,
    private serviceContainer: ServiceContainer,
    private modules: OnoalLedgerModule[],
    private plugins: OnoalLedgerPlugin[],
    private signer: LedgerSigner,
    private moduleHooks: import("./types.js").LedgerHooks[],
    database: LedgerDatabase,
    metricsCollector?: MetricsCollector,
    connectors: import("./types.js").LedgerConnector[] = []
  ) {
    this.database = database;
    this.logger = serviceContainer.resolve<Logger>("logger");
    this.metricsCollector = metricsCollector;
    this.enableTracing = config.enableTracing !== false;
    this.connectors = connectors;
  }

  /**
   * Extract user payload and OIDs from ledger entry payload
   * The stored payload contains: id, type, issuer_oid, subject_oid, payload, timestamp
   * We extract the user payload and expose issuer_oid/subject_oid at top level
   */
  private extractEntryData(ledgerEntry: LedgerEntry): LedgerEntry & {
    issuer_oid?: string;
    subject_oid?: string;
  } {
    const entryPayload = ledgerEntry.payload as {
      id?: string;
      type?: string;
      issuer_oid?: string;
      subject_oid?: string;
      payload?: Record<string, unknown>;
      timestamp?: number;
    };

    // Extract user payload (the actual payload field inside entryPayload)
    const userPayload = (entryPayload.payload || entryPayload) as Record<
      string,
      unknown
    >;
    const issuerOid =
      entryPayload.issuer_oid || (entryPayload as any).issuer_oid;
    const subjectOid =
      entryPayload.subject_oid || (entryPayload as any).subject_oid;

    return {
      ...ledgerEntry,
      payload: userPayload, // Only the user's payload, not the ledger metadata
      ...(issuerOid && { issuer_oid: issuerOid }),
      ...(subjectOid && { subject_oid: subjectOid }),
    };
  }

  /**
   * Append entry to ledger
   *
   * Based on: onoal/ledger/src/ledger-core.ts:85-137
   *
   * Flow:
   * 1. Validate schema (if custom schema)
   * 2. Call plugin hooks (beforeAppend)
   * 3. Build ledger payload
   * 4. Append to ledger via LedgerCore
   * 5. Generate proof JWT
   * 6. Call plugin hooks (afterAppend)
   * 7. Return entry with proof_jwt
   */
  async append<T extends keyof SchemaDefinition>(entry: {
    type: T;
    issuer_oid: string;
    subject_oid?: string;
    payload: InferSchemaType<SchemaDefinition[T]>;
    meta?: Record<string, unknown>;
    stream?: LedgerStream;
  }): Promise<LedgerEntry & { proof_jwt: string }> {
    const startTime = Date.now();
    let trace: TraceContext | undefined;
    let appendSpan: ReturnType<typeof startSpan> | undefined;

    // Start tracing if enabled
    if (this.enableTracing) {
      trace = createTrace(generateTraceId(), "append");
      appendSpan = startSpan(trace, "append", {
        type: entry.type as string,
        issuer_oid: entry.issuer_oid,
      });
    }

    try {
      // 0. Validate required fields
      if (!entry.payload) {
        throw new Error("Payload is required");
      }

      // 0.1. Validate OIDs
      const { ensureOid } = await import("../utils/oid-validator.js");
      try {
        ensureOid(entry.issuer_oid, "issuer_oid");
        if (entry.subject_oid) {
          ensureOid(entry.subject_oid, "subject_oid");
        }
      } catch (error) {
        throw new Error(
          `Invalid OID: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // 1. Validate schema if custom schema is defined
      if (
        this.config.customSchemas &&
        entry.type in this.config.customSchemas
      ) {
        const { validateSchemaByType } = await import(
          "../utils/schema-validator-enhanced.js"
        );
        const validation = validateSchemaByType(
          entry.payload,
          entry.type as string,
          this.config.customSchemas
        );
        if (
          !validation.valid &&
          validation.errors &&
          validation.errors.length > 0
        ) {
          const firstError = validation.errors[0];
          const allErrors = validation.errors.map((e) => e.message).join(", ");

          throw new SchemaError(
            `Schema validation failed for type "${entry.type}": ${allErrors}`,
            ErrorCodes.SCHEMA_VALIDATION_FAILED,
            firstError?.field,
            firstError?.value,
            validation.errors.length > 1
              ? `Multiple validation errors (${validation.errors.length}): ${allErrors}`
              : firstError?.message || allErrors
          );
        }
      }

      // 2. Call plugin hooks (beforeAppend)
      // Plugins can modify entry or throw error to prevent append
      for (const plugin of this.plugins) {
        if (plugin.hooks?.beforeAppend) {
          const hookStartTime = Date.now();
          try {
            await plugin.hooks.beforeAppend(
              {
                type: entry.type as string,
                issuer_oid: entry.issuer_oid,
                subject_oid: entry.subject_oid,
                payload: entry.payload,
                meta: entry.meta,
                stream: entry.stream,
              },
              this
            );
          } catch (error) {
            // Record hook metrics
            if (this.metricsCollector) {
              const hookDuration = Date.now() - hookStartTime;
              this.metricsCollector.recordHook(
                `plugin.${plugin.id}.beforeAppend`,
                hookDuration,
                true
              );
            }
            throw new Error(
              `Plugin ${plugin.id} beforeAppend hook failed: ${error instanceof Error ? error.message : String(error)}`
            );
          }
          // Record hook metrics
          if (this.metricsCollector) {
            const hookDuration = Date.now() - hookStartTime;
            this.metricsCollector.recordHook(
              `plugin.${plugin.id}.beforeAppend`,
              hookDuration,
              false
            );
          }
        }
      }

      // 4. Build ledger payload for storage
      // Based on: onoal/ledger/src/ledger-core.ts:93-120
      const storedPayload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        type: entry.type,
        issuer_oid: entry.issuer_oid,
        ...(entry.subject_oid && { subject_oid: entry.subject_oid }),
        payload: entry.payload,
        timestamp: Date.now(),
      };

      // 5. Append to ledger (uses local LedgerCore)
      // Based on: onoal/ledger/src/ledger-core.ts:85-137 (now copied to framework)
      // Map entry.type to stream - if type is "proof", use "proofs" stream
      const stream =
        entry.stream || (entry.type === "proof" ? "proofs" : "proofs");
      let ledgerEntry: LedgerEntry;
      try {
        ledgerEntry = await LedgerCore.append(
          this.database.db,
          this.signer,
          stream,
          storedPayload,
          "active",
          entry.meta
        );
      } catch (error) {
        throw new Error(
          `Failed to append entry to ledger: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // 6. Extract payload and OIDs from ledger entry
      // The storedPayload contains: id, type, issuer_oid, subject_oid, payload, timestamp
      // We need to extract the user payload and expose issuer_oid/subject_oid at top level
      const entryPayload = ledgerEntry.payload as {
        id?: string;
        type?: string;
        issuer_oid?: string;
        subject_oid?: string;
        payload?: Record<string, unknown>;
        timestamp?: number;
      };

      // Extract user payload (the actual payload field inside entryPayload)
      const userPayload = (entryPayload.payload || entryPayload) as Record<
        string,
        unknown
      >;
      const issuerOid =
        entryPayload.issuer_oid || (entryPayload as any).issuer_oid;
      const subjectOid =
        entryPayload.subject_oid || (entryPayload as any).subject_oid;

      // 7. Generate proof JWT
      const { generateProofJWT } = await import("../utils/jwt.js");
      const proofJwt = await generateProofJWT(
        ledgerEntry,
        this.config.name,
        this.config.signingKey
      );

      // Return entry with extracted payload and OIDs at top level
      const entryWithProof = {
        ...ledgerEntry,
        payload: userPayload, // Only the user's payload, not the ledger metadata
        ...(issuerOid && { issuer_oid: issuerOid }),
        ...(subjectOid && { subject_oid: subjectOid }),
        proof_jwt: proofJwt,
      };

      // 8. Call module hooks (afterAppend) - BEFORE plugin hooks
      // Module hooks kunnen side effects uitvoeren
      for (const hooks of this.moduleHooks) {
        if (hooks.afterAppend) {
          try {
            await hooks.afterAppend(entryWithProof, this);
          } catch (error) {
            // Log error but don't fail append (hooks are non-critical)
            this.logger.error(
              `Module afterAppend hook failed`,
              error instanceof Error ? error : new Error(String(error)),
              {
                operation: "afterAppend",
                entryId: entryWithProof.id,
              }
            );
          }
        }
      }

      // 9. Call plugin hooks (afterAppend) - AFTER module hooks
      // Plugins can perform side effects (webhooks, analytics, etc.)
      for (const plugin of this.plugins) {
        if (plugin.hooks?.afterAppend) {
          const hookStartTime = Date.now();
          try {
            await plugin.hooks.afterAppend(entryWithProof, this);
            // Record hook metrics
            if (this.metricsCollector) {
              const hookDuration = Date.now() - hookStartTime;
              this.metricsCollector.recordHook(
                `plugin.${plugin.id}.afterAppend`,
                hookDuration,
                false
              );
            }
          } catch (error) {
            // Record hook error metrics
            if (this.metricsCollector) {
              const hookDuration = Date.now() - hookStartTime;
              this.metricsCollector.recordHook(
                `plugin.${plugin.id}.afterAppend`,
                hookDuration,
                true
              );
            }
            // Log error but don't fail append (plugins are non-critical)
            this.logger.error(
              `Plugin ${plugin.id} afterAppend hook failed`,
              error instanceof Error ? error : new Error(String(error)),
              {
                plugin: plugin.id,
                operation: "afterAppend",
                entryId: entryWithProof.id,
              }
            );
          }
        }
      }

      // Record metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordAppend(duration, false);
      }

      // End tracing
      if (trace && appendSpan) {
        endSpan(trace, appendSpan);
      }

      return entryWithProof;
    } catch (error) {
      // Record error metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordAppend(duration, true);
      }

      // End tracing with error
      if (trace && appendSpan) {
        endSpan(
          trace,
          appendSpan,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      throw error;
    }
  }

  /**
   * Batch append multiple entries atomically
   *
   * All entries are appended in a single transaction. If any entry fails,
   * the entire batch is rolled back.
   */
  async appendBatch<T extends keyof SchemaDefinition>(
    entries: Array<{
      type: T;
      issuer_oid: string;
      subject_oid?: string;
      payload: InferSchemaType<SchemaDefinition[T]>;
      meta?: Record<string, unknown>;
      stream?: LedgerStream;
    }>
  ): Promise<Array<LedgerEntry & { proof_jwt: string }>> {
    const startTime = Date.now();

    try {
      // Build ledger payloads for all entries
      const ledgerPayloads = entries.map((entry) => {
        const stream =
          entry.stream || (entry.type === "proof" ? "proofs" : "proofs");
        const storedPayload = {
          id: crypto.randomUUID(),
          type: entry.type,
          issuer_oid: entry.issuer_oid,
          ...(entry.subject_oid && { subject_oid: entry.subject_oid }),
          payload: entry.payload,
          timestamp: Date.now(),
        };
        return { stream, payload: storedPayload, meta: entry.meta };
      });

      // Use LedgerCore.appendBatch for atomic batch append
      const ledgerEntries = await LedgerCore.appendBatch(
        this.database.db,
        this.signer,
        ledgerPayloads
      );

      // Generate proof JWTs for all entries
      const { generateProofJWT } = await import("../utils/jwt.js");
      const entriesWithProofs = await Promise.all(
        ledgerEntries.map(async (ledgerEntry: LedgerEntry) => {
          const proofJwt = await generateProofJWT(
            ledgerEntry,
            this.config.name,
            this.config.signingKey
          );

          // Extract user payload and OIDs
          const entryPayload = ledgerEntry.payload as {
            id?: string;
            type?: string;
            issuer_oid?: string;
            subject_oid?: string;
            payload?: Record<string, unknown>;
            timestamp?: number;
          };

          const userPayload = (entryPayload.payload || entryPayload) as Record<
            string,
            unknown
          >;
          const issuerOid =
            entryPayload.issuer_oid || (entryPayload as any).issuer_oid;
          const subjectOid =
            entryPayload.subject_oid || (entryPayload as any).subject_oid;

          return {
            ...ledgerEntry,
            payload: userPayload,
            ...(issuerOid && { issuer_oid: issuerOid }),
            ...(subjectOid && { subject_oid: subjectOid }),
            proof_jwt: proofJwt,
          };
        })
      );

      // Call plugin hooks (afterAppend) for all entries
      for (const plugin of this.plugins) {
        if (plugin.hooks?.afterAppend) {
          for (const entryWithProof of entriesWithProofs) {
            try {
              await plugin.hooks.afterAppend(entryWithProof, this);
            } catch (error) {
              // Log error but don't fail batch (plugins are non-critical)
              this.logger.error(
                `Plugin ${plugin.id} afterAppend hook failed in batch`,
                error instanceof Error ? error : new Error(String(error)),
                {
                  plugin: plugin.id,
                  operation: "afterAppend",
                  entryId: entryWithProof.id,
                }
              );
            }
          }
        }
      }

      // Record metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordAppend(duration, false);
      }

      return entriesWithProofs;
    } catch (error) {
      // Record error metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordAppend(duration, true);
      }

      throw error;
    }
  }

  /**
   * Get entry by ID
   *
   * Based on: onoal/ledger/src/ledger-core.ts:142-166
   *
   * Flow:
   * 1. Call plugin hooks (beforeGet) - can short-circuit by returning entry
   * 2. Get entry from database
   * 3. Call plugin hooks (afterGet) - can modify result
   * 4. Return entry
   */
  async get(id: string): Promise<LedgerEntry | null> {
    const startTime = Date.now();
    let trace: TraceContext | undefined;
    let getSpan: ReturnType<typeof startSpan> | undefined;

    // Start tracing if enabled
    if (this.enableTracing) {
      trace = createTrace(generateTraceId(), "get");
      getSpan = startSpan(trace, "get", { id });
    }

    try {
      // Call beforeGet hooks
      // Hooks can short-circuit by returning a cached entry
      for (const plugin of this.plugins) {
        if (plugin.hooks?.beforeGet) {
          try {
            const result = await plugin.hooks.beforeGet(id, this);
            // If hook returns entry, short-circuit (skip database query)
            if (result && typeof result === "object" && "id" in result) {
              return result as LedgerEntry;
            }
          } catch (error) {
            // Log error but continue (hooks are non-critical for get)
            this.logger.error(
              `Plugin ${plugin.id} beforeGet hook failed`,
              error instanceof Error ? error : new Error(String(error)),
              {
                plugin: plugin.id,
                operation: "beforeGet",
                entryId: id,
              }
            );
          }
        }
      }

      // Get entry from database
      let entry: LedgerEntry | null;
      try {
        entry = await LedgerCore.getEntry(this.database.db, id);
      } catch (error) {
        throw new Error(
          `Failed to get entry: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (!entry) {
        return null;
      }

      // Extract payload and OIDs (same logic as append)
      entry = this.extractEntryData(entry);

      // Call module hooks (afterGet) - BEFORE plugin hooks
      // Module hooks kunnen resultaat modificeren
      for (const hooks of this.moduleHooks) {
        if (hooks.afterGet) {
          try {
            entry = await hooks.afterGet(entry, id, this);
          } catch (error) {
            // Log error but don't fail (hooks are non-critical)
            this.logger.error(
              `Module afterGet hook failed`,
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      }

      // Call plugin hooks (afterGet) - AFTER module hooks
      // Hooks can modify result (e.g., add computed fields, cache result)
      for (const plugin of this.plugins) {
        if (plugin.hooks?.afterGet) {
          try {
            entry = await plugin.hooks.afterGet(entry, id, this);
          } catch (error) {
            // Log error but don't fail (hooks are non-critical)
            console.error(`Plugin ${plugin.id} afterGet hook failed:`, error);
          }
        }
      }

      // Record metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordQuery(duration, false);
      }

      // End tracing
      if (trace && getSpan) {
        endSpan(trace, getSpan);
      }

      return entry;
    } catch (error) {
      // Record error metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordQuery(duration, true);
      }

      // End tracing with error
      if (trace && getSpan) {
        endSpan(
          trace,
          getSpan,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      throw error;
    }
  }

  /**
   * Query entries
   *
   * Based on: onoal/ledger/src/ledger-core.ts:171-227
   *
   * Flow:
   * 1. Call plugin hooks (beforeQuery) - can modify filters or short-circuit
   * 2. Query entries from database
   * 3. Call plugin hooks (afterQuery) - can modify result
   * 4. Return result
   */
  async query(filters: {
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
  }> {
    const startTime = Date.now();
    let trace: TraceContext | undefined;
    let querySpan: ReturnType<typeof startSpan> | undefined;

    // Start tracing if enabled
    if (this.enableTracing) {
      trace = createTrace(generateTraceId(), "query");
      querySpan = startSpan(trace, "query", filters);
    }

    try {
      let queryFilters = { ...filters };

      // Call module hooks (beforeQuery) - BEFORE plugin hooks
      // Module hooks kunnen filters modificeren of short-circuit
      for (const hooks of this.moduleHooks) {
        if (hooks.beforeQuery) {
          const hookStartTime = Date.now();
          try {
            const result = await hooks.beforeQuery(queryFilters, this);
            // If hook returns shortCircuit, use it and skip database query
            if (result && "shortCircuit" in result && result.shortCircuit) {
              return result.shortCircuit;
            }
            // If hook returns modified filters, use them
            if (result && "filters" in result && result.filters) {
              queryFilters = { ...queryFilters, ...result.filters };
            }
          } catch (error) {
            // Record hook metrics
            if (this.metricsCollector) {
              const hookDuration = Date.now() - hookStartTime;
              this.metricsCollector.recordHook(
                "module.beforeQuery",
                hookDuration,
                true
              );
            }
            // Log error but continue (hooks are non-critical for query)
            this.logger.error(
              `Module beforeQuery hook failed`,
              error instanceof Error ? error : new Error(String(error))
            );
          }
          // Record hook metrics
          if (this.metricsCollector) {
            const hookDuration = Date.now() - hookStartTime;
            this.metricsCollector.recordHook(
              "module.beforeQuery",
              hookDuration,
              false
            );
          }
        }
      }

      // Call plugin hooks (beforeQuery) - AFTER module hooks
      // Hooks can modify filters or short-circuit by returning result
      for (const plugin of this.plugins) {
        if (plugin.hooks?.beforeQuery) {
          try {
            const result = await plugin.hooks.beforeQuery(queryFilters, this);
            // If hook returns shortCircuit, use it and skip database query
            if (result && "shortCircuit" in result && result.shortCircuit) {
              return result.shortCircuit;
            }
            // If hook returns modified filters, use them
            if (result && "filters" in result && result.filters) {
              queryFilters = { ...queryFilters, ...result.filters };
            }
          } catch (error) {
            // Log error but continue (hooks are non-critical for query)
            console.error(
              `Plugin ${plugin.id} beforeQuery hook failed:`,
              error
            );
          }
        }
      }

      // Query entries from database
      let queryResult: {
        entries: LedgerEntry[];
        nextCursor: number | null;
        hasMore: boolean;
      };
      try {
        queryResult = await LedgerCore.queryEntries(
          this.database.db,
          queryFilters
        );
      } catch (error) {
        throw new Error(
          `Failed to query entries: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Extract payload and OIDs for all entries (same logic as append)
      queryResult.entries = queryResult.entries.map((entry) =>
        this.extractEntryData(entry)
      );

      // Call module hooks (afterQuery) - BEFORE plugin hooks
      // Module hooks kunnen resultaat modificeren
      for (const hooks of this.moduleHooks) {
        if (hooks.afterQuery) {
          const hookStartTime = Date.now();
          try {
            queryResult = await hooks.afterQuery(
              queryResult,
              queryFilters,
              this
            );
            // Record hook metrics
            if (this.metricsCollector) {
              const hookDuration = Date.now() - hookStartTime;
              this.metricsCollector.recordHook(
                "module.afterQuery",
                hookDuration,
                false
              );
            }
          } catch (error) {
            // Record hook error metrics
            if (this.metricsCollector) {
              const hookDuration = Date.now() - hookStartTime;
              this.metricsCollector.recordHook(
                "module.afterQuery",
                hookDuration,
                true
              );
            }
            // Log error but don't fail (hooks are non-critical)
            this.logger.error(
              `Module afterQuery hook failed`,
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      }

      // Call plugin hooks (afterQuery) - AFTER module hooks
      // Hooks can modify result (e.g., filter entries, add computed fields)
      for (const plugin of this.plugins) {
        if (plugin.hooks?.afterQuery) {
          try {
            queryResult = await plugin.hooks.afterQuery(
              queryResult,
              queryFilters,
              this
            );
          } catch (error) {
            // Log error but don't fail (hooks are non-critical)
            console.error(`Plugin ${plugin.id} afterQuery hook failed:`, error);
          }
        }
      }

      // Record metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordQuery(duration, false);
      }

      // End tracing
      if (trace && querySpan) {
        endSpan(trace, querySpan);
      }

      return queryResult;
    } catch (error) {
      // Record error metrics
      if (this.metricsCollector) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordQuery(duration, true);
      }

      // End tracing with error
      if (trace && querySpan) {
        endSpan(
          trace,
          querySpan,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      throw error;
    }
  }

  /**
   * Verify chain integrity
   *
   * Based on: onoal/ledger/src/chain.ts:56-189
   *
   * Flow:
   * 1. Call plugin hooks (beforeVerifyChain)
   * 2. Verify chain integrity
   * 3. Call plugin hooks (afterVerifyChain) - can modify result
   * 4. Return result
   */
  async verifyChain(
    startId?: string,
    limit = 100
  ): Promise<import("./types-internal.js").ChainVerificationResult> {
    // Call module hooks (beforeVerifyChain) - BEFORE plugin hooks
    for (const hooks of this.moduleHooks) {
      if (hooks.beforeVerifyChain) {
        try {
          await hooks.beforeVerifyChain(startId, limit, this);
        } catch (error) {
          // Log error but continue (hooks are non-critical)
          this.logger.error(
            `Module beforeVerifyChain hook failed`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    }

    // Call plugin hooks (beforeVerifyChain) - AFTER module hooks
    for (const plugin of this.plugins) {
      if (plugin.hooks?.beforeVerifyChain) {
        try {
          await plugin.hooks.beforeVerifyChain(startId, limit, this);
        } catch (error) {
          // Log error but continue (hooks are non-critical)
          console.error(
            `Plugin ${plugin.id} beforeVerifyChain hook failed:`,
            error
          );
        }
      }
    }

    // Verify chain integrity
    let verificationResult: import("./types-internal.js").ChainVerificationResult;
    try {
      verificationResult = await HashChain.verifyChain(
        this.database.db,
        this.signer,
        startId,
        limit
      );
    } catch (error) {
      this.logger.error(
        "Chain verification failed",
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "verifyChain",
          startId,
          limit,
        }
      );
      throw new Error(
        `Failed to verify chain: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Call module hooks (afterVerifyChain) - BEFORE plugin hooks
    // Module hooks kunnen resultaat modificeren
    for (const hooks of this.moduleHooks) {
      if (hooks.afterVerifyChain) {
        try {
          verificationResult = await hooks.afterVerifyChain(
            verificationResult,
            this
          );
        } catch (error) {
          // Log error but don't fail (hooks are non-critical)
          this.logger.error(
            `Module afterVerifyChain hook failed`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    }

    // Call plugin hooks (afterVerifyChain) - AFTER module hooks
    // Hooks can modify result (e.g., add additional checks, logging)
    for (const plugin of this.plugins) {
      if (plugin.hooks?.afterVerifyChain) {
        try {
          verificationResult = await plugin.hooks.afterVerifyChain(
            verificationResult,
            this
          );
        } catch (error) {
          // Log error but don't fail (hooks are non-critical)
          console.error(
            `Plugin ${plugin.id} afterVerifyChain hook failed:`,
            error
          );
        }
      }
    }

    return verificationResult;
  }

  /**
   * Verify a single entry's integrity
   *
   * Checks hash, signature, and chain link for a single entry.
   */
  async verifyEntry(entryId: string): Promise<{
    valid: boolean;
    errors: string[];
    entry_id: string;
  }> {
    try {
      return await LedgerCore.verifyEntry(
        this.database.db,
        this.signer,
        entryId
      );
    } catch (error) {
      this.logger.error(
        "Entry verification failed",
        error instanceof Error ? error : new Error(String(error)),
        { entryId, operation: "verifyEntry" }
      );
      throw error;
    }
  }

  /**
   * Get service from container
   */
  getService<T>(serviceName: string): T {
    return this.serviceContainer.resolve<T>(serviceName);
  }

  /**
   * Check if service exists
   */
  hasService(serviceName: string): boolean {
    return this.serviceContainer.has(serviceName);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return this.serviceContainer.getServiceNames();
  }

  /**
   * Use a plugin (BetterAuth pattern)
   */
  use(plugin: OnoalLedgerPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Use a module (Medusa.js pattern)
   */
  useModule(module: OnoalLedgerModule): this {
    this.modules.push(module);
    // TODO: Load module (async operation)
    // For now, just add to modules array
    return this;
  }

  /**
   * Get all modules
   */
  getModules(): OnoalLedgerModule[] {
    return this.modules;
  }

  /**
   * Get all plugins
   */
  getPlugins(): OnoalLedgerPlugin[] {
    return this.plugins;
  }

  /**
   * Get a connector by ID
   */
  getConnector<T extends LedgerConnector = LedgerConnector>(
    connectorId: string
  ): T | undefined {
    return this.serviceContainer.resolve<T>(`connector:${connectorId}`);
  }

  /**
   * Get all connectors of a specific type
   */
  getConnectorsByType<T extends LedgerConnector = LedgerConnector>(
    type: string
  ): T[] {
    return this.serviceContainer.resolve<T[]>(`connectors:${type}`) || [];
  }

  /**
   * Get all connectors
   */
  getConnectors(): LedgerConnector[] {
    return this.connectors;
  }

  /**
   * Get metrics (if enabled)
   */
  getMetrics() {
    if (!this.metricsCollector) {
      throw new Error("Metrics collection is not enabled");
    }
    return this.metricsCollector.getMetrics();
  }

  /**
   * Get metrics summary (if enabled)
   */
  getMetricsSummary() {
    if (!this.metricsCollector) {
      throw new Error("Metrics collection is not enabled");
    }
    return this.metricsCollector.getMetricsSummary();
  }
}
