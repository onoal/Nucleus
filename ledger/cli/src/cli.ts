#!/usr/bin/env node

/**
 * create-onoal-ledger
 *
 * CLI tool for creating Onoal Ledger projects and managing database schemas
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import prompts from "prompts";
import { dbGenerate } from "./commands/db-generate.js";
import { dbMigrate } from "./commands/db-migrate.js";
import { dbPush } from "./commands/db-push.js";
import { dbValidate } from "./commands/db-validate.js";
import { dbStatus } from "./commands/db-status.js";
import { moduleList } from "./commands/module-list.js";
import { moduleInfo } from "./commands/module-info.js";
import { createModule } from "./commands/create-module.js";
import { dev } from "./commands/dev.js";
import { migrationList } from "./commands/migration-list.js";
import { migrationStatus } from "./commands/migration-status.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProjectOptions {
  name: string;
  platform: "node" | "cloudflare";
  database: "sqlite" | "postgres" | "d1";
  modules: string[];
}

/**
 * Generate package.json content
 */
function generatePackageJson(options: ProjectOptions): string {
  const deps: Record<string, string> = {
    "@onoal/ledger-core": "workspace:*",
  };

  // Add database adapter based on database type
  if (options.database === "postgres") {
    deps["@onoal/ledger-database-postgres"] = "workspace:*";
    deps["@neondatabase/serverless"] = "^0.9.0";
  } else if (options.database === "sqlite") {
    deps["@onoal/ledger-database-sqlite"] = "workspace:*";
  } else if (options.database === "d1") {
    deps["@onoal/ledger-database-cloudflare-d1"] = "workspace:*";
  }

  // Add modules
  if (options.modules.includes("proof")) {
    deps["@onoal/ledger-module-proof"] = "workspace:*";
  }
  if (options.modules.includes("asset")) {
    deps["@onoal/ledger-module-asset"] = "workspace:*";
  }
  if (options.modules.includes("connect")) {
    deps["@onoal/ledger-module-connect"] = "workspace:*";
  }

  // Platform-specific dependencies
  if (options.platform === "node") {
    deps["express"] = "^4.18.0";
  }

  const scripts: Record<string, string> = {
    build: "tsc",
  };

  if (options.platform === "node") {
    scripts.dev = "tsx watch src/index.ts";
    scripts.start = "node dist/index.js";
  } else {
    scripts.dev = "wrangler dev";
    scripts.deploy = "wrangler deploy";
  }

  return JSON.stringify(
    {
      name: options.name,
      version: "1.0.0",
      type: "module",
      scripts,
      dependencies: deps,
      devDependencies: {
        "@types/node": "^20.0.0",
        "@types/express": "^4.17.21",
        typescript: "^5.9.2",
        tsx: "^4.7.0",
      },
    },
    null,
    2
  );
}

/**
 * Generate ledger code
 */
function generateLedgerCode(options: ProjectOptions): string {
  const adapterImport =
    options.database === "postgres"
      ? 'import { postgresAdapter } from "@onoal/ledger-database-postgres";'
      : options.database === "sqlite"
        ? 'import { sqliteAdapter } from "@onoal/ledger-database-sqlite";'
        : 'import { d1Adapter } from "@onoal/ledger-database-cloudflare-d1";';

  const adapterCall =
    options.platform === "node"
      ? options.database === "postgres"
        ? "postgresAdapter({ connectionString: process.env.DATABASE_URL! })"
        : 'sqliteAdapter({ path: "./ledger.db", enableWAL: true })'
      : "d1Adapter(env.DB)";

  const moduleImports = options.modules
    .map((m) => {
      const moduleName = m.charAt(0).toUpperCase() + m.slice(1);
      return `import { ${m}Module } from "@onoal/ledger-module-${m}";`;
    })
    .join("\n");

  const modules = options.modules.map((m) => `${m}Module()`).join(", ");

  // Generate signing key helper
  const signingKeyHelper = `
/**
 * Generate Ed25519 signing key
 * In production, use a secure key management system
 */
function generateSigningKey(): Uint8Array {
  // For development: generate a random key
  // In production: load from secure storage
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
`;

  if (options.platform === "cloudflare") {
    return `import { createLedger } from "@onoal/ledger-core";
import { createLedgerServer } from "@onoal/ledger-core/server";
${adapterImport}
${moduleImports}

export interface Env {
  DB: D1Database;
  LEDGER_NAME?: string;
  LEDGER_PRIVATE_KEY?: string; // Hex-encoded Ed25519 private key
}

${signingKeyHelper}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get or generate signing key
    const signingKey = env.LEDGER_PRIVATE_KEY
      ? hexToBytes(env.LEDGER_PRIVATE_KEY)
      : generateSigningKey();

    // Create ledger instance
    const ledger = await createLedger({
      name: env.LEDGER_NAME || "${options.name}",
      signingKey,
      adapter: ${adapterCall},
      modules: [${modules}],
    });

    // Run migrations
    await ledger.config.adapter.migrate?.();

    // Create API server
    const server = createLedgerServer(ledger);
    return server.handleRequest(request);
  },
};
`;
  } else {
    return `import express from "express";
import { createLedger } from "@onoal/ledger-core";
import { createLedgerServer } from "@onoal/ledger-core/server";
${adapterImport}
${moduleImports}

${signingKeyHelper}

async function main() {
  // Get or generate signing key
  const privateKeyHex = process.env.LEDGER_PRIVATE_KEY;
  const signingKey = privateKeyHex
    ? hexToBytes(privateKeyHex)
    : generateSigningKey();

  // Create ledger instance
  const ledger = await createLedger({
    name: process.env.LEDGER_NAME || "${options.name}",
    signingKey,
    adapter: ${adapterCall},
    modules: [${modules}],
  });

  // Run migrations
  await ledger.config.adapter.migrate?.();

  // Create Express app
  const app = express();
  app.use(express.json());

  // Create API server
  const server = createLedgerServer(ledger);

  // Register all routes
  for (const route of server.routes) {
    app[route.method.toLowerCase()](route.path, async (req, res) => {
      try {
        const url = \`\${req.protocol}://\${req.get("host")}\${req.originalUrl}\`;
        const request = new Request(url, {
          method: req.method,
          headers: req.headers as HeadersInit,
          body:
            req.method !== "GET" && req.method !== "HEAD"
              ? JSON.stringify(req.body)
              : undefined,
        });

        const response = await server.handleRequest(request);
        const data = await response.json();
        res.status(response.status).json(data);
      } catch (error) {
        console.error("Route handler error:", error);
        res.status(500).json({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  // Health check endpoint
  app.get("/", (req, res) => {
    res.json({
      message: "Ledger API",
      ledger: ledger.config.name,
      modules: ledger.getModules().map((m) => m.id),
    });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(\`Ledger server running on http://localhost:\${port}\`);
    console.log(\`Available modules: \${ledger.getModules().map((m) => m.id).join(", ")}\`);
  });
}

main().catch((error) => {
  console.error("Failed to start ledger server:", error);
  process.exit(1);
});
`;
  }
}

/**
 * Generate tsconfig.json
 */
function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        lib: ["ES2022"],
        moduleResolution: "bundler",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        declaration: true,
        outDir: "./dist",
        rootDir: "./src",
        resolveJsonModule: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2
  );
}

/**
 * Create project
 */
async function createProject() {
  console.log(chalk.blue.bold("\n🚀 Create Onoal Ledger\n"));

  const response = await prompts([
    {
      type: "text",
      name: "name",
      message: "Project name:",
      initial: "my-ledger",
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "Project name is required";
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Project name must be lowercase alphanumeric with hyphens";
        }
        return true;
      },
    },
    {
      type: "select",
      name: "platform",
      message: "Platform:",
      choices: [
        { title: "Node.js (Express)", value: "node" },
        { title: "Cloudflare Workers", value: "cloudflare" },
      ],
      initial: 0,
    },
    {
      type: "select",
      name: "database",
      message: "Database:",
      choices: (prev: string) => {
        if (prev === "node") {
          return [
            { title: "SQLite (development)", value: "sqlite" },
            { title: "PostgreSQL (production)", value: "postgres" },
          ];
        } else {
          return [{ title: "D1 (Cloudflare)", value: "d1" }];
        }
      },
      initial: 0,
    },
    {
      type: "multiselect",
      name: "modules",
      message: "Select modules:",
      choices: [
        { title: "Proof Module", value: "proof", selected: true },
        { title: "Asset Module", value: "asset", selected: true },
        { title: "Connect Module", value: "connect", selected: true },
      ],
    },
  ]);

  if (!response.name || !response.platform || !response.database) {
    console.log(chalk.red("❌ Cancelled"));
    process.exit(0);
  }

  const options: ProjectOptions = {
    name: response.name,
    platform: response.platform,
    database: response.database,
    modules: response.modules || ["proof", "asset", "connect"],
  };

  const projectPath = join(process.cwd(), options.name);

  // Check if directory exists
  if (existsSync(projectPath)) {
    const overwrite = await prompts({
      type: "confirm",
      name: "value",
      message: `Directory ${options.name} already exists. Overwrite?`,
      initial: false,
    });

    if (!overwrite.value) {
      console.log(chalk.red("❌ Cancelled"));
      process.exit(0);
    }
  }

  // Create directory structure
  mkdirSync(projectPath, { recursive: true });
  mkdirSync(join(projectPath, "src"), { recursive: true });

  // Generate files
  writeFileSync(
    join(projectPath, "package.json"),
    generatePackageJson(options)
  );
  writeFileSync(join(projectPath, "tsconfig.json"), generateTsConfig());
  writeFileSync(join(projectPath, "src/index.ts"), generateLedgerCode(options));

  // Create .gitignore
  writeFileSync(
    join(projectPath, ".gitignore"),
    `node_modules
dist
*.db
.env
.DS_Store
*.log
`
  );

  // Create .env.example
  const envExample =
    options.platform === "node"
      ? options.database === "postgres"
        ? `LEDGER_NAME=${options.name}
LEDGER_PRIVATE_KEY=your-ed25519-private-key-hex
DATABASE_URL=postgresql://user:password@localhost:5432/ledger
PORT=3000
`
        : `LEDGER_NAME=${options.name}
LEDGER_PRIVATE_KEY=your-ed25519-private-key-hex
PORT=3000
`
      : `LEDGER_NAME=${options.name}
LEDGER_PRIVATE_KEY=your-ed25519-private-key-hex
`;

  writeFileSync(join(projectPath, ".env.example"), envExample);

  // Create README
  const readme = `# ${options.name}

Onoal Ledger project created with \`create-onoal-ledger\`.

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\` and configure:

- \`LEDGER_NAME\`: Your ledger name
- \`LEDGER_PRIVATE_KEY\`: Ed25519 private key (hex format)
${options.database === "postgres" ? "- `DATABASE_URL`: PostgreSQL connection string\n" : ""}${options.platform === "node" ? "- `PORT`: Server port (default: 3000)\n" : ""}

## API Endpoints

${
  options.modules.includes("proof")
    ? `### Proof Endpoints
- \`POST /ledger/submit\` - Submit proof
- \`GET /ledger/proof/:id\` - Get proof by ID
- \`GET /ledger/proofs\` - Query proofs

`
    : ""
}${
    options.modules.includes("asset")
      ? `### Asset Endpoints
- \`POST /asset/issue\` - Issue asset
- \`GET /asset/:id\` - Get asset by ID
- \`GET /asset/list\` - Query assets

`
      : ""
  }${
    options.modules.includes("connect")
      ? `### Connect Endpoints
- \`POST /connect/grant\` - Create connect grant
- \`GET /connect/grant/:id\` - Get grant by ID
- \`GET /connect/grants\` - Query grants

`
      : ""
  }## Database

${
  options.database === "sqlite"
    ? `This project uses SQLite. The database file will be created at \`./ledger.db\`.

To run migrations:
\`\`\`bash
# Migrations run automatically on first start
pnpm dev
\`\`\`
`
    : options.database === "postgres"
      ? `This project uses PostgreSQL. Make sure to:

1. Set up a PostgreSQL database
2. Configure \`DATABASE_URL\` in \`.env\`
3. Run migrations using Drizzle Kit

\`\`\`bash
# Generate migrations
pnpm drizzle-kit generate

# Run migrations
pnpm drizzle-kit push
\`\`\`
`
      : `This project uses Cloudflare D1. Make sure to:

1. Create a D1 database in Cloudflare
2. Bind it in \`wrangler.toml\`
3. Run migrations (they run automatically on first deploy)
`
}

## Documentation

See [Ledger Framework Documentation](https://github.com/onoal/onoal-os) for more information.
`;

  writeFileSync(join(projectPath, "README.md"), readme);

  // Cloudflare-specific files
  if (options.platform === "cloudflare") {
    const wranglerToml = `name = "${options.name}"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "${options.name}"
database_id = "your-database-id"

[env.production]
LEDGER_NAME = "${options.name}"
LEDGER_PRIVATE_KEY = "your-ed25519-private-key-hex"
`;

    writeFileSync(join(projectPath, "wrangler.toml"), wranglerToml);
  }

  console.log(chalk.green(`\n✅ Created ${options.name}/\n`));
  console.log(chalk.cyan("Next steps:"));
  console.log(chalk.white(`  cd ${options.name}`));
  console.log(chalk.white("  pnpm install"));
  if (options.platform === "cloudflare" && options.database === "d1") {
    console.log(chalk.white("  # Create D1 database: wrangler d1 create"));
    console.log(chalk.white("  # Update wrangler.toml with database_id"));
  }
  console.log(chalk.white("  pnpm dev\n"));
}

// Helper function to parse CLI options
function parseOptions(): {
  provider?: "postgres" | "sqlite" | "d1";
  outDir?: string;
  config?: string;
  projectPath?: string;
} {
  const providerIndex = process.argv.indexOf("--provider");
  const provider =
    providerIndex !== -1 && process.argv[providerIndex + 1]
      ? (process.argv[providerIndex + 1] as "postgres" | "sqlite" | "d1")
      : undefined;

  const outDirIndex = process.argv.indexOf("--out");
  const outDir =
    outDirIndex !== -1 && process.argv[outDirIndex + 1]
      ? process.argv[outDirIndex + 1]
      : undefined;

  const configIndex = process.argv.indexOf("--config");
  const config =
    configIndex !== -1 && process.argv[configIndex + 1]
      ? process.argv[configIndex + 1]
      : undefined;

  const projectPathIndex = process.argv.indexOf("--path");
  const projectPath =
    projectPathIndex !== -1 && process.argv[projectPathIndex + 1]
      ? process.argv[projectPathIndex + 1]
      : undefined;

  return { provider, outDir, config, projectPath };
}

// Helper function to parse command options
function parseCommandOptions(): Record<string, any> {
  const options: Record<string, any> = {};

  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = process.argv[i + 1];
      if (nextArg && !nextArg.startsWith("--") && !nextArg.startsWith("-")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const nextArg = process.argv[i + 1];
      if (nextArg && !nextArg.startsWith("-") && !nextArg.startsWith("--")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return options;
}

// CLI argument parser
const command = process.argv[2];

if (command === "db:generate") {
  const options = parseOptions();
  dbGenerate(options).catch((error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "db:migrate") {
  const options = parseOptions();
  dbMigrate(options).catch((error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "db:push") {
  const options = parseOptions();
  dbPush(options).catch((error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "db:validate") {
  const options = parseCommandOptions();
  dbValidate(options).catch((error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "db:status") {
  const options = parseCommandOptions();
  dbStatus(options).catch((error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "module:list") {
  const options = parseCommandOptions();
  moduleList(options).catch((error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "module:info") {
  const options = parseCommandOptions();
  moduleInfo(options).catch((error: Error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "create-module") {
  const options = parseCommandOptions();
  createModule(options).catch((error: Error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "dev") {
  const options = parseCommandOptions();
  dev(options).catch((error: Error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "migration:list") {
  const options = parseCommandOptions();
  migrationList(options).catch((error: Error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else if (command === "migration:status") {
  const options = parseCommandOptions();
  migrationStatus(options).catch((error: Error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
} else {
  // Default: create project
  createProject().catch((error) => {
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  });
}
