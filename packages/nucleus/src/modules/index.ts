import type {
  ModuleConfig,
  AssetModuleConfig,
  ProofModuleConfig,
} from "../types";

/**
 * Create a proof module configuration
 */
export function proofModule(config?: ProofModuleConfig): ModuleConfig {
  return {
    id: "proof",
    version: "1.0.0",
    config: config || {},
  };
}

/**
 * Create an asset module configuration
 */
export function assetModule(config?: AssetModuleConfig): ModuleConfig {
  return {
    id: "asset",
    version: "1.0.0",
    config: config || {},
  };
}
