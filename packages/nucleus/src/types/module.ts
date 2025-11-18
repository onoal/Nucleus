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
  name?: string;

  /**
   * Schema definition (optional)
   */
  schema?: Record<string, unknown>;

  /**
   * Fields to index by
   */
  indexBy?: string[];

  /**
   * Allow additional properties
   */
  [key: string]: unknown;
}

/**
 * Proof module configuration
 */
export interface ProofModuleConfig {
  /**
   * Proof strategies
   */
  strategies?: string[];

  /**
   * Allow additional properties
   */
  [key: string]: unknown;
}
