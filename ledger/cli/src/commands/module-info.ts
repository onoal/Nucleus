/**
 * module:info command
 *
 * Shows detailed information about a specific module.
 *
 * @module commands/module-info
 */

import { discoverModules } from "../utils/module-discovery.js";
import { loadLedgerConfig } from "../utils/config-loader.js";

export async function moduleInfo(options: {
  path?: string;
  module?: string;
}): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();
  const moduleId = options.module as string;

  if (!moduleId) {
    console.error("❌ Module ID is required");
    console.error("   Usage: module:info --module <module-id>\n");
    process.exit(1);
  }

  console.log(`📦 Module Information: ${moduleId}\n`);

  try {
    // 1. Discover modules
    const modules = await discoverModules(projectPath);
    const module = modules.find((m) => m.id === moduleId);

    if (!module) {
      console.error(`❌ Module '${moduleId}' not found`);
      console.error(
        `   Available modules: ${modules.map((m) => m.id).join(", ")}\n`
      );
      process.exit(1);
    }

    // 2. Load ledger config
    const config = await loadLedgerConfig(projectPath);
    const isRegistered =
      config?.modules?.some((m: any) => m.id === moduleId) || false;

    // 3. Display module information
    console.log("📋 Basic Information:");
    console.log(`   ID: ${module.id}`);
    if (module.label) {
      console.log(`   Label: ${module.label}`);
    }
    if (module.version) {
      console.log(`   Version: ${module.version}`);
    }
    console.log(
      `   Status: ${isRegistered ? "✅ Registered" : "⚠️  Not registered"}`
    );
    console.log();

    // Dependencies
    if (module.dependencies && module.dependencies.length > 0) {
      console.log("🔗 Dependencies:");
      module.dependencies.forEach((dep: string) => {
        const depModule = modules.find((m) => m.id === dep);
        const status = depModule ? "✅" : "❌";
        console.log(`   ${status} ${dep}`);
      });
      console.log();
    }

    // Services
    if (module.services) {
      const serviceNames = Object.keys(module.services);
      console.log(`🔧 Services: ${serviceNames.length}`);
      if (serviceNames.length > 0) {
        serviceNames.forEach((name) => {
          console.log(`   - ${name}`);
        });
      }
      console.log();
    }

    // Routes
    if (module.routes) {
      console.log(`🛣️  Routes: ${module.routes.length}`);
      module.routes.forEach((route: any) => {
        console.log(`   ${route.method} ${route.path}`);
      });
      console.log();
    }

    // Schema
    if (module.drizzleSchema) {
      const tableNames = Object.keys(module.drizzleSchema);
      console.log(`📊 Drizzle Schema: ${tableNames.length} table(s)`);
      tableNames.forEach((name) => {
        console.log(`   - ${name}`);
      });
      console.log();
    }

    if (module.declarativeSchema) {
      console.log(
        `📊 Declarative Schema: ${module.declarativeSchema.length} table(s)`
      );
      module.declarativeSchema.forEach((schema: any) => {
        console.log(`   - ${schema.name} (${schema.fields.length} fields)`);
      });
      console.log();
    }

    // Hooks
    const hasHooks = module.hooks && Object.keys(module.hooks).length > 0;
    if (hasHooks) {
      const hookNames = Object.keys(module.hooks || {});
      console.log(`🪝 Hooks: ${hookNames.length}`);
      hookNames.forEach((name) => {
        console.log(`   - ${name}`);
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
