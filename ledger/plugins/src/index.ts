/**
 * Plugins for Onoal Ledger
 *
 * This package provides plugins for extending ledger functionality:
 * - Audit Log: Compliance tracking and operation logging
 * - Rate Limiting: Abuse prevention
 * - Encryption: Data privacy for sensitive fields
 * - Analytics: Usage tracking and metrics
 */

// Import plugins for legacy exports
import { analyticsPlugin } from "./analytics/index.js";

// Audit Log Plugin
export { auditLogPlugin } from "./audit/index.js";
export type { AuditLogPluginOptions } from "./audit/index.js";

// Rate Limiting Plugin
export { rateLimitPlugin } from "./rate-limit/index.js";
export type {
  RateLimitPluginOptions,
  RateLimitConfig,
} from "./rate-limit/index.js";

// Encryption Plugin
export { encryptionPlugin } from "./encryption/index.js";
export type { EncryptionPluginOptions } from "./encryption/index.js";

// Analytics Plugin
export { analyticsPlugin } from "./analytics/index.js";
export type {
  AnalyticsPluginOptions,
  AnalyticsEvent,
} from "./analytics/index.js";

// Legacy exports (for backward compatibility)
export function zkPlugin(options: any) {
  // TODO: Implement ZK plugin
  throw new Error("ZK plugin not implemented yet");
}

export function createWebhookPlugin(options: any) {
  // TODO: Implement webhook plugin
  throw new Error("Webhook plugin not implemented yet");
}

export function createAnalyticsPlugin(options: any) {
  // Use new analyticsPlugin instead
  return analyticsPlugin(options);
}
