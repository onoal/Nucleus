/**
 * Payment schema exports
 *
 * Unified schema export for module registration.
 * Automatically selects PostgreSQL or SQLite schema based on database provider.
 *
 * @module schema/index
 */

import { paymentSchema } from "./payments.js";
import { paymentSchemaSqlite } from "./payments-sqlite.js";

/**
 * Unified payment schema export
 *
 * This is used by the module to register schemas with the database adapter.
 * The adapter will automatically select the correct schema based on provider.
 */
export const paymentDrizzleSchema = {
  ...paymentSchema,
  ...paymentSchemaSqlite,
};

/**
 * Export individual schemas for direct access
 */
export { paymentSchema, paymentSchemaSqlite };
export * from "./payments.js";
export * from "./payments-sqlite.js";

