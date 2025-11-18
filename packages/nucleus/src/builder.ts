import type {
  LedgerConfig,
  BackendConfig,
  ModuleConfig,
  LedgerOptions,
} from "./types";
import { createLedger } from "./factory";
import type { Ledger } from "./types";

/**
 * Ledger Builder - Fluent API for constructing ledger configurations
 */
export class LedgerBuilder {
  private id: string;
  private backend: BackendConfig | null = null;
  private modules: ModuleConfig[] = [];
  private options: LedgerOptions = {};

  /**
   * Create a new ledger builder
   */
  constructor(id: string) {
    this.id = id;
  }

  /**
   * Set WASM backend
   */
  withWasmBackend(wasmPath?: string): this {
    this.backend = {
      mode: "wasm",
      wasmPath,
    };
    return this;
  }

  /**
   * Set HTTP backend
   */
  withHttpBackend(url: string, token?: string): this {
    this.backend = {
      mode: "http",
      url,
      token,
    };
    return this;
  }

  /**
   * Add a module
   */
  withModule(module: ModuleConfig): this {
    this.modules.push(module);
    return this;
  }

  /**
   * Add multiple modules
   */
  withModules(modules: ModuleConfig[]): this {
    this.modules.push(...modules);
    return this;
  }

  /**
   * Set ledger options
   */
  withOptions(options: LedgerOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Enable strict validation
   */
  withStrictValidation(strict: boolean = true): this {
    this.options.strictValidation = strict;
    return this;
  }

  /**
   * Set maximum entries
   */
  withMaxEntries(maxEntries: number): this {
    this.options.maxEntries = maxEntries;
    return this;
  }

  /**
   * Enable metrics
   */
  withMetrics(enabled: boolean = true): this {
    this.options.enableMetrics = enabled;
    return this;
  }

  /**
   * Build the ledger configuration
   */
  buildConfig(): LedgerConfig {
    if (!this.backend) {
      throw new Error(
        "Backend must be configured. Use withWasmBackend() or withHttpBackend()"
      );
    }

    return {
      id: this.id,
      backend: this.backend,
      modules: this.modules,
      options: Object.keys(this.options).length > 0 ? this.options : undefined,
    };
  }

  /**
   * Build and create the ledger instance
   */
  async build(): Promise<Ledger> {
    const config = this.buildConfig();
    return createLedger(config);
  }
}

/**
 * Create a new ledger builder
 */
export function ledgerBuilder(id: string): LedgerBuilder {
  return new LedgerBuilder(id);
}
