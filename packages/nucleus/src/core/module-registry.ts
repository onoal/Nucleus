/**
 * Global module registry (singleton pattern for v0.1.0-beta)
 * 
 * Simple, developer-friendly approach for single-instance use cases.
 * Can be refactored to dependency injection for multi-tenant scenarios later.
 */

import { ModuleRuntime, ModuleNotFoundError } from "../types/index.js";

/**
 * Internal registry (singleton)
 */
const globalModules = new Map<string, ModuleRuntime>();

/**
 * Register a module globally
 * 
 * @param name Module name (e.g., "proof", "oid")
 * @param runtime Module runtime implementation
 * @throws Error if module name is invalid or already registered
 * 
 * @example
 * ```typescript
 * registerModule('oid', oidModule);
 * registerModule('proof', proofModule);
 * ```
 */
export function registerModule(name: string, runtime: ModuleRuntime): void {
  if (!name || typeof name !== "string") {
    throw new Error("Module name must be a non-empty string");
  }

  if (globalModules.has(name)) {
    throw new Error(`Module already registered: ${name}`);
  }

  globalModules.set(name, runtime);
}

/**
 * Get a registered module
 * 
 * @param name Module name
 * @returns Module runtime
 * @throws ModuleNotFoundError if module is not registered
 * 
 * @example
 * ```typescript
 * const oidModule = getModule('oid');
 * ```
 */
export function getModule(name: string): ModuleRuntime {
  const module = globalModules.get(name);

  if (!module) {
    throw new ModuleNotFoundError(name);
  }

  return module;
}

/**
 * Check if a module is registered
 * 
 * @param name Module name
 * @returns True if module is registered
 */
export function hasModule(name: string): boolean {
  return globalModules.has(name);
}

/**
 * Clear all registered modules (for testing)
 * 
 * @internal
 */
export function clearModules(): void {
  globalModules.clear();
}

/**
 * Get all registered module names
 * 
 * @returns Array of module names
 */
export function getRegisteredModules(): string[] {
  return Array.from(globalModules.keys());
}

