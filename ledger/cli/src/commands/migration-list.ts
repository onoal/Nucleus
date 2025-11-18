/**
 * migration:list command
 *
 * Lists all migrations and their status.
 *
 * @module commands/migration-list
 */

import { loadLedgerConfig } from "../utils/config-loader.js";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export async function migrationList(options: { path?: string }): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();

  console.log("📋 Migration Status\n");

  try {
    // 1. Load ledger config
    const config = await loadLedgerConfig(projectPath);
    if (!config) {
      console.error("❌ No ledger.config.ts found");
      process.exit(1);
    }

    // 2. Check for migrations directory
    const migrationsPath = join(projectPath, "drizzle");
    if (!existsSync(migrationsPath)) {
      console.log("⚠️  No migrations directory found");
      console.log("   Run 'db:generate' to create migrations\n");
      return;
    }

    // 3. List migration files
    const files = readdirSync(migrationsPath, { recursive: true });
    const migrationFiles = files.filter(
      (f) =>
        typeof f === "string" && (f.endsWith(".sql") || f.includes("migration"))
    );

    if (migrationFiles.length === 0) {
      console.log("📁 No migration files found\n");
      return;
    }

    console.log(`📊 Found ${migrationFiles.length} migration file(s):\n`);

    migrationFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });

    console.log();

    // 4. Check database connection (if available)
    if (config.database) {
      console.log("💡 To check applied migrations, connect to your database");
      console.log("   and query the _migrations table.\n");
    }
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
