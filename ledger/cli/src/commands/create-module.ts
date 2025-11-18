/**
 * create-module command
 *
 * Creates a new module with template files.
 *
 * @module commands/create-module
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export async function createModule(options: {
  name?: string;
  path?: string;
}): Promise<void> {
  const projectPath = (options.path as string) || process.cwd();
  const moduleName = options.name as string;

  if (!moduleName) {
    console.error("❌ Module name is required");
    console.error("   Usage: create-module --name <module-name>\n");
    process.exit(1);
  }

  // Validate module name
  if (!/^[a-z0-9-]+$/.test(moduleName)) {
    console.error("❌ Module name must be lowercase alphanumeric with hyphens");
    process.exit(1);
  }

  const modulesPath = join(projectPath, "src", "modules");
  const modulePath = join(modulesPath, moduleName);

  // Check if module already exists
  if (existsSync(modulePath)) {
    console.error(`❌ Module '${moduleName}' already exists at ${modulePath}`);
    process.exit(1);
  }

  // Create module directory
  mkdirSync(modulePath, { recursive: true });

  // Generate module file
  const moduleContent = `import { createCustomModule } from "@onoal/ledger-core";
import type { OnoalLedger } from "@onoal/ledger-core";

/**
 * ${moduleName} Module
 * 
 * Generated module template
 */
export const ${moduleName}Module = createCustomModule({
  id: "${moduleName}",
  label: "${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} Module",
  version: "1.0.0",

  // Services
  services: {
    // Add your services here
    // Example:
    // ${moduleName}Service: (ledger: OnoalLedger) => ({
    //   doSomething: () => {
    //     return "Hello from ${moduleName}";
    //   },
    // }),
  },

  // Routes
  routes: [
    // Add your routes here
    // Example:
    // {
    //   method: "GET",
    //   path: "/${moduleName}/hello",
    //   handler: async (req, ledger) => {
    //     const service = ledger.getService("${moduleName}Service");
    //     return new Response(JSON.stringify({ message: service.doSomething() }), {
    //       headers: { "Content-Type": "application/json" },
    //     });
    //   },
    // },
  ],

  // Hooks (optional)
  hooks: {
    // Add lifecycle hooks here
    // load: async (ledger) => {
    //   console.log("${moduleName} module loaded");
    // },
  },

  // Schema (optional)
  // declarativeSchema: [
  //   {
  //     id: "${moduleName}_table",
  //     name: "${moduleName}",
  //     fields: [
  //       { id: "id", name: "id", type: "text", primaryKey: true },
  //       { id: "created_at", name: "created_at", type: "timestamp", default: "now()" },
  //     ],
  //   },
  // ],
});
`;

  writeFileSync(join(modulePath, "index.ts"), moduleContent);

  // Generate test file
  const testContent = `import { describe, it, expect } from "vitest";
import { createTestLedger } from "@onoal/ledger-core/testing";
import { ${moduleName}Module } from "./index.js";

describe("${moduleName}Module", () => {
  it("should load successfully", async () => {
    const ledger = await createTestLedger({
      modules: [${moduleName}Module],
    });

    const modules = ledger.getModules();
    expect(modules.some((m) => m.id === "${moduleName}")).toBe(true);
  });

  // Add more tests here
});
`;

  writeFileSync(join(modulePath, `${moduleName}.test.ts`), testContent);

  // Generate README
  const readmeContent = `# ${moduleName} Module

Generated module for Onoal Ledger.

## Overview

This module provides...

## Services

- \`${moduleName}Service\` - Main service for ${moduleName}

## Routes

- \`GET /${moduleName}/hello\` - Example route

## Usage

\`\`\`typescript
import { ${moduleName}Module } from "./modules/${moduleName}";

const ledger = await createLedger({
  modules: [${moduleName}Module],
  // ... other config
});
\`\`\`

## Development

Run tests:
\`\`\`bash
pnpm test ${moduleName}
\`\`\`
`;

  writeFileSync(join(modulePath, "README.md"), readmeContent);

  console.log(chalk.green(`\n✅ Created module '${moduleName}'\n`));
  console.log(chalk.cyan("Files created:"));
  console.log(chalk.white(`  - ${join(modulePath, "index.ts")}`));
  console.log(chalk.white(`  - ${join(modulePath, `${moduleName}.test.ts`)}`));
  console.log(chalk.white(`  - ${join(modulePath, "README.md")}\n`));
  console.log(chalk.cyan("Next steps:"));
  console.log(
    chalk.white(`  1. Edit ${join(modulePath, "index.ts")} to add your logic`)
  );
  console.log(chalk.white(`  2. Register the module in ledger.config.ts`));
  console.log(chalk.white(`  3. Run tests: pnpm test ${moduleName}\n`));
}
