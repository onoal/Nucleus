/**
 * Analytics Plugin for Onoal Ledger
 *
 * Tracks usage patterns and metrics for product decisions.
 */

import type { OnoalLedgerPlugin } from "@onoal/ledger-core";

export interface AnalyticsPluginOptions {
  /**
   * Analytics provider
   * - "mixpanel": Send to Mixpanel
   * - "segment": Send to Segment
   * - "custom": Use custom handler
   */
  provider?: "mixpanel" | "segment" | "custom";

  /**
   * API key for analytics provider
   */
  apiKey?: string;

  /**
   * Events to track
   * Default: ["append", "query", "verify"]
   */
  trackEvents?: string[];

  /**
   * Anonymize user data (GDPR compliance)
   */
  anonymize?: boolean;

  /**
   * Batch size for events
   * Events are batched and sent together
   */
  batchSize?: number;

  /**
   * Flush interval in milliseconds
   * Events are flushed periodically even if batch is not full
   */
  flushInterval?: number;

  /**
   * Custom event handler (if provider is "custom")
   */
  customHandler?: (events: AnalyticsEvent[]) => Promise<void>;

  /**
   * User ID extractor function
   * Extracts user ID from ledger context
   */
  userIdExtractor?: (context: any) => string | undefined;
}

export interface AnalyticsEvent {
  /**
   * Event name
   */
  event: string;

  /**
   * Event properties
   */
  properties: Record<string, unknown>;

  /**
   * User ID (if available)
   */
  userId?: string;

  /**
   * Timestamp
   */
  timestamp?: number;
}

import { AnalyticsService } from "./service.js";
import { anonymize, anonymizeFilters } from "./anonymize.js";
import type { OnoalLedger, ChainVerificationResult } from "@onoal/ledger-core";

/**
 * Creates an analytics plugin for the ledger
 *
 * @example
 * ```typescript
 * const ledger = await createLedger({...});
 * ledger.use(analyticsPlugin({
 *   provider: "mixpanel",
 *   apiKey: process.env.MIXPANEL_API_KEY,
 *   trackEvents: ["append", "query"],
 *   anonymize: true
 * }));
 * ```
 */
export function analyticsPlugin(
  options: AnalyticsPluginOptions = {}
): OnoalLedgerPlugin {
  const analyticsService = new AnalyticsService(
    options.provider || "custom",
    options.apiKey || "",
    options.batchSize || 100,
    options.flushInterval || 5000,
    options.customHandler
  );

  const trackEvents = options.trackEvents || ["append", "query", "verify"];

  const userIdExtractor =
    options.userIdExtractor ||
    ((context: any) => {
      // Default: extract from request context or entry
      return context?.userId || context?.issuer_oid;
    });

  return {
    id: "analytics",
    version: "1.0.0",
    hooks: {
      afterAppend: async (entryWithProof, ledger) => {
        if (!trackEvents.includes("append")) return;

        const payload = entryWithProof.payload as Record<string, unknown>;
        const issuerOid = payload.issuer_oid as string | undefined;

        analyticsService.track({
          event: "ledger.append",
          properties: {
            entryId: entryWithProof.id,
            type: payload.type as string | undefined,
            issuerOid: options.anonymize
              ? anonymize(issuerOid || "anonymous")
              : issuerOid,
            stream: entryWithProof.stream,
            timestamp: entryWithProof.timestamp,
          },
          userId: options.anonymize
            ? anonymize(issuerOid || "anonymous")
            : issuerOid,
        });
      },

      afterQuery: async (result, filters, ledger) => {
        if (trackEvents.includes("query")) {
          const anonymizedFilters = options.anonymize
            ? anonymizeFilters(filters)
            : filters;

          analyticsService.track({
            event: "ledger.query",
            properties: {
              resultCount: result.entries.length,
              stream: filters.stream,
              hasMore: result.hasMore,
              filters: anonymizedFilters,
            },
            userId: options.anonymize
              ? anonymize(filters.issuer_oid || "anonymous")
              : filters.issuer_oid,
          });
        }

        return result;
      },

      afterVerifyChain: async (result, ledger) => {
        if (trackEvents.includes("verify")) {
          analyticsService.track({
            event: "ledger.verify",
            properties: {
              valid: result.valid,
              entriesChecked: result.entries_checked,
              duration: (result as any).verification_duration_ms,
              hashMismatches: (result as any).hash_mismatches ?? 0,
              signatureFailures: (result as any).signature_failures ?? 0,
              timestampIssues: (result as any).timestamp_issues ?? 0,
              payloadErrors: (result as any).payload_errors ?? 0,
            },
          });
        }

        return result;
      },
    },
  };
}
