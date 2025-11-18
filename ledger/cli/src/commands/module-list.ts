/**
 * module:list command
 *
 * Lists all registered modules in the project.
 *
 * @module commands/module-list
 */

import { discoverModules } from "../utils/module-discovery.js";
import { loadLedgerConfig } from "../utils/config-loader.js";

export async function moduleList(options: {
  path?: string;
  verbose?: boolean;
}): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();
  const verbose = (options.verbose as boolean) || false;

  console.log("📦 Registered Modules\n");

  try {
    // 1. Discover modules
    const modules = await discoverModules(projectPath);

    if (modules.length === 0) {
      console.log("⚠️  No modules found");
      console.log("   Create modules in src/modules/ directory\n");
      return;
    }

    // 2. Load ledger config to see which modules are registered
    const config = await loadLedgerConfig(projectPath);
    const registeredModuleIds = config?.modules?.map((m: any) => m.id) || [];

    // 3. Display modules
    modules.forEach((module, index) => {
      const isRegistered = registeredModuleIds.includes(module.id);
      const status = isRegistered ? "✅" : "⚠️ ";

      console.log(`${status} ${module.id}`);
      if (verbose) {
        if (module.label) {
          console.log(`   Label: ${module.label}`);
        }
        if (module.version) {
          console.log(`   Version: ${module.version}`);
        }
        if (module.dependencies && module.dependencies.length > 0) {
          console.log(`   Dependencies: ${module.dependencies.join(", ")}`);
        }
        if (module.drizzleSchema) {
          const tableCount = Object.keys(module.drizzleSchema).length;
          console.log(`   Tables: ${tableCount}`);
        }
        if (module.declarativeSchema) {
          console.log(
            `   Declarative Tables: ${module.declarativeSchema.length}`
          );
        }
        if (module.services) {
          const serviceCount = Object.keys(module.services).length;
          console.log(`   Services: ${serviceCount}`);
        }
        if (module.routes) {
          console.log(`   Routes: ${module.routes.length}`);
        }
        if (!isRegistered) {
          console.log(`   ⚠️  Not registered in ledger.config.ts`);
        }
      }
      console.log();
    });

    console.log(`📊 Total: ${modules.length} module(s)`);
    console.log(`✅ Registered: ${registeredModuleIds.length}`);
    console.log(
      `⚠️  Unregistered: ${modules.length - registeredModuleIds.length}\n`
    );
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
