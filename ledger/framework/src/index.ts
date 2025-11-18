/**
 * @onoal/ledger-core
 *
 * Core ledger engine for building custom Onoal ledgers
 *
 * @packageDocumentation
 */

export { createLedger } from "./core/ledger";
export { ServiceContainer } from "./core/service-container";
export { createLedgerServer } from "./server/index.js";
export { coreRoutesModule } from "./core/core-routes.js";
export type {
  OnoalLedger,
  OnoalLedgerConfig,
  OnoalLedgerModule,
  OnoalLedgerPlugin,
  LedgerDatabase,
  LedgerConnector,
  DatabaseProvider,
  DatabaseByProvider,
  SchemaDefinition,
  InferSchemaType,
  CustomModuleOptions,
  LedgerRoute as LedgerModuleRoute,
  LedgerRouteHandler,
  LedgerServices,
  ModuleSchema,
  SchemaField,
  LedgerHooks,
} from "./core/types";
export { createCustomModule } from "./core/types";

// Re-export type utilities from @onoal/core
export type {
  ServiceTypeRegistry,
  InferServiceType,
  ExtractServiceTypes,
  GetServiceType,
  ExtractParams,
  TypedRoute,
} from "@onoal/core";

// Re-export error types and utilities from @onoal/core
export {
  OnoalError,
  ModuleError,
  ServiceError,
  SchemaError,
  RouteError,
  DatabaseError,
  HookError,
  ErrorCodes,
  formatError,
  formatErrorAsJSON,
  formatErrorAsString,
  isOnoalError,
  type FormattedError,
} from "@onoal/core";
export { adaptModuleToLedger } from "./core/ledger-module-adapter.js";

// Export testing utilities
export {
  createTestLedger,
  createTestServer,
  mockService,
  waitForHook,
  testEntries,
  testOids,
  createTestEntry,
  seedTestData,
} from "./testing/index.js";
export type { TestLedgerOptions } from "./testing/index.js";
export type { TestServer } from "@onoal/core/testing";
export type { LedgerServer, LedgerRoute } from "./server/index.js";

// Re-export internal types for convenience
export type {
  LedgerEntry,
  LedgerStream,
  EntryStatus,
  ProofRecord,
  AssetRecord,
  ChainVerificationResult,
} from "./core/types-internal.js";

// Export UAL interface
export type {
  UnifiedAccessLayer,
  ACLGrant,
  ResourcePredicate,
} from "./core/ual.js";

// Export Logger
export {
  Logger,
  createLogger,
  defaultLogger,
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LoggerConfig,
} from "./utils/logger.js";

// Export authentication middleware
export { createAuthMiddleware, getRequesterOid } from "./middleware/auth.js";
export type {
  RequestContext,
  AuthMiddlewareOptions,
} from "./middleware/auth.js";

// Export OID validator
export {
  parseOid,
  validateOid,
  ensureOid,
  isHierarchicalOid,
  isExternalNamespace,
  getParentOid,
  getRootOid,
  OidValidationError,
} from "./utils/oid-validator.js";
export type { ParsedOid, OidValidationOptions } from "./utils/oid-validator.js";
