/**
 * Config Loader Utilities
 *
 * Loads ledger configuration from project.
 *
 * @module utils/config-loader
 */

import { existsSync } from "fs";
import { join } from "path";

/**
 * Load ledger config from project
 *
 * @param projectPath - Path to project root
 * @returns Ledger config or null if not found
 */
export async function loadLedgerConfig(projectPath: string): Promise<{
  database?: any;
  modules?: Array<{ id: string; [key: string]: any }>;
} | null> {
  const configPath = join(projectPath, "ledger.config.ts");

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    // Dynamic import of config (convert to file:// URL for Windows compatibility)
    const configUrl = configPath.startsWith("file://")
      ? configPath
      : `file://${configPath}`;
    const configModule = await import(configUrl);

    // Look for default export or named export
    const config =
      configModule.default || configModule.config || configModule.ledgerConfig;

    if (!config) {
      return null;
    }

    return config as {
      database?: any;
      modules?: Array<{ id: string; [key: string]: any }>;
    };
  } catch (error) {
    // Config file exists but can't be loaded
    return null;
  }
}
