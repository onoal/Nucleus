/**
 * migration:status command
 *
 * Shows migration status from database.
 *
 * @module commands/migration-status
 */

import { loadLedgerConfig } from "../utils/config-loader.js";
import chalk from "chalk";

export async function migrationStatus(options: {
  path?: string;
}): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();

  console.log("📊 Migration Status from Database\n");

  try {
    // 1. Load ledger config
    const config = await loadLedgerConfig(projectPath);
    if (!config) {
      console.error("❌ No ledger.config.ts found");
      process.exit(1);
    }

    // 2. Check if database is configured
    if (!config.database) {
      console.error("❌ Database adapter not configured");
      process.exit(1);
    }

    // 3. Try to query migrations table
    // Note: This requires a database connection
    // For now, we'll show a message that this requires direct database access
    console.log("💡 Migration status requires direct database access.");
    console.log("   Query the _migrations table to see applied migrations:\n");
    console.log("   SELECT * FROM _migrations ORDER BY applied_at ASC;\n");

    // TODO: In the future, we could create a ledger instance and query directly
    // For now, this is a placeholder that shows the concept
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
