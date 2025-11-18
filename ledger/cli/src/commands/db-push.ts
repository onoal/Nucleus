/**
 * db:push Command
 *
 * Pushes schema changes directly to database (development only).
 * This is a shortcut for db:generate + db:migrate.
 *
 * @module commands/db-push
 */

import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { dbGenerate } from "./db-generate.js";
import { dbMigrate } from "./db-migrate.js";

/**
 * Main db:push command
 */
export async function dbPush(options: {
  projectPath?: string;
  provider?: "postgres" | "sqlite" | "d1";
  outDir?: string;
}): Promise<void> {
  const projectPath = options.projectPath || process.cwd();

  console.log(chalk.blue.bold("\n🚀 Push Schema to Database\n"));

  // Step 1: Generate schemas and migrations
  console.log(chalk.cyan("Step 1: Generating schemas and migrations...\n"));
  await dbGenerate({
    projectPath,
    provider: options.provider,
    outDir: options.outDir,
  });

  // Step 2: Apply migrations
  console.log(chalk.cyan("\nStep 2: Applying migrations...\n"));
  await dbMigrate({
    projectPath,
    provider: options.provider,
  });

  console.log(chalk.green.bold("\n✅ Schema pushed successfully!\n"));
}
