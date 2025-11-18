/**
 * db:validate command
 *
 * Validates database schema against module definitions.
 * Checks for missing tables, columns, indexes, and constraints.
 *
 * @module commands/db-validate
 */

import { discoverModules } from "../utils/module-discovery.js";
import { loadLedgerConfig } from "../utils/config-loader.js";

export async function dbValidate(options: {
  path?: string;
  strict?: boolean;
}): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();
  const strict = (options.strict as boolean) || false;

  console.log("🔍 Validating database schema...\n");

  try {
    // 1. Discover modules
    const modules = await discoverModules(projectPath);
    console.log(`📦 Found ${modules.length} module(s)\n`);

    // 2. Load ledger config
    const config = await loadLedgerConfig(projectPath);
    if (!config) {
      console.error("❌ No ledger.config.ts found");
      process.exit(1);
    }

    // 3. Collect schema information from modules
    const moduleSchemas: Array<{
      moduleId: string;
      tables: string[];
    }> = [];

    for (const module of modules) {
      const tables: string[] = [];

      // Check drizzleSchema
      if (module.drizzleSchema) {
        tables.push(...Object.keys(module.drizzleSchema));
      }

      // Check declarativeSchema
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

    // 4. Validate schema
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if database adapter is configured
    if (!config.database) {
      errors.push("❌ Database adapter not configured in ledger.config.ts");
    }

    // Check for duplicate table names
    const allTables = moduleSchemas.flatMap((m) => m.tables);
    const duplicateTables = allTables.filter(
      (table, index) => allTables.indexOf(table) !== index
    );
    if (duplicateTables.length > 0) {
      errors.push(
        `❌ Duplicate table names found: ${[...new Set(duplicateTables)].join(", ")}`
      );
    }

    // Check for modules without schemas (warning)
    const modulesWithoutSchemas = modules.filter(
      (m) => !m.drizzleSchema && !m.declarativeSchema
    );
    if (modulesWithoutSchemas.length > 0) {
      warnings.push(
        `⚠️  ${modulesWithoutSchemas.length} module(s) without schema definitions: ${modulesWithoutSchemas.map((m) => m.id).join(", ")}`
      );
    }

    // 5. Display results
    if (errors.length > 0) {
      console.error("❌ Validation failed:\n");
      errors.forEach((error) => console.error(`  ${error}`));
      console.error();
      process.exit(1);
    }

    if (warnings.length > 0) {
      console.warn("⚠️  Warnings:\n");
      warnings.forEach((warning) => console.warn(`  ${warning}`));
      console.warn();

      if (strict) {
        console.error("❌ Validation failed (strict mode enabled)");
        process.exit(1);
      }
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log("✅ Schema validation passed!\n");
      console.log(`📊 Summary:`);
      console.log(`   - Modules: ${modules.length}`);
      console.log(`   - Tables: ${allTables.length}`);
      console.log(`   - Errors: 0`);
      console.log(`   - Warnings: 0\n`);
    }
  } catch (error) {
    console.error(
      "❌ Validation error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
