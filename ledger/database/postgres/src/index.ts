/**
 * PostgreSQL adapter for Ledger Framework
 *
 * Uses Drizzle ORM with Neon serverless for PostgreSQL deployments.
 * Perfect for production deployments and edge compatibility.
 *
 * Based on: onoal/ledger/src/lib/db.ts
 *
 * @module adapter-node/postgres
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import {
  pgTable,
  text,
  bigint,
  smallint,
  jsonb,
  index,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { LedgerDatabase } from "@onoal/ledger-core";
import {
  ledgerEntriesPg,
  ledgerTipPg,
  ledgerCheckpointsPg,
} from "@onoal/ledger-core/internal";
import { applyPendingMigrations, initMigrationTable } from "./migrations.js";
import { getAllMigrations } from "./migrations/index.js";

export interface PostgresAdapterOptions {
  /** PostgreSQL connection string (e.g., Neon database URL) */
  connectionString: string;
  /** Optional: Module schemas to create tables for */
  moduleSchemas?: Array<{
    moduleId: string;
    tables: Record<string, any>; // Drizzle table definitions
  }>;
}

// Cache for database connections (similar to onoal/ledger)
const dbCache = new Map<string, any>();

// Configure Neon for WebSocket connections (supports transactions)
// Note: Pool uses WebSocket connections which support full transaction support
neonConfig.fetchConnectionCache = true;
neonConfig.webSocketConstructor = globalThis.WebSocket;

/**
 * Create PostgreSQL adapter
 *
 * @param options - PostgreSQL adapter options
 * @returns Ledger adapter instance
 *
 * @example
 * ```typescript
 * const adapter = postgresAdapter({
 *   connectionString: process.env.DATABASE_URL,
 * });
 *
 * const ledger = await createLedger({
 *   name: "my-ledger",
 *   signingKey: privateKey,
 *   adapter,
 * });
 * ```
 */
export function postgresAdapter(
  options: PostgresAdapterOptions
): LedgerDatabase {
  // Create Neon Pool (WebSocket-based, supports transactions)
  // Pool is compatible with node-postgres API and supports transactions
  const pool = new Pool({ connectionString: options.connectionString });

  // Use cached connection if available
  // Note: We don't use cache when moduleSchemas are provided, as they might change
  if (dbCache.has(options.connectionString) && !options.moduleSchemas) {
    const cached = dbCache.get(options.connectionString)!;
    return {
      id: "postgres",
      db: cached.db,
      provider: "postgres" as const,
      migrate: cached.migrate,
      pool: cached.pool, // Expose pool for raw SQL queries
    };
  }

  // Collect all schemas (core + module schemas)
  const schema: Record<string, any> = {
    ledgerEntries: ledgerEntriesPg,
    ledgerTip: ledgerTipPg,
    ledgerCheckpoints: ledgerCheckpointsPg,
  };

  // Track dynamically added schemas for migrations
  const dynamicSchemas: Array<{
    moduleId: string;
    tables: Record<string, any>;
  }> = [];

  // Add module schemas if provided
  // Support both Drizzle tables and declarative schemas
  if (options.moduleSchemas) {
    // Store initial schemas for migration
    dynamicSchemas.push(...options.moduleSchemas);

    for (const moduleSchema of options.moduleSchemas) {
      for (const [tableName, tableDef] of Object.entries(moduleSchema.tables)) {
        // Check if this is a declarative schema (has _declarativeSchema property)
        if (
          tableDef &&
          typeof tableDef === "object" &&
          tableDef._declarativeSchema
        ) {
          // Convert declarative schema to Drizzle table
          const drizzleTable = convertDeclarativeSchemaToDrizzleTable(
            tableDef._declarativeSchema
          );
          schema[tableName] = drizzleTable;
        } else {
          // Regular Drizzle table definition
          schema[tableName] = tableDef;
        }
      }
    }
  }

  // Create Drizzle instance with combined schema
  // Pool supports transactions via WebSocket connections
  let db = drizzle(pool, { schema });

  /**
   * Convert declarative schema to SQL CREATE TABLE statement
   *
   * Converteert een declaratieve schema definitie naar een SQL CREATE TABLE statement.
   */
  function convertDeclarativeSchemaToSQL(declarativeSchema: any): string {
    const tableName = declarativeSchema.name;
    const fields = declarativeSchema.fields || [];
    const indexes = declarativeSchema.indexes || [];
    const constraints = declarativeSchema.constraints || [];

    // Build column definitions
    const columns: string[] = [];

    for (const field of fields) {
      let columnDef = `${field.name} `;

      // Map field types to SQL types
      switch (field.type) {
        case "text":
        case "string":
          columnDef += "TEXT";
          break;
        case "number":
          columnDef += "SMALLINT";
          break;
        case "bigint":
          columnDef += "BIGINT";
          break;
        case "json":
          columnDef += "JSONB";
          break;
        case "uuid":
          columnDef += "UUID";
          break;
        case "boolean":
          columnDef += "BOOLEAN";
          break;
        case "date":
          columnDef += "BIGINT"; // Date as timestamp
          break;
        default:
          columnDef += "TEXT";
      }

      // Apply modifiers
      if (field.primaryKey) {
        columnDef += " PRIMARY KEY";
      } else if (field.required) {
        columnDef += " NOT NULL";
      }

      if (field.unique && !field.primaryKey) {
        columnDef += " UNIQUE";
      }

      if (field.default !== undefined) {
        if (typeof field.default === "number") {
          columnDef += ` DEFAULT ${field.default}`;
        } else if (typeof field.default === "string") {
          columnDef += ` DEFAULT '${field.default.replace(/'/g, "''")}'`;
        } else {
          columnDef += ` DEFAULT '${JSON.stringify(field.default).replace(/'/g, "''")}'`;
        }
      }

      // Add foreign key reference
      if (field.references) {
        columnDef += ` REFERENCES ${field.references.table}(${field.references.column})`;
        if (field.references.onDelete) {
          columnDef += ` ON DELETE ${field.references.onDelete.toUpperCase()}`;
        }
      }

      columns.push(columnDef);
    }

    // Build CREATE TABLE statement
    let createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columns.join(",\n  ")}\n);`;

    // Add indexes
    for (const idx of indexes) {
      const indexFields = idx.fields.join(", ");
      if (idx.unique) {
        createTableSQL += `\n\nCREATE UNIQUE INDEX IF NOT EXISTS ${idx.name} ON ${tableName}(${indexFields});`;
      } else {
        createTableSQL += `\n\nCREATE INDEX IF NOT EXISTS ${idx.name} ON ${tableName}(${indexFields});`;
      }
    }

    // Add constraints
    for (const constraint of constraints) {
      if (constraint.type === "check" && constraint.expression) {
        createTableSQL += `\n\nALTER TABLE ${tableName} ADD CONSTRAINT ${constraint.name} CHECK (${constraint.expression});`;
      } else if (constraint.type === "unique" && constraint.fields) {
        const constraintFields = constraint.fields.join(", ");
        createTableSQL += `\n\nALTER TABLE ${tableName} ADD CONSTRAINT ${constraint.name} UNIQUE (${constraintFields});`;
      }
    }

    return createTableSQL;
  }

  /**
   * Convert declarative schema to Drizzle table
   *
   * Converteert een declaratieve schema definitie naar een Drizzle pgTable.
   */
  function convertDeclarativeSchemaToDrizzleTable(declarativeSchema: any): any {
    const tableName = declarativeSchema.name;
    const fields = declarativeSchema.fields || [];
    const indexes = declarativeSchema.indexes || [];
    const constraints = declarativeSchema.constraints || [];

    // Build column definitions
    const columns: Record<string, any> = {};
    const tableConfig: any = {};

    for (const field of fields) {
      let column: any;

      // Map field types to Drizzle column types
      switch (field.type) {
        case "text":
        case "string":
          column = text(field.name);
          break;
        case "number":
          column = smallint(field.name);
          break;
        case "bigint":
          column = bigint(field.name, { mode: "bigint" });
          break;
        case "json":
          column = jsonb(field.name);
          break;
        case "uuid":
          column = text(field.name); // UUID as text for now
          break;
        case "boolean":
          column = text(field.name); // Boolean as text for now
          break;
        case "date":
          column = bigint(field.name, { mode: "bigint" }); // Date as timestamp
          break;
        default:
          column = text(field.name);
      }

      // Apply modifiers
      if (field.required) {
        column = column.notNull();
      }
      if (field.primaryKey) {
        column = column.primaryKey();
      }
      if (field.unique) {
        column = column.unique();
      }
      if (field.default !== undefined) {
        if (typeof field.default === "number") {
          column = column.default(sql`${field.default}`);
        } else if (typeof field.default === "string") {
          column = column.default(field.default);
        } else {
          column = column.default(field.default);
        }
      }

      // Store column using field.name as key (Drizzle uses column names, not IDs)
      columns[field.name] = column;
    }

    // Build table with columns
    const table = pgTable(tableName, columns, (table: any) => {
      const config: Record<string, any> = {};

      // Add indexes
      for (const idx of indexes) {
        const indexFields = idx.fields
          .map((f: string) => {
            const field = fields.find(
              (field: any) => field.id === f || field.name === f
            );
            if (!field) return null;
            // Drizzle uses column names as keys in the table callback
            const column = table[field.name];
            if (!column) return null;
            return column;
          })
          .filter((field: any): field is any => field !== null);

        if (indexFields.length > 0) {
          try {
            if (idx.unique) {
              // Call .on() with array elements as arguments
              const uniqueIndex = unique(idx.name);
              if (uniqueIndex && uniqueIndex.on) {
                // Use Function.prototype.call with array spread
                config[idx.name] = (uniqueIndex.on as any)(
                  ...(indexFields as [any, ...any[]])
                );
              }
            } else {
              const regularIndex = index(idx.name);
              if (regularIndex && regularIndex.on) {
                config[idx.name] = (regularIndex.on as any)(
                  ...(indexFields as [any, ...any[]])
                );
              }
            }
          } catch (error) {
            // Skip invalid index definitions
            console.warn(`Failed to create index ${idx.name}:`, error);
          }
        }
      }

      // Add constraints
      for (const constraint of constraints) {
        if (constraint.type === "check" && constraint.expression) {
          config[constraint.name] = check(
            constraint.name,
            sql`${sql.raw(constraint.expression)}`
          );
        } else if (constraint.type === "unique" && constraint.fields) {
          const constraintFields = constraint.fields
            .map((f: string) => {
              const field = fields.find(
                (field: any) => field.id === f || field.name === f
              );
              if (!field) return null;
              // Try both field.id and field.name as keys (Drizzle uses column names)
              const column = table[field.id] || table[field.name];
              if (!column) return null;
              return column;
            })
            .filter((field: any): field is any => field !== null);
          if (constraintFields.length > 0) {
            try {
              const uniqueConstraint = unique(constraint.name);
              if (uniqueConstraint && uniqueConstraint.on) {
                config[constraint.name] = (uniqueConstraint.on as any)(
                  ...(constraintFields as [any, ...any[]])
                );
              }
            } catch (error) {
              // Skip invalid constraint definitions
              console.warn(
                `Failed to create constraint ${constraint.name}:`,
                error
              );
            }
          }
        }
      }

      return config;
    });

    return table;
  }

  /**
   * Add module schemas dynamically
   *
   * Allows adding schemas after adapter creation (for automatic schema collection).
   * Supports both Drizzle table definitions and declarative schema definitions.
   */
  function addModuleSchemas(
    moduleSchemas: Array<{
      moduleId: string;
      tables: Record<string, any>;
    }>
  ): void {
    // Store schemas for migration
    dynamicSchemas.push(...moduleSchemas);

    // Merge new schemas into existing schema
    for (const moduleSchema of moduleSchemas) {
      for (const [tableName, tableDef] of Object.entries(moduleSchema.tables)) {
        // Check if this is a declarative schema (has _declarativeSchema property)
        if (
          tableDef &&
          typeof tableDef === "object" &&
          tableDef._declarativeSchema
        ) {
          // Convert declarative schema to Drizzle table
          const drizzleTable = convertDeclarativeSchemaToDrizzleTable(
            tableDef._declarativeSchema
          );
          schema[tableName] = drizzleTable;
        } else {
          // Regular Drizzle table definition
          schema[tableName] = tableDef;
        }
      }
    }

    // Recreate Drizzle instance with updated schema
    // Note: This is safe because Drizzle schema is just metadata
    db = drizzle(pool, { schema });
  }

  /**
   * Run migrations programmatically
   * Creates tables if they don't exist and applies core migrations
   */
  async function migrate(): Promise<void> {
    // Initialize migration tracking table
    await initMigrationTable(pool);

    // Apply core migrations first (e.g., OID columns, stats table)
    const coreMigrations = getAllMigrations();
    try {
      const result = await applyPendingMigrations(pool, coreMigrations);
      if (result.applied.length > 0) {
        console.log(
          `[MIGRATE] Applied ${result.applied.length} core migration(s): ${result.applied.join(", ")}`
        );
      }
      if (result.skipped.length > 0) {
        console.log(
          `[MIGRATE] Skipped ${result.skipped.length} already applied migration(s): ${result.skipped.join(", ")}`
        );
      }
    } catch (error) {
      console.error("[MIGRATE] Failed to apply core migrations:", error);
      throw error;
    }

    // Store moduleSchemas in closure for migrate function
    // Combine initial moduleSchemas with any dynamically added ones
    const moduleSchemas = options.moduleSchemas || [];
    // Create enums first
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE ledger_stream AS ENUM ('proofs', 'assets', 'consent', 'status', 'connect_grants', 'connect_events');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE ledger_entry_status AS ENUM ('active', 'revoked', 'used', 'suspended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create ledger_entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        stream ledger_stream NOT NULL,
        timestamp BIGINT NOT NULL,
        payload JSONB NOT NULL,
        hash TEXT NOT NULL,
        prev_hash TEXT,
        signature TEXT,
        status ledger_entry_status NOT NULL DEFAULT 'active',
        meta JSONB,
        created_at BIGINT NOT NULL
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_stream ON ledger_entries(stream);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger_entries(timestamp);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_hash ON ledger_entries(hash);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_chain ON ledger_entries(timestamp, prev_hash);
    `);

    // Create ledger_tip table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ledger_tip (
        id BIGINT PRIMARY KEY DEFAULT 1,
        entry_id TEXT NOT NULL,
        hash TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES ledger_entries(id) ON DELETE CASCADE
      );
    `);

    // Create ledger_checkpoints table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ledger_checkpoints (
        id TEXT PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        root_hash TEXT NOT NULL,
        signature TEXT NOT NULL,
        entries_count BIGINT NOT NULL,
        start_timestamp BIGINT NOT NULL,
        end_timestamp BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON ledger_checkpoints(timestamp);
    `);

    // Combine initial moduleSchemas with dynamically added ones
    const allModuleSchemas = [...moduleSchemas, ...dynamicSchemas];

    // Create module tables if schemas provided
    if (allModuleSchemas.length > 0) {
      console.log(
        `[MIGRATE] Processing ${allModuleSchemas.length} module schema(s)`
      );
      for (const moduleSchema of allModuleSchemas) {
        console.log(
          `[MIGRATE] Processing module: ${moduleSchema.moduleId}, tables: ${Object.keys(moduleSchema.tables).join(", ")}`
        );
        // Check for declarative schemas and convert them to SQL
        for (const [tableName, tableDef] of Object.entries(
          moduleSchema.tables
        )) {
          console.log(
            `[MIGRATE] Checking table: ${tableName}, type: ${typeof tableDef}, has _declarativeSchema: ${tableDef && typeof tableDef === "object" && "_declarativeSchema" in tableDef}`
          );
          // Check if this is a declarative schema
          if (
            tableDef &&
            typeof tableDef === "object" &&
            tableDef._declarativeSchema
          ) {
            console.log(
              `[MIGRATE] Found declarative schema for table: ${tableName}`
            );
            // Convert declarative schema to SQL and execute
            const createTableSQL = convertDeclarativeSchemaToSQL(
              tableDef._declarativeSchema
            );
            console.log(
              `[MIGRATE] Generated SQL for ${tableName}:\n${createTableSQL}`
            );

            // Split SQL statements (they're separated by \n\n)
            const statements = createTableSQL.split(/\n\n+/);
            for (const statement of statements) {
              if (statement.trim()) {
                try {
                  console.log(
                    `[MIGRATE] Executing SQL statement for ${tableName}: ${statement.substring(0, 100)}...`
                  );
                  await pool.query(statement);
                  console.log(
                    `[MIGRATE] Successfully executed SQL for ${tableName}`
                  );
                } catch (error: any) {
                  // Ignore "already exists" errors for constraints/indexes
                  if (
                    error?.code === "42P07" ||
                    error?.message?.includes("already exists")
                  ) {
                    // Constraint or index already exists, skip
                    console.log(
                      `[MIGRATE] Table/index/constraint already exists for ${tableName}, skipping`
                    );
                    continue;
                  }
                  console.error(
                    `[MIGRATE] Error executing SQL for ${tableName}:`,
                    error
                  );
                  throw error;
                }
              }
            }
            continue; // Skip to next table
          }
        }

        // Legacy hardcoded migrations (for backward compatibility)
        // Create todos table for todo module
        if (moduleSchema.moduleId === "todo") {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS todos (
              id TEXT PRIMARY KEY,
              issuer_oid TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT,
              completed BOOLEAN NOT NULL DEFAULT false,
              metadata JSONB,
              created_at BIGINT NOT NULL,
              updated_at BIGINT NOT NULL
            );
          `);

          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_todos_issuer ON todos(issuer_oid);
          `);
          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
          `);
          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
          `);
        }

        // Create token tables for token module
        if (moduleSchema.moduleId === "token") {
          // Create token_status enum
          await pool.query(`
            DO $$ BEGIN
              CREATE TYPE token_status AS ENUM ('active', 'paused');
            EXCEPTION
              WHEN duplicate_object THEN null;
            END $$;
          `);

          // Create token_ledger_kind enum
          await pool.query(`
            DO $$ BEGIN
              CREATE TYPE token_ledger_kind AS ENUM ('mint', 'burn', 'transfer', 'adjust');
            EXCEPTION
              WHEN duplicate_object THEN null;
            END $$;
          `);

          // Create tokens table
          await pool.query(`
            CREATE TABLE IF NOT EXISTS tokens (
              id TEXT PRIMARY KEY,
              issuer_oid TEXT NOT NULL,
              symbol TEXT,
              name TEXT,
              decimals SMALLINT NOT NULL,
              supply_cap BIGINT,
              supply BIGINT NOT NULL DEFAULT 0,
              status token_status NOT NULL DEFAULT 'active',
              metadata JSONB,
              admin_policy JSONB,
              created_at BIGINT NOT NULL,
              updated_at BIGINT NOT NULL,
              CONSTRAINT tokens_decimals_check CHECK (decimals >= 0 AND decimals <= 18)
            );
          `);

          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_tokens_issuer ON tokens(issuer_oid);
          `);
          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
          `);

          // Create token_accounts table
          await pool.query(`
            CREATE TABLE IF NOT EXISTS token_accounts (
              id BIGSERIAL PRIMARY KEY,
              token_id TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
              subject_oid TEXT NOT NULL,
              balance BIGINT NOT NULL DEFAULT 0,
              nonce BIGINT NOT NULL DEFAULT 0,
              created_at BIGINT NOT NULL,
              updated_at BIGINT NOT NULL,
              CONSTRAINT uq_token_accounts_token_subject UNIQUE (token_id, subject_oid)
            );
          `);

          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_token_accounts_token ON token_accounts(token_id);
          `);
          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_token_accounts_subject ON token_accounts(subject_oid);
          `);

          // Create token_ledger table
          await pool.query(`
            CREATE TABLE IF NOT EXISTS token_ledger (
              id BIGSERIAL PRIMARY KEY,
              ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              token_id TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
              tx_id UUID NOT NULL,
              kind token_ledger_kind NOT NULL,
              from_subject_oid TEXT,
              to_subject_oid TEXT,
              amount BIGINT NOT NULL,
              actor_oid TEXT NOT NULL,
              ctx JSONB,
              created_at BIGINT NOT NULL,
              CONSTRAINT uq_token_ledger_tx UNIQUE (token_id, tx_id),
              CONSTRAINT token_ledger_amount_check CHECK (amount > 0)
            );
          `);

          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_token_ledger_token ON token_ledger(token_id);
          `);
        }
      }
    }
  }

  const adapter: LedgerDatabase & {
    addModuleSchemas?: typeof addModuleSchemas;
    pool?: typeof pool;
  } = {
    id: "postgres",
    db,
    provider: "postgres" as const,
    migrate,
    addModuleSchemas,
    pool, // Expose pool for raw SQL queries
  };

  // Store dynamic schemas reference for migrate function (internal use)
  (adapter as any)._dynamicSchemas = dynamicSchemas;

  // Cache the connection with migrate function
  dbCache.set(options.connectionString, adapter);

  return adapter;
}

// Export migration utilities
export * from "./migrations.js";
