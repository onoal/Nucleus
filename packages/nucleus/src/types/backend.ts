/**
 * Backend mode
 */
export type BackendMode = "wasm" | "http";

/**
 * WASM backend configuration
 */
export interface WasmBackendConfig {
  mode: "wasm";
  /**
   * Optional WASM module path (for custom builds)
   */
  wasmPath?: string;
}

/**
 * HTTP backend configuration
 */
export interface HttpBackendConfig {
  mode: "http";
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
