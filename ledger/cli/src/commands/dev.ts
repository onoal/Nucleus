/**
 * dev command
 *
 * Development server with hot reload support.
 *
 * @module commands/dev
 */

import { watch, existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import chalk from "chalk";

let serverProcess: ReturnType<typeof spawn> | null = null;
let restartTimeout: NodeJS.Timeout | null = null;

export async function dev(options: {
  path?: string;
  port?: number;
  watch?: boolean;
}): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();
  const port = (options.port as number) || 3000;
  const watchFiles = (options.watch as boolean) !== false; // Default true

  console.log(chalk.blue.bold("\n🚀 Starting Development Server\n"));
  console.log(chalk.cyan(`📁 Project: ${projectPath}`));
  console.log(chalk.cyan(`🌐 Port: ${port}\n`));

  // Start server
  await startServer(projectPath, port);

  if (watchFiles) {
    // Watch for file changes
    console.log(chalk.yellow("👀 Watching for file changes...\n"));

    const watchPaths = [
      join(projectPath, "src"),
      join(projectPath, "ledger.config.ts"),
    ];

    watchPaths.forEach((watchPath) => {
      if (!existsSync(watchPath)) {
        return;
      }

      watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Ignore test files and node_modules
        if (
          filename.includes(".test.") ||
          filename.includes(".spec.") ||
          filename.includes("node_modules") ||
          filename.includes("dist")
        ) {
          return;
        }

        console.log(chalk.yellow(`\n📝 File changed: ${filename}\n`));

        // Debounce restarts
        if (restartTimeout) {
          clearTimeout(restartTimeout);
        }

        restartTimeout = setTimeout(() => {
          console.log(chalk.cyan("🔄 Restarting server...\n"));
          restartServer(projectPath, port);
        }, 500);
      });
    });

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log(chalk.yellow("\n\n🛑 Shutting down...\n"));
      if (serverProcess) {
        serverProcess.kill();
      }
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log(chalk.yellow("\n\n🛑 Shutting down...\n"));
      if (serverProcess) {
        serverProcess.kill();
      }
      process.exit(0);
    });
  }
}

async function startServer(projectPath: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if there's a dev script in package.json
    const packageJsonPath = join(projectPath, "package.json");

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

      if (packageJson.scripts?.dev) {
        // Use the project's dev script
        console.log(chalk.cyan("📦 Using project dev script\n"));

        serverProcess = spawn("pnpm", ["dev"], {
          cwd: projectPath,
          stdio: "inherit",
          shell: true,
        });

        serverProcess.on("error", (error) => {
          console.error(chalk.red("❌ Failed to start server:"), error);
          reject(error);
        });

        serverProcess.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            console.error(chalk.red(`\n❌ Server exited with code ${code}`));
          }
        });

        // Give it a moment to start
        setTimeout(() => {
          console.log(
            chalk.green(`✅ Server running on http://localhost:${port}\n`)
          );
          resolve();
        }, 2000);
        return;
      }
    }

    // Fallback: try to run the built server
    const distPath = join(projectPath, "dist", "index.js");
    if (existsSync(distPath)) {
      console.log(chalk.cyan("📦 Running built server\n"));

      serverProcess = spawn("node", [distPath], {
        cwd: projectPath,
        stdio: "inherit",
        env: {
          ...process.env,
          PORT: port.toString(),
        },
      });

      serverProcess.on("error", (error) => {
        console.error(chalk.red("❌ Failed to start server:"), error);
        reject(error);
      });

      serverProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          console.error(chalk.red(`\n❌ Server exited with code ${code}`));
        }
      });

      setTimeout(() => {
        console.log(
          chalk.green(`✅ Server running on http://localhost:${port}\n`)
        );
        resolve();
      }, 2000);
      return;
    }

    // No server found
    console.error(
      chalk.red(
        "❌ No server found. Please ensure you have:\n" +
          "  1. A 'dev' script in package.json, or\n" +
          "  2. A built server at dist/index.js\n"
      )
    );
    reject(new Error("No server found"));
  });
}

function restartServer(projectPath: string, port: number): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  // Restart after a short delay
  setTimeout(() => {
    startServer(projectPath, port).catch((error) => {
      console.error(chalk.red("❌ Failed to restart server:"), error);
    });
  }, 1000);
}
