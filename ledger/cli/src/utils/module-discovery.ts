/**
 * Module Discovery Utilities
 *
 * Discovers modules from project directory and loads them.
 *
 * @module utils/module-discovery
 */

import { readdirSync, existsSync } from "fs";
import { join, extname } from "path";

/**
 * Discover modules from project directory
 *
 * @param projectPath - Path to project root
 * @returns Array of discovered modules
 */
export async function discoverModules(
  projectPath: string
): Promise<Array<{ id: string; [key: string]: any }>> {
  const modules: Array<{ id: string; [key: string]: any }> = [];
  const modulesPath = join(projectPath, "src", "modules");

  // Check if modules directory exists
  if (!existsSync(modulesPath)) {
    return modules;
  }

  // Read all files in modules directory
  const files = readdirSync(modulesPath, { recursive: true });

  for (const file of files) {
    const filePath = join(modulesPath, String(file));
    const ext = extname(filePath);

    // Only process TypeScript/JavaScript files
    if (ext !== ".ts" && ext !== ".js" && ext !== ".mjs") {
      continue;
    }

    // Skip test files
    if (String(file).includes(".test.") || String(file).includes(".spec.")) {
      continue;
    }

    try {
      // Dynamic import of module
      const moduleExports = await import(filePath);

      // Look for exported modules
      for (const [exportName, exportValue] of Object.entries(moduleExports)) {
        // Check if export is a module (has id property)
        if (
          exportValue &&
          typeof exportValue === "object" &&
          "id" in exportValue &&
          typeof (exportValue as any).id === "string"
        ) {
          modules.push(exportValue as { id: string; [key: string]: any });
        }
      }
    } catch (error) {
      // Skip files that can't be imported (e.g., type-only files)
      continue;
    }
  }

  return modules;
}
