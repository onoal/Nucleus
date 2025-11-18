/**
 * db:migrate Command
 *
 * Runs database migrations from generated migration files.
 *
 * @module commands/db-migrate
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";

/**
 * Main db:migrate command
 */
export async function dbMigrate(options: {
  projectPath?: string;
  provider?: "postgres" | "sqlite" | "d1";
}): Promise<void> {
  const projectPath = options.projectPath || process.cwd();

  console.log(chalk.blue.bold("\n🔄 Running Database Migrations\n"));

  // Check if drizzle.config.ts exists
  const drizzleConfigPath = join(projectPath, "drizzle.config.ts");
  if (!existsSync(drizzleConfigPath)) {
    console.error(
      chalk.red(
        "❌ drizzle.config.ts not found. Run 'onoal db:generate' first."
      )
    );
    process.exit(1);
  }

  // Detect provider
  const provider = options.provider || detectProvider(projectPath);
  console.log(chalk.cyan(`🗄️  Using database provider: ${provider}\n`));

  // Run migrations based on provider
  try {
    if (provider === "postgres" || provider === "sqlite") {
      // Use drizzle-kit push for postgres/sqlite
      console.log(chalk.yellow("📤 Pushing migrations to database..."));
      execSync("pnpm drizzle-kit push", {
        cwd: projectPath,
        stdio: "inherit",
      });
      console.log(chalk.green("\n✅ Migrations applied successfully!"));
    } else if (provider === "d1") {
      // Use wrangler d1 migrations for D1
      console.log(chalk.yellow("📤 Applying D1 migrations..."));
      execSync("pnpm wrangler d1 migrations apply", {
        cwd: projectPath,
        stdio: "inherit",
      });
      console.log(chalk.green("\n✅ D1 migrations applied successfully!"));
    }
  } catch (error) {
    console.error(chalk.red("\n❌ Failed to apply migrations:"), error);
    process.exit(1);
  }
}

/**
 * Detect database provider from package.json
 */
function detectProvider(projectPath: string): "postgres" | "sqlite" | "d1" {
  const packageJsonPath = join(projectPath, "package.json");

  if (!existsSync(packageJsonPath)) {
    return "sqlite"; // Default
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const allDeps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  };

  if (allDeps["@onoal/ledger-database-cloudflare-d1"]) {
    return "d1";
  }
  if (allDeps["@neondatabase/serverless"] || allDeps["pg"]) {
    return "postgres";
  }
  return "sqlite"; // Default
}
