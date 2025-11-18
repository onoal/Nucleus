/**
 * Audit Log Plugin for Onoal Ledger
 *
 * Logs all ledger operations for compliance and debugging.
 */

import type { OnoalLedgerPlugin } from "@onoal/ledger-core";

export interface AuditLogPluginOptions {
  /**
   * Log level filter
   * - "all": Log all operations
   * - "errors": Log only errors
   * - "operations": Log only operations (no errors)
   */
  logLevel?: "all" | "errors" | "operations";

  /**
   * Storage backend for audit logs
   * - "database": Store in database table
   * - "file": Write to file system (JSONL format)
   * - "external": Send to external service (webhook, API)
   */
  storage?: "database" | "file" | "external";

  /**
   * Retention period for audit logs
   * Format: "90d" (90 days), "1y" (1 year), etc.
   */
  retention?: string;

  /**
   * Fields to exclude from audit logs (for privacy)
   */
  excludeFields?: string[];

  /**
   * Include metadata in audit logs
   */
  includeMetadata?: boolean;

  /**
   * Retry failed log writes
   */
  retryOnFailure?: boolean;

  /**
   * External service URL (if storage is "external")
   */
  externalUrl?: string;
}

import { AuditLogService } from "./service.js";
import type { OnoalLedger, LedgerEntry } from "@onoal/ledger-core";

/**
 * Creates an audit log plugin for the ledger
 *
 * @example
 * ```typescript
 * const ledger = await createLedger({...});
 * ledger.use(auditLogPlugin({
 *   storage: "database",
 *   logLevel: "all",
 *   retention: "90d"
 * }));
 * ```
 */
export function auditLogPlugin(
  options: AuditLogPluginOptions = {}
): OnoalLedgerPlugin {
  // Service will be initialized when hooks are called
  let service: AuditLogService | null = null;

  const getService = (ledger: OnoalLedger): AuditLogService => {
    if (!service) {
      const db = ledger.hasService("database")
        ? (ledger.getService<{ db: any }>("database") as any)
        : null;
      service = new AuditLogService(db, options);
    }
    return service;
  };

  return {
    id: "audit-log",
    version: "1.0.0",
    hooks: {
      beforeAppend: async (entry, ledger) => {
        const auditService = getService(ledger);
        const requestId = crypto.randomUUID();
        const startTime = Date.now();

        // Store context for afterAppend
        (ledger as any)._auditContext = {
          requestId,
          startTime,
          operation: "append",
        };
      },

      afterAppend: async (entryWithProof, ledger) => {
        const auditService = getService(ledger);
        const context = (ledger as any)._auditContext || {};
        const duration = Date.now() - (context.startTime || Date.now());

        const payload = entryWithProof.payload as Record<string, unknown>;

        await auditService.log({
          level: "operation",
          operation: "append",
          entryId: entryWithProof.id,
          issuerOid: payload.issuer_oid as string | undefined,
          subjectOid: payload.subject_oid as string | undefined,
          requestId: context.requestId,
          duration,
          success: true,
        });
      },

      beforeQuery: async (filters, ledger) => {
        const auditService = getService(ledger);
        const startTime = Date.now();
        (ledger as any)._auditQueryContext = { startTime };
      },

      afterQuery: async (result, filters, ledger) => {
        const auditService = getService(ledger);
        const context = (ledger as any)._auditQueryContext || {};
        const duration = Date.now() - (context.startTime || Date.now());

        await auditService.log({
          level: "operation",
          operation: "query",
          issuerOid: filters.issuer_oid,
          subjectOid: filters.subject_oid,
          metadata: {
            filters,
            resultCount: result.entries.length,
            hasMore: result.hasMore,
          },
          duration,
          success: true,
        });

        return result;
      },

      beforeGet: async (id, ledger) => {
        const auditService = getService(ledger);
        const startTime = Date.now();
        (ledger as any)._auditGetContext = { startTime, id };
      },

      afterGet: async (entry, id, ledger) => {
        const auditService = getService(ledger);
        const context = (ledger as any)._auditGetContext || {};
        const duration = Date.now() - (context.startTime || Date.now());

        await auditService.log({
          level: "operation",
          operation: "get",
          entryId: id,
          issuerOid: entry
            ? ((entry.payload as Record<string, unknown>).issuer_oid as
                | string
                | undefined)
            : undefined,
          metadata: {
            found: entry !== null,
          },
          duration,
          success: true,
        });

        return entry;
      },

      beforeVerifyChain: async (startId, limit, ledger) => {
        const auditService = getService(ledger);
        const startTime = Date.now();
        (ledger as any)._auditVerifyContext = { startTime };
      },

      afterVerifyChain: async (result, ledger) => {
        const auditService = getService(ledger);
        const context = (ledger as any)._auditVerifyContext || {};
        const duration = Date.now() - (context.startTime || Date.now());

        await auditService.log({
          level: result.valid ? "operation" : "error",
          operation: "verifyChain",
          metadata: {
            valid: result.valid,
            entriesChecked: result.entries_checked,
            hashMismatches: (result as any).hash_mismatches ?? 0,
            signatureFailures: (result as any).signature_failures ?? 0,
            timestampIssues: (result as any).timestamp_issues ?? 0,
            payloadErrors: (result as any).payload_errors ?? 0,
          },
          duration,
          success: result.valid,
          error: result.error,
        });

        return result;
      },
    },
  };
}
