/**
 * db:status command
 *
 * Shows database migration status and pending changes.
 *
 * @module commands/db-status
 */

import { discoverModules } from "../utils/module-discovery.js";
import { loadLedgerConfig } from "../utils/config-loader.js";
import { existsSync } from "fs";
import { join } from "path";

export async function dbStatus(options: { path?: string }): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();

  console.log("📊 Database Migration Status\n");

  try {
    // 1. Check for drizzle config
    const drizzleConfigPath = join(projectPath, "drizzle.config.ts");
    const hasDrizzleConfig = existsSync(drizzleConfigPath);

    if (!hasDrizzleConfig) {
      console.log("⚠️  No drizzle.config.ts found");
      console.log("   Run 'db:generate' to create configuration\n");
      return;
    }

    // 2. Discover modules
    const modules = await discoverModules(projectPath);
    console.log(`📦 Modules: ${modules.length}`);

    // 3. Check for migrations directory
    const migrationsPath = join(projectPath, "drizzle");
    const hasMigrations = existsSync(migrationsPath);

    if (!hasMigrations) {
      console.log("📁 Migrations: No migrations directory found");
      console.log("   Run 'db:generate' to create migrations\n");
      return;
    }

    // 4. Load ledger config
    const config = await loadLedgerConfig(projectPath);
    if (!config) {
      console.log("⚠️  No ledger.config.ts found\n");
      return;
    }

    // 5. Collect schema information
    const moduleSchemas: Array<{
      moduleId: string;
      tables: string[];
    }> = [];

    for (const module of modules) {
      const tables: string[] = [];

      if (module.drizzleSchema) {
        tables.push(...Object.keys(module.drizzleSchema));
      }

      if (module.declarativeSchema) {
        tables.push(...module.declarativeSchema.map((s: any) => s.name));
      }

      if (tables.length > 0) {
        moduleSchemas.push({
          moduleId: module.id,
          tables,
        });
      }
    }

    // 6. Display status
    console.log(
      `📊 Schema Tables: ${moduleSchemas.flatMap((m) => m.tables).length}`
    );
    console.log(
      `🔧 Database: ${config.database ? "Configured" : "Not configured"}`
    );
    console.log(`📁 Migrations: ${hasMigrations ? "Found" : "Not found"}\n`);

    if (moduleSchemas.length > 0) {
      console.log("📋 Module Schemas:");
      moduleSchemas.forEach(({ moduleId, tables }) => {
        console.log(`   ${moduleId}: ${tables.length} table(s)`);
        tables.forEach((table) => {
          console.log(`      - ${table}`);
        });
      });
      console.log();
    }
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
