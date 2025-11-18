# Nucleus Engine – Fase 4: @onoal/nucleus (TS DX) (Gedetailleerd Plan)

## Overzicht

Dit document bevat een gedetailleerd stappenplan voor **Fase 4: @onoal/nucleus – TypeScript DX Layer (Week 11-14)**. Elke stap bevat:

- **Waarom** - De reden en het doel
- **Wat** - Wat er precies gedaan moet worden
- **Waar** - Waar in de codebase
- **Hoe** - Hoe het geïmplementeerd wordt

---

## Stap 4.1: TypeScript Project Setup

### Stap 4.1.1: @onoal/nucleus Package Setup

#### Waarom

De TypeScript DX layer is de developer-friendly API die developers gebruiken om ledgers te configureren en te gebruiken. Het is een builder/config API die onder water WASM of HTTP gebruikt, maar developers voelen alsof ze een native TypeScript API gebruiken.

#### Wat

- Maak `@onoal/nucleus` package directory
- Maak `package.json` met TypeScript configuratie
- Setup TypeScript project structuur
- Configureer build tools

#### Waar

```
packages/
└── nucleus/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.build.json
    └── src/
        └── index.ts         # Main entry point
```

#### Hoe

**1. Maak package directory:**

```bash
mkdir -p packages/nucleus/src
cd packages/nucleus
```

**2. Maak package.json (`packages/nucleus/package.json`):**

```json
{
  "name": "@onoal/nucleus",
  "version": "0.1.0",
  "description": "Nucleus Engine - TypeScript DX Layer for building custom ledgers",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@onoal/nucleus-wasm": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "@onoal/nucleus-wasm": "^0.1.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/onoal/nucleus"
  },
  "keywords": [
    "ledger",
    "blockchain",
    "nucleus",
    "typescript"
  ],
  "author": "Onoal Team",
  "license": "MIT"
}
```

**3. Maak tsconfig.json (`packages/nucleus/tsconfig.json`):**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**4. Maak tsconfig.build.json (`packages/nucleus/tsconfig.build.json`):**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "node_modules"]
}
```

**5. Maak basis index.ts (`packages/nucleus/src/index.ts`):**

```typescript
/**
 * @onoal/nucleus - TypeScript DX Layer for Nucleus Engine
 *
 * This package provides a developer-friendly TypeScript API for building
 * and using custom ledgers powered by the Nucleus Engine (Rust).
 */

// Re-export types
export * from './types';

// Re-export main API
export { Nucleus } from './nucleus';
export { createLedger } from './factory';

// Re-export module helpers
export { assetModule, proofModule } from './modules';
```

**6. Verifieer setup:**

```bash
npm install
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Package directory bestaat
- ✅ `package.json` is geconfigureerd
- ✅ TypeScript compileert zonder errors
- ✅ Dependencies zijn geïnstalleerd

---

### Stap 4.1.2: Type Definitions

#### Waarom

Type definitions maken de API type-safe en developer-friendly. Ze definiëren alle interfaces en types die developers gebruiken.

#### Wat

- Definieer core types (LedgerConfig, Record, etc.)
- Definieer module types
- Definieer backend types (WASM/HTTP)
- Schrijf type tests

#### Waar

```
packages/nucleus/src/
└── types/
    ├── index.ts             # Type exports
    ├── ledger.ts            # Ledger types
    ├── record.ts            # Record types
    ├── module.ts            # Module types
    └── backend.ts           # Backend types
```

#### Hoe

**1. Maak types directory:**

```bash
mkdir -p packages/nucleus/src/types
```

**2. Maak ledger.ts (`packages/nucleus/src/types/ledger.ts`):**

```typescript
import type { ModuleConfig } from './module';
import type { BackendConfig } from './backend';

/**
 * Ledger configuration
 */
export interface LedgerConfig {
  /**
   * Unique ledger identifier
   */
  id: string;

  /**
   * Backend configuration (WASM or HTTP)
   */
  backend: BackendConfig;

  /**
   * Modules to load
   */
  modules: ModuleConfig[];

  /**
   * Optional configuration options
   */
  options?: LedgerOptions;
}

/**
 * Ledger configuration options
 */
export interface LedgerOptions {
  /**
   * Enable strict validation
   */
  strictValidation?: boolean;

  /**
   * Maximum number of entries in memory
   */
  maxEntries?: number;

  /**
   * Enable metrics collection
   */
  enableMetrics?: boolean;
}

/**
 * Ledger instance interface
 */
export interface Ledger {
  /**
   * Ledger ID
   */
  readonly id: string;

  /**
   * Append a record to the ledger
   */
  append(record: Record): Promise<string>;

  /**
   * Get a record by hash
   */
  get(hash: string): Promise<Record | null>;

  /**
   * Get a record by ID
   */
  getById(id: string): Promise<Record | null>;

  /**
   * Query records with filters
   */
  query(filters: QueryFilters): Promise<QueryResult>;

  /**
   * Append multiple records atomically
   */
  appendBatch(records: Record[]): Promise<string[]>;

  /**
   * Verify chain integrity
   */
  verify(): Promise<void>;

  /**
   * Get entry count
   */
  length(): Promise<number>;

  /**
   * Check if ledger is empty
   */
  isEmpty(): Promise<boolean>;

  /**
   * Get latest entry hash
   */
  latestHash(): Promise<string | null>;
}
```

**3. Maak record.ts (`packages/nucleus/src/types/record.ts`):**

```typescript
/**
 * Record payload type
 */
export type RecordPayload = Record<string, unknown>;

/**
 * Record metadata type
 */
export type RecordMetadata = Record<string, unknown>;

/**
 * Ledger record
 */
export interface Record {
  /**
   * Unique record identifier
   */
  id: string;

  /**
   * Stream type (e.g., "proofs", "assets", "consent")
   */
  stream: string;

  /**
   * Unix timestamp in milliseconds
   */
  timestamp: number;

  /**
   * Record payload (JSON object)
   */
  payload: RecordPayload;

  /**
   * Optional metadata
   */
  meta?: RecordMetadata;
}

/**
 * Query filters
 */
export interface QueryFilters {
  /**
   * Filter by stream
   */
  stream?: string;

  /**
   * Filter by record ID
   */
  id?: string;

  /**
   * Limit number of results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Timestamp range (start)
   */
  timestampFrom?: number;

  /**
   * Timestamp range (end)
   */
  timestampTo?: number;

  /**
   * Module-specific filters
   */
  moduleFilters?: Record<string, unknown>;
}

/**
 * Query result
 */
export interface QueryResult {
  /**
   * Matching records
   */
  records: Record[];

  /**
   * Total number of matching records (before limit/offset)
   */
  total: number;

  /**
   * Whether there are more results
   */
  hasMore: boolean;
}
```

**4. Maak module.ts (`packages/nucleus/src/types/module.ts`):**

```typescript
/**
 * Module configuration
 */
export interface ModuleConfig {
  /**
   * Module identifier
   */
  id: string;

  /**
   * Module version
   */
  version: string;

  /**
   * Module-specific configuration
   */
  config: Record<string, unknown>;
}

/**
 * Module factory function type
 */
export type ModuleFactory = (config?: Record<string, unknown>) => ModuleConfig;

/**
 * Asset module configuration
 */
export interface AssetModuleConfig {
  /**
   * Asset name/identifier
   */
  name: string;

  /**
   * Schema definition (optional)
   */
  schema?: Record<string, unknown>;

  /**
   * Fields to index by
   */
  indexBy?: string[];
}

/**
 * Proof module configuration
 */
export interface ProofModuleConfig {
  /**
   * Proof strategies
   */
  strategies?: string[];
}
```

**5. Maak backend.ts (`packages/nucleus/src/types/backend.ts`):**

```typescript
/**
 * Backend mode
 */
export type BackendMode = 'wasm' | 'http';

/**
 * WASM backend configuration
 */
export interface WasmBackendConfig {
  mode: 'wasm';
  /**
   * Optional WASM module path (for custom builds)
   */
  wasmPath?: string;
}

/**
 * HTTP backend configuration
 */
export interface HttpBackendConfig {
  mode: 'http';
  /**
   * Server URL
   */
  url: string;
  /**
   * Optional authentication token
   */
  token?: string;
}

/**
 * Backend configuration
 */
export type BackendConfig = WasmBackendConfig | HttpBackendConfig;
```

**6. Maak types/index.ts (`packages/nucleus/src/types/index.ts`):**

```typescript
export * from './ledger';
export * from './record';
export * from './module';
export * from './backend';
```

**7. Verifieer types:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Alle type definitions zijn compleet
- ✅ Types zijn geëxporteerd
- ✅ TypeScript compileert zonder errors
- ✅ Types zijn type-safe

---

## Stap 4.2: Backend Abstraction

### Stap 4.2.1: Backend Interface

#### Waarom

We moeten een abstractie laag maken die zowel WASM als HTTP backends ondersteunt. Dit maakt het mogelijk om dezelfde API te gebruiken ongeacht de backend.

#### Wat

- Definieer Backend interface
- Implementeer WASM backend
- Implementeer HTTP backend (placeholder)
- Schrijf backend tests

#### Waar

```
packages/nucleus/src/
└── backend/
    ├── index.ts             # Backend exports
    ├── interface.ts         # Backend interface
    ├── wasm.ts              # WASM backend
    └── http.ts              # HTTP backend (placeholder)
```

#### Hoe

**1. Maak backend directory:**

```bash
mkdir -p packages/nucleus/src/backend
```

**2. Maak interface.ts (`packages/nucleus/src/backend/interface.ts`):**

```typescript
import type { Record, QueryFilters, QueryResult } from '../types';

/**
 * Backend interface - abstracts WASM and HTTP backends
 */
export interface Backend {
  /**
   * Initialize the backend
   */
  init(): Promise<void>;

  /**
   * Append a record
   */
  append(record: Record): Promise<string>;

  /**
   * Get a record by hash
   */
  get(hash: string): Promise<Record | null>;

  /**
   * Get a record by ID
   */
  getById(id: string): Promise<Record | null>;

  /**
   * Query records
   */
  query(filters: QueryFilters): Promise<QueryResult>;

  /**
   * Append multiple records atomically
   */
  appendBatch(records: Record[]): Promise<string[]>;

  /**
   * Verify chain integrity
   */
  verify(): Promise<void>;

  /**
   * Get entry count
   */
  length(): Promise<number>;

  /**
   * Check if ledger is empty
   */
  isEmpty(): Promise<boolean>;

  /**
   * Get latest entry hash
   */
  latestHash(): Promise<string | null>;
}
```

**3. Maak wasm.ts (`packages/nucleus/src/backend/wasm.ts`):**

```typescript
import type { Backend } from './interface';
import type {
  Record,
  QueryFilters,
  QueryResult,
  WasmBackendConfig,
} from '../types';
import type { WasmLedger } from '@onoal/nucleus-wasm';

/**
 * WASM backend implementation
 */
export class WasmBackend implements Backend {
  private ledger: WasmLedger | null = null;
  private config: WasmBackendConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: WasmBackendConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // Dynamic import to avoid bundling issues
      const wasmModule = await import('@onoal/nucleus-wasm');
      await wasmModule.default();

      // Ledger will be created by the factory
      // This is just initialization
    })();

    return this.initPromise;
  }

  /**
   * Set the ledger instance (called by factory)
   */
  setLedger(ledger: WasmLedger): void {
    this.ledger = ledger;
  }

  private ensureLedger(): WasmLedger {
    if (!this.ledger) {
      throw new Error('Ledger not initialized. Call factory.createLedger() first.');
    }
    return this.ledger;
  }

  async append(record: Record): Promise<string> {
    const ledger = this.ensureLedger();
    return ledger.append_record(record);
  }

  async get(hash: string): Promise<Record | null> {
    const ledger = this.ensureLedger();
    try {
      return ledger.get_record(hash);
    } catch {
      return null;
    }
  }

  async getById(id: string): Promise<Record | null> {
    const ledger = this.ensureLedger();
    try {
      return ledger.get_record_by_id(id);
    } catch {
      return null;
    }
  }

  async query(filters: QueryFilters): Promise<QueryResult> {
    const ledger = this.ensureLedger();
    return ledger.query(filters);
  }

  async appendBatch(records: Record[]): Promise<string[]> {
    const ledger = this.ensureLedger();
    return ledger.append_batch(records);
  }

  async verify(): Promise<void> {
    const ledger = this.ensureLedger();
    ledger.verify();
  }

  async length(): Promise<number> {
    const ledger = this.ensureLedger();
    return ledger.len();
  }

  async isEmpty(): Promise<boolean> {
    const ledger = this.ensureLedger();
    return ledger.is_empty();
  }

  async latestHash(): Promise<string | null> {
    const ledger = this.ensureLedger();
    return ledger.latest_hash();
  }
}
```

**4. Maak http.ts (`packages/nucleus/src/backend/http.ts`):**

```typescript
import type { Backend } from './interface';
import type {
  Record,
  QueryFilters,
  QueryResult,
  HttpBackendConfig,
} from '../types';

/**
 * HTTP backend implementation (placeholder for future implementation)
 */
export class HttpBackend implements Backend {
  private config: HttpBackendConfig;

  constructor(config: HttpBackendConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    // TODO: Implement HTTP backend initialization
    throw new Error('HTTP backend not yet implemented');
  }

  async append(record: Record): Promise<string> {
    // TODO: Implement HTTP append
    throw new Error('HTTP backend not yet implemented');
  }

  async get(hash: string): Promise<Record | null> {
    // TODO: Implement HTTP get
    throw new Error('HTTP backend not yet implemented');
  }

  async getById(id: string): Promise<Record | null> {
    // TODO: Implement HTTP getById
    throw new Error('HTTP backend not yet implemented');
  }

  async query(filters: QueryFilters): Promise<QueryResult> {
    // TODO: Implement HTTP query
    throw new Error('HTTP backend not yet implemented');
  }

  async appendBatch(records: Record[]): Promise<string[]> {
    // TODO: Implement HTTP appendBatch
    throw new Error('HTTP backend not yet implemented');
  }

  async verify(): Promise<void> {
    // TODO: Implement HTTP verify
    throw new Error('HTTP backend not yet implemented');
  }

  async length(): Promise<number> {
    // TODO: Implement HTTP length
    throw new Error('HTTP backend not yet implemented');
  }

  async isEmpty(): Promise<boolean> {
    // TODO: Implement HTTP isEmpty
    throw new Error('HTTP backend not yet implemented');
  }

  async latestHash(): Promise<string | null> {
    // TODO: Implement HTTP latestHash
    throw new Error('HTTP backend not yet implemented');
  }
}
```

**5. Maak index.ts (`packages/nucleus/src/backend/index.ts`):**

```typescript
export * from './interface';
export * from './wasm';
export * from './http';

import type { BackendConfig } from '../types';
import { WasmBackend } from './wasm';
import { HttpBackend } from './http';
import type { Backend } from './interface';

/**
 * Create a backend instance from configuration
 */
export function createBackend(config: BackendConfig): Backend {
  switch (config.mode) {
    case 'wasm':
      return new WasmBackend(config);
    case 'http':
      return new HttpBackend(config);
    default:
      throw new Error(`Unknown backend mode: ${(config as any).mode}`);
  }
}
```

**6. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Backend interface is gedefinieerd
- ✅ WASM backend is geïmplementeerd
- ✅ HTTP backend placeholder bestaat
- ✅ Code compileert

---

### Stap 4.2.2: Backend Factory

#### Waarom

De backend factory creëert en configureert de juiste backend op basis van configuratie. Dit maakt het mogelijk om backends te wisselen zonder code te wijzigen.

#### Wat

- Implementeer backend factory
- Integreer WASM initialization
- Schrijf factory tests

#### Waar

```
packages/nucleus/src/
└── backend/
    └── factory.ts           # Backend factory
```

#### Hoe

**1. Maak factory.ts (`packages/nucleus/src/backend/factory.ts`):**

```typescript
import type { BackendConfig } from '../types';
import { createBackend, type Backend } from './index';
import type { WasmBackend } from './wasm';
import type { WasmLedger } from '@onoal/nucleus-wasm';
import type { LedgerConfig } from '../types';

/**
 * Create and initialize a backend
 */
export async function createAndInitBackend(
  config: BackendConfig,
  ledgerConfig: LedgerConfig
): Promise<Backend> {
  const backend = createBackend(config);

  await backend.init();

  // If WASM backend, create and set ledger
  if (config.mode === 'wasm') {
    const wasmModule = await import('@onoal/nucleus-wasm');
    const wasmLedger = new wasmModule.WasmLedger({
      id: ledgerConfig.id,
      modules: ledgerConfig.modules.map((m) => ({
        id: m.id,
        version: m.version,
        config: m.config,
      })),
      options: ledgerConfig.options,
    });

    (backend as WasmBackend).setLedger(wasmLedger);
  }

  return backend;
}
```

**2. Update backend/index.ts:**

```typescript
export * from './factory';
```

**3. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Backend factory werkt
- ✅ WASM backend wordt correct geïnitialiseerd
- ✅ Code compileert

---

## Stap 4.3: Ledger Implementation

### Stap 4.3.1: Ledger Class

#### Waarom

De Ledger class is de hoofdinterface die developers gebruiken. Het wrapt de backend en biedt een clean, type-safe API.

#### Wat

- Implementeer Ledger class
- Implementeer alle Ledger interface methods
- Schrijf unit tests

#### Waar

```
packages/nucleus/src/
└── ledger.ts                # Ledger class
```

#### Hoe

**1. Maak ledger.ts (`packages/nucleus/src/ledger.ts`):**

```typescript
import type { Ledger as ILedger, Record, QueryFilters, QueryResult } from './types';
import type { Backend } from './backend';

/**
 * Ledger implementation
 */
export class Ledger implements ILedger {
  public readonly id: string;
  private backend: Backend;

  constructor(id: string, backend: Backend) {
    this.id = id;
    this.backend = backend;
  }

  async append(record: Record): Promise<string> {
    return this.backend.append(record);
  }

  async get(hash: string): Promise<Record | null> {
    return this.backend.get(hash);
  }

  async getById(id: string): Promise<Record | null> {
    return this.backend.getById(id);
  }

  async query(filters: QueryFilters): Promise<QueryResult> {
    return this.backend.query(filters);
  }

  async appendBatch(records: Record[]): Promise<string[]> {
    return this.backend.appendBatch(records);
  }

  async verify(): Promise<void> {
    return this.backend.verify();
  }

  async length(): Promise<number> {
    return this.backend.length();
  }

  async isEmpty(): Promise<boolean> {
    return this.backend.isEmpty();
  }

  async latestHash(): Promise<string | null> {
    return this.backend.latestHash();
  }
}
```

**2. Update types/ledger.ts om Ledger class te exporteren:**

```typescript
// ... bestaande types ...

/**
 * Ledger class (implementation)
 */
export { Ledger } from '../ledger';
```

**3. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Ledger class is geïmplementeerd
- ✅ Alle interface methods zijn geïmplementeerd
- ✅ Code compileert

---

### Stap 4.3.2: Ledger Factory

#### Waarom

De factory functie maakt het mogelijk om ledgers te creëren met een simpele API. Het handelt alle initialisatie af en geeft een ready-to-use ledger terug.

#### Wat

- Implementeer `createLedger()` factory functie
- Integreer backend creation
- Schrijf factory tests

#### Waar

```
packages/nucleus/src/
└── factory.ts                # Factory functie
```

#### Hoe

**1. Maak factory.ts (`packages/nucleus/src/factory.ts`):**

```typescript
import type { LedgerConfig } from './types';
import { Ledger } from './ledger';
import { createAndInitBackend } from './backend';

/**
 * Create a new ledger instance
 *
 * @example
 * ```typescript
 * const ledger = await createLedger({
 *   id: 'my-ledger',
 *   backend: { mode: 'wasm' },
 *   modules: [
 *     proofModule(),
 *     assetModule({ name: 'tickets' })
 *   ]
 * });
 * ```
 */
export async function createLedger(config: LedgerConfig): Promise<Ledger> {
  // Validate config
  if (!config.id || config.id.trim().length === 0) {
    throw new Error('Ledger ID is required');
  }

  if (!config.modules || config.modules.length === 0) {
    throw new Error('At least one module is required');
  }

  // Create and initialize backend
  const backend = await createAndInitBackend(config.backend, config);

  // Create ledger instance
  return new Ledger(config.id, backend);
}
```

**2. Update index.ts:**

```typescript
export { createLedger } from './factory';
```

**3. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Factory functie werkt
- ✅ Configuratie validatie werkt
- ✅ Ledger wordt correct gecreëerd
- ✅ Code compileert

---

## Stap 4.4: Module Helpers

### Stap 4.4.1: Module Factory Functions

#### Waarom

Module factory functions maken het eenvoudig om modules te configureren. Ze bieden een type-safe, builder-style API.

#### Wat

- Implementeer `proofModule()` factory
- Implementeer `assetModule()` factory
- Schrijf module tests

#### Waar

```
packages/nucleus/src/
└── modules/
    ├── index.ts             # Module exports
    ├── proof.ts              # Proof module factory
    └── asset.ts              # Asset module factory
```

#### Hoe

**1. Maak modules directory:**

```bash
mkdir -p packages/nucleus/src/modules
```

**2. Maak proof.ts (`packages/nucleus/src/modules/proof.ts`):**

```typescript
import type { ModuleConfig, ProofModuleConfig } from '../types';

/**
 * Create a proof module configuration
 *
 * @example
 * ```typescript
 * const module = proofModule({
 *   strategies: ['ownership', 'timestamp']
 * });
 * ```
 */
export function proofModule(
  config?: ProofModuleConfig
): ModuleConfig {
  return {
    id: 'proof',
    version: '1.0.0',
    config: {
      strategies: config?.strategies || ['ownership'],
      ...config,
    },
  };
}
```

**3. Maak asset.ts (`packages/nucleus/src/modules/asset.ts`):**

```typescript
import type { ModuleConfig, AssetModuleConfig } from '../types';

/**
 * Create an asset module configuration
 *
 * @example
 * ```typescript
 * const module = assetModule({
 *   name: 'tickets',
 *   indexBy: ['owner', 'eventId']
 * });
 * ```
 */
export function assetModule(
  config: AssetModuleConfig
): ModuleConfig {
  if (!config.name) {
    throw new Error('Asset module requires a name');
  }

  return {
    id: 'asset',
    version: '1.0.0',
    config: {
      name: config.name,
      schema: config.schema,
      indexBy: config.indexBy || [],
      ...config,
    },
  };
}
```

**4. Maak index.ts (`packages/nucleus/src/modules/index.ts`):**

```typescript
export { proofModule } from './proof';
export { assetModule } from './asset';
```

**5. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Module factory functions werken
- ✅ Type-safe configuratie
- ✅ Code compileert

---

### Stap 4.4.2: Module Validation

#### Waarom

Module configuraties moeten gevalideerd worden om errors vroeg te detecteren.

#### Wat

- Implementeer module validatie
- Valideer required fields
- Schrijf validatie tests

#### Waar

```
packages/nucleus/src/
└── modules/
    └── validation.ts         # Module validatie
```

#### Hoe

**1. Maak validation.ts (`packages/nucleus/src/modules/validation.ts`):**

```typescript
import type { ModuleConfig } from '../types';

/**
 * Validate module configuration
 */
export function validateModule(module: ModuleConfig): void {
  if (!module.id || module.id.trim().length === 0) {
    throw new Error('Module ID is required');
  }

  if (!module.version || module.version.trim().length === 0) {
    throw new Error('Module version is required');
  }

  if (typeof module.config !== 'object' || module.config === null) {
    throw new Error('Module config must be an object');
  }
}

/**
 * Validate all modules
 */
export function validateModules(modules: ModuleConfig[]): void {
  if (modules.length === 0) {
    throw new Error('At least one module is required');
  }

  const moduleIds = new Set<string>();
  for (const module of modules) {
    validateModule(module);

    if (moduleIds.has(module.id)) {
      throw new Error(`Duplicate module ID: ${module.id}`);
    }
    moduleIds.add(module.id);
  }
}
```

**2. Integreer validatie in factory.ts:**

```typescript
import { validateModules } from './modules/validation';

export async function createLedger(config: LedgerConfig): Promise<Ledger> {
  // ... bestaande validatie ...

  // Validate modules
  validateModules(config.modules);

  // ... rest van implementatie ...
}
```

**3. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Module validatie werkt
- ✅ Duplicate detection werkt
- ✅ Code compileert

---

## Stap 4.5: Nucleus Class (Builder API)

### Stap 4.5.1: Nucleus Static Class

#### Waarom

De Nucleus class biedt een builder-style API die developers een prettige DX geeft. Het is de main entry point voor het framework.

#### Wat

- Implementeer Nucleus static class
- Implementeer `createLedger()` method
- Schrijf builder tests

#### Waar

```
packages/nucleus/src/
└── nucleus.ts                # Nucleus class
```

#### Hoe

**1. Maak nucleus.ts (`packages/nucleus/src/nucleus.ts`):**

```typescript
import type { LedgerConfig, Ledger } from './types';
import { createLedger as createLedgerImpl } from './factory';

/**
 * Nucleus - Main entry point for the framework
 *
 * @example
 * ```typescript
 * import { Nucleus } from '@onoal/nucleus';
 *
 * const ledger = await Nucleus.createLedger({
 *   id: 'my-ledger',
 *   backend: { mode: 'wasm' },
 *   modules: [proofModule()]
 * });
 * ```
 */
export class Nucleus {
  /**
   * Create a new ledger instance
   */
  static async createLedger(config: LedgerConfig): Promise<Ledger> {
    return createLedgerImpl(config);
  }
}
```

**2. Update index.ts:**

```typescript
export { Nucleus } from './nucleus';
```

**3. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Nucleus class werkt
- ✅ Static method werkt
- ✅ Code compileert

---

### Stap 4.5.2: Builder Pattern (Optional)

#### Waarom

Een builder pattern maakt het mogelijk om ledgers stap voor stap te configureren. Dit is optioneel maar kan de DX verbeteren.

#### Wat

- Implementeer LedgerBuilder class
- Implementeer fluent API
- Schrijf builder tests

#### Waar

```
packages/nucleus/src/
└── builder.ts                # Builder class
```

#### Hoe

**1. Maak builder.ts (`packages/nucleus/src/builder.ts`):**

```typescript
import type { LedgerConfig, BackendConfig, ModuleConfig, LedgerOptions } from './types';
import { createLedger } from './factory';
import type { Ledger } from './types';

/**
 * Ledger builder for fluent configuration
 *
 * @example
 * ```typescript
 * const ledger = await new LedgerBuilder('my-ledger')
 *   .withBackend({ mode: 'wasm' })
 *   .addModule(proofModule())
 *   .withOptions({ strictValidation: true })
 *   .build();
 * ```
 */
export class LedgerBuilder {
  private config: Partial<LedgerConfig>;

  constructor(id: string) {
    this.config = { id };
  }

  /**
   * Set backend configuration
   */
  withBackend(backend: BackendConfig): this {
    this.config.backend = backend;
    return this;
  }

  /**
   * Add a module
   */
  addModule(module: ModuleConfig): this {
    if (!this.config.modules) {
      this.config.modules = [];
    }
    this.config.modules.push(module);
    return this;
  }

  /**
   * Set modules
   */
  withModules(modules: ModuleConfig[]): this {
    this.config.modules = modules;
    return this;
  }

  /**
   * Set options
   */
  withOptions(options: LedgerOptions): this {
    this.config.options = options;
    return this;
  }

  /**
   * Build the ledger
   */
  async build(): Promise<Ledger> {
    if (!this.config.id) {
      throw new Error('Ledger ID is required');
    }

    if (!this.config.backend) {
      throw new Error('Backend configuration is required');
    }

    if (!this.config.modules || this.config.modules.length === 0) {
      throw new Error('At least one module is required');
    }

    return createLedger(this.config as LedgerConfig);
  }
}
```

**2. Update nucleus.ts om builder te exporteren:**

```typescript
import { LedgerBuilder } from './builder';

export class Nucleus {
  // ... bestaande methods ...

  /**
   * Create a ledger builder
   */
  static builder(id: string): LedgerBuilder {
    return new LedgerBuilder(id);
  }
}
```

**3. Update index.ts:**

```typescript
export { LedgerBuilder } from './builder';
```

**4. Verifieer:**

```bash
npm run typecheck
```

**Acceptatie Criteria:**

- ✅ Builder class werkt
- ✅ Fluent API werkt
- ✅ Code compileert

---

## Stap 4.6: Tests & Documentation

### Stap 4.6.1: Unit Tests

#### Waarom

Unit tests verifiëren dat alle functionaliteit correct werkt en voorkomen regressies.

#### Wat

- Setup Jest test framework
- Schrijf tests voor alle components
- Test error scenarios

#### Waar

```
packages/nucleus/
├── jest.config.js           # Jest configuratie
└── src/
    └── **/*.test.ts         # Test files
```

#### Hoe

**1. Maak jest.config.js (`packages/nucleus/jest.config.js`):**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
};
```

**2. Maak test voor factory (`packages/nucleus/src/factory.test.ts`):**

```typescript
import { createLedger } from './factory';
import { proofModule } from './modules';

describe('createLedger', () => {
  it('should create a ledger with valid config', async () => {
    const ledger = await createLedger({
      id: 'test-ledger',
      backend: { mode: 'wasm' },
      modules: [proofModule()],
    });

    expect(ledger.id).toBe('test-ledger');
    expect(await ledger.isEmpty()).toBe(true);
  });

  it('should throw error for empty ID', async () => {
    await expect(
      createLedger({
        id: '',
        backend: { mode: 'wasm' },
        modules: [proofModule()],
      })
    ).rejects.toThrow('Ledger ID is required');
  });

  it('should throw error for no modules', async () => {
    await expect(
      createLedger({
        id: 'test-ledger',
        backend: { mode: 'wasm' },
        modules: [],
      })
    ).rejects.toThrow('At least one module is required');
  });
});
```

**3. Maak test voor modules (`packages/nucleus/src/modules/proof.test.ts`):**

```typescript
import { proofModule } from './proof';

describe('proofModule', () => {
  it('should create proof module with default config', () => {
    const module = proofModule();

    expect(module.id).toBe('proof');
    expect(module.version).toBe('1.0.0');
    expect(module.config.strategies).toEqual(['ownership']);
  });

  it('should create proof module with custom config', () => {
    const module = proofModule({
      strategies: ['ownership', 'timestamp'],
    });

    expect(module.config.strategies).toEqual(['ownership', 'timestamp']);
  });
});
```

**4. Run tests:**

```bash
npm test
```

**Acceptatie Criteria:**

- ✅ Jest is geconfigureerd
- ✅ Tests kunnen draaien
- ✅ Alle tests passen

---

### Stap 4.6.2: Integration Tests

#### Waarom

Integration tests verifiëren dat alle componenten samenwerken en dat de complete API werkt.

#### Wat

- Schrijf integration tests
- Test complete workflows
- Test error scenarios

#### Waar

```
packages/nucleus/src/
└── __tests__/
    └── integration.test.ts   # Integration tests
```

#### Hoe

**1. Maak integration test (`packages/nucleus/src/__tests__/integration.test.ts`):**

```typescript
import { Nucleus } from '../nucleus';
import { proofModule, assetModule } from '../modules';

describe('Nucleus Integration', () => {
  it('should create and use a ledger', async () => {
    const ledger = await Nucleus.createLedger({
      id: 'test-ledger',
      backend: { mode: 'wasm' },
      modules: [proofModule(), assetModule({ name: 'tickets' })],
    });

    // Append record
    const hash = await ledger.append({
      id: 'record-1',
      stream: 'proofs',
      timestamp: Date.now(),
      payload: {
        type: 'proof',
        subject_oid: 'oid:onoal:human:alice',
        issuer_oid: 'oid:onoal:org:example',
      },
    });

    expect(hash).toBeTruthy();

    // Get record
    const record = await ledger.get(hash);
    expect(record).toBeTruthy();
    expect(record?.id).toBe('record-1');

    // Query
    const result = await ledger.query({ stream: 'proofs' });
    expect(result.total).toBe(1);
    expect(result.records.length).toBe(1);

    // Verify
    await ledger.verify();
  });

  it('should use builder pattern', async () => {
    const ledger = await Nucleus.builder('test-ledger')
      .withBackend({ mode: 'wasm' })
      .addModule(proofModule())
      .addModule(assetModule({ name: 'tickets' }))
      .withOptions({ strictValidation: true })
      .build();

    expect(ledger.id).toBe('test-ledger');
  });
});
```

**2. Run integration tests:**

```bash
npm test -- integration
```

**Acceptatie Criteria:**

- ✅ Integration tests passen
- ✅ Complete workflows werken
- ✅ Error scenarios worden getest

---

### Stap 4.6.3: Documentation

#### Waarom

Goede documentatie is cruciaal voor developer adoption. Het moet duidelijk zijn hoe de API gebruikt wordt.

#### Wat

- Schrijf README met examples
- Document alle API methods
- Maak usage examples

#### Waar

```
packages/nucleus/
├── README.md                 # Main documentation
└── examples/
    └── basic-usage.ts        # Usage example
```

#### Hoe

**1. Maak README.md (`packages/nucleus/README.md`):**

```markdown
# @onoal/nucleus

TypeScript DX Layer for Nucleus Engine - Build custom ledgers with a developer-friendly API.

## Installation

```bash
npm install @onoal/nucleus @onoal/nucleus-wasm
```

## Quick Start

```typescript
import { Nucleus, proofModule, assetModule } from '@onoal/nucleus';

// Create a ledger
const ledger = await Nucleus.createLedger({
  id: 'my-ledger',
  backend: { mode: 'wasm' },
  modules: [
    proofModule(),
    assetModule({ name: 'tickets' })
  ]
});

// Append a record
const hash = await ledger.append({
  id: 'record-1',
  stream: 'proofs',
  timestamp: Date.now(),
  payload: {
    type: 'proof',
    subject_oid: 'oid:onoal:human:alice',
    issuer_oid: 'oid:onoal:org:example'
  }
});

// Query records
const result = await ledger.query({ stream: 'proofs' });
console.log(`Found ${result.total} records`);

// Verify chain
await ledger.verify();
```

## Builder Pattern

```typescript
const ledger = await Nucleus.builder('my-ledger')
  .withBackend({ mode: 'wasm' })
  .addModule(proofModule())
  .addModule(assetModule({ name: 'tickets' }))
  .withOptions({ strictValidation: true })
  .build();
```

## API Reference

### `Nucleus.createLedger(config)`

Create a new ledger instance.

### `Nucleus.builder(id)`

Create a ledger builder for fluent configuration.

### `ledger.append(record)`

Append a record to the ledger.

### `ledger.query(filters)`

Query records with filters.

### `ledger.verify()`

Verify chain integrity.

## Modules

### `proofModule(config?)`

Create a proof module configuration.

### `assetModule(config)`

Create an asset module configuration.

## License

MIT
```

**2. Maak example (`packages/nucleus/examples/basic-usage.ts`):**

```typescript
import { Nucleus, proofModule, assetModule } from '@onoal/nucleus';

async function main() {
  // Create ledger
  const ledger = await Nucleus.createLedger({
    id: 'example-ledger',
    backend: { mode: 'wasm' },
    modules: [
      proofModule(),
      assetModule({ name: 'tickets', indexBy: ['owner', 'eventId'] }),
    ],
  });

  // Append proof
  const proofHash = await ledger.append({
    id: 'proof-1',
    stream: 'proofs',
    timestamp: Date.now(),
    payload: {
      type: 'proof',
      subject_oid: 'oid:onoal:human:alice',
      issuer_oid: 'oid:onoal:org:example',
    },
  });

  console.log('Proof hash:', proofHash);

  // Append asset
  const assetHash = await ledger.append({
    id: 'ticket-1',
    stream: 'assets',
    timestamp: Date.now(),
    payload: {
      type: 'ticket',
      owner: 'oid:onoal:human:alice',
      eventId: 'event-amsterdam',
    },
  });

  console.log('Asset hash:', assetHash);

  // Query
  const proofs = await ledger.query({ stream: 'proofs' });
  console.log(`Found ${proofs.total} proofs`);

  // Verify
  await ledger.verify();
  console.log('Chain verified!');
}

main().catch(console.error);
```

**3. Verifieer documentatie:**

```bash
# Check README formatting
npm run lint
```

**Acceptatie Criteria:**

- ✅ README is compleet
- ✅ Examples werken
- ✅ API is gedocumenteerd

---

## Fase 4 Samenvatting

### Voltooide Componenten

✅ **TypeScript Project Setup**

- Package structuur
- TypeScript configuratie
- Build tools

✅ **Type Definitions**

- Complete type system
- Type-safe API
- Module types

✅ **Backend Abstraction**

- Backend interface
- WASM backend
- HTTP backend placeholder

✅ **Ledger Implementation**

- Ledger class
- Factory functie
- Complete API

✅ **Module Helpers**

- Module factory functions
- Module validatie
- Type-safe configuratie

✅ **Builder API**

- Nucleus class
- Builder pattern
- Fluent API

✅ **Tests & Documentation**

- Unit tests
- Integration tests
- Complete documentation

### Volgende Stappen

Na voltooiing van Fase 4 kunnen we doorgaan naar:

- **Fase 5: Testing & Docs** - Comprehensive testing en documentatie
- **nucleus-server** - HTTP server implementatie (optioneel)

---

*Gedetailleerd Plan voor Fase 4: @onoal/nucleus - TypeScript DX Layer*

