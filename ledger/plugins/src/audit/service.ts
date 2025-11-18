/**
 * Audit Log Service
 *
 * Handles storage of audit logs in different backends.
 */

import type { LedgerDatabase } from "@onoal/ledger-core";
import type { AuditLogPluginOptions } from "./index.js";
import { promises as fs } from "fs";
import { join } from "path";

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  level: "operation" | "error" | "security";
  operation: string;
  entryId?: string;
  issuerOid?: string;
  subjectOid?: string;
  requestId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  success: boolean;
  error?: string;
  createdAt: number;
}

export class AuditLogService {
  private filePath?: string;

  constructor(
    private db: LedgerDatabase | null,
    private options: AuditLogPluginOptions
  ) {
    if (options.storage === "file") {
      // Default file path
      this.filePath = process.env.AUDIT_LOG_PATH || "./audit-logs.jsonl";
    }
  }

  /**
   * Log an audit entry
   */
  async log(
    entry: Omit<AuditLogEntry, "id" | "createdAt" | "timestamp">
  ): Promise<void> {
    try {
      // Check log level filter
      if (this.options.logLevel === "errors" && entry.level !== "error") {
        return;
      }
      if (this.options.logLevel === "operations" && entry.level === "error") {
        return;
      }

      const auditLog: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        ...entry,
        createdAt: Date.now(),
      };

      // Exclude sensitive fields if configured
      if (this.options.excludeFields && auditLog.metadata) {
        for (const field of this.options.excludeFields) {
          delete auditLog.metadata[field];
        }
      }

      // Store based on storage option
      if (this.options.storage === "database") {
        await this.storeInDatabase(auditLog);
      } else if (this.options.storage === "file") {
        await this.storeInFile(auditLog);
      } else if (this.options.storage === "external") {
        await this.storeExternally(auditLog);
      }
    } catch (error) {
      // Don't throw - audit logging should never break operations
      console.error("Audit log failed:", error);

      // Optionally: retry or queue for later
      if (this.options.retryOnFailure) {
        // Could implement retry queue here
      }
    }
  }

  private async storeInDatabase(log: AuditLogEntry): Promise<void> {
    if (!this.db) {
      throw new Error("Database not available for audit logging");
    }

    // For now, we'll use a simple approach - store in a JSON column
    // In production, you'd want a proper audit_logs table
    // This requires the plugin to add its own schema to the database

    // For now, log to console if database storage is requested but not implemented
    console.warn(
      "Database storage for audit logs requires schema migration. Logging to console instead.",
      log
    );
  }

  private async storeInFile(log: AuditLogEntry): Promise<void> {
    if (!this.filePath) {
      throw new Error("File path not configured for audit logging");
    }

    // Ensure directory exists
    const dir = join(this.filePath, "..");
    await fs.mkdir(dir, { recursive: true });

    // Append to JSONL file (one JSON object per line)
    const line = JSON.stringify(log) + "\n";
    await fs.appendFile(this.filePath, line, "utf8");
  }

  private async storeExternally(log: AuditLogEntry): Promise<void> {
    if (!this.options.externalUrl) {
      throw new Error("External URL not configured for audit logging");
    }

    try {
      const response = await fetch(this.options.externalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(log),
      });

      if (!response.ok) {
        throw new Error(
          `External audit log failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      // Log error but don't throw
      console.error("External audit log failed:", error);
    }
  }
}
