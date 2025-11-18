/**
 * Storage configuration helpers
 */

import type { StorageConfig } from "../types";

/**
 * Create in-memory storage configuration (default)
 *
 * Use this for:
 * - Development and testing
 * - Browser/WASM environments (only option)
 * - Temporary ledgers that don't need persistence
 *
 * @returns In-memory storage configuration
 *
 * @example
 * ```ts
 * import { createLedger, inMemoryStorage } from "@onoal/nucleus";
 *
 * const ledger = await createLedger({
 *   id: "my-ledger",
 *   backend: { mode: "wasm" },
 *   modules: [],
 *   storage: inMemoryStorage(), // Explicit in-memory
 * });
 * ```
 */
export function inMemoryStorage(): StorageConfig {
  return { type: "none" };
}

/**
 * Create SQLite storage configuration
 *
 * **Important**: Only works on native Node.js with Rust backend.
 * Not supported in browser/WASM environments.
 *
 * Use this for:
 * - Server-side applications
 * - Desktop applications (Electron, Tauri)
 * - CLI tools
 * - Local development with persistence
 *
 * @param path - Path to SQLite database file (e.g., "./ledger.db")
 * @returns SQLite storage configuration
 *
 * @example
 * ```ts
 * import { createLedger, sqliteStorage } from "@onoal/nucleus";
 *
 * const ledger = await createLedger({
 *   id: "my-ledger",
 *   backend: { mode: "wasm" }, // Note: Will fall back to in-memory in browser
 *   modules: [],
 *   storage: sqliteStorage("./data/ledger.db"),
 * });
 *
 * // Check if storage is actually enabled
 * if (await ledger.hasStorage()) {
 *   console.log("SQLite storage is active");
 *
 *   // Verify storage integrity
 *   const isValid = await ledger.verifyStorage();
 *   console.log("Storage integrity:", isValid ? "OK" : "FAILED");
 * } else {
 *   console.warn("Storage not supported, using in-memory mode");
 * }
 * ```
 */
export function sqliteStorage(path: string): StorageConfig {
  if (!path || path.trim() === "") {
    throw new Error("SQLite storage path cannot be empty");
  }
  return { type: "sqlite", path };
}

/**
 * Create PostgreSQL storage configuration (future feature)
 *
 * **Important**: Not yet implemented. Will throw an error if used.
 * Only works on native Node.js with Rust backend.
 *
 * @param connectionString - PostgreSQL connection string
 * @returns PostgreSQL storage configuration
 *
 * @example
 * ```ts
 * import { createLedger, postgresStorage } from "@onoal/nucleus";
 *
 * const ledger = await createLedger({
 *   id: "my-ledger",
 *   backend: { mode: "wasm" },
 *   modules: [],
 *   storage: postgresStorage("postgresql://user:pass@localhost/db"),
 * });
 * ```
 */
export function postgresStorage(connectionString: string): StorageConfig {
  if (!connectionString || connectionString.trim() === "") {
    throw new Error("PostgreSQL connection string cannot be empty");
  }
  return { type: "postgres", connectionString };
}

/**
 * Detect environment and recommend storage configuration
 *
 * Automatically selects the appropriate storage based on environment:
 * - Browser/WASM: In-memory only
 * - Node.js: SQLite with provided path
 *
 * @param sqlitePath - Path for SQLite database if running in Node.js (optional)
 * @returns Recommended storage configuration for current environment
 *
 * @example
 * ```ts
 * import { createLedger, autoStorage } from "@onoal/nucleus";
 *
 * const ledger = await createLedger({
 *   id: "my-ledger",
 *   backend: { mode: "wasm" },
 *   modules: [],
 *   storage: autoStorage("./ledger.db"), // Auto-detects environment
 * });
 * ```
 */
export function autoStorage(sqlitePath?: string): StorageConfig {
  // Check if running in Node.js (has process.versions.node)
  const isNode =
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null;

  if (isNode && sqlitePath) {
    return sqliteStorage(sqlitePath);
  }

  return inMemoryStorage();
}
