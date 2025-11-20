/**
 * OID module validator
 *
 * Validates OID records for anchoring in Nucleus
 */

import type { ModuleRuntime, ValidationResult, NucleusRecord } from "../../types/index.js";
import type { OidBody } from "./types.js";
import { validateRecord } from "@onoal/oid-core";

/**
 * OID module runtime
 *
 * Validates OID record anchoring according to the following rules:
 * 1. schema must be "oid-core/v0.1.1"
 * 2. oid must be a valid OID string
 * 3. kind must be "human", "org", or "agent"
 * 4. keys array must have at least one key
 * 5. createdAt and updatedAt must be valid ISO 8601
 * 6. proof structure must be valid
 * 7. Chain consistency: same OID throughout chain
 * 8. updatedAt must be monotonically increasing
 * 9. callerOid must match oidRecord.oid (or be authorized)
 */
export class OidModuleRuntime implements ModuleRuntime {
  validateRecord(input: {
    record: NucleusRecord;
    prevRecord: NucleusRecord | null;
    context: { callerOid?: string; now: string };
  }): Promise<ValidationResult> {
    return this.validate(input);
  }

  private async validate(input: {
    record: NucleusRecord;
    prevRecord: NucleusRecord | null;
    context: { callerOid?: string; now: string };
  }): Promise<ValidationResult> {
    const body = input.record.body as OidBody;

    // Check body structure
    if (!body.oidRecord || typeof body.oidRecord !== "object") {
      return {
        ok: false,
        errorCode: "INVALID_BODY",
        errorMessage: "body.oidRecord must be an object",
      };
    }

    const oidRecord = body.oidRecord;

    // Use official @onoal/oid-core validation
    const validation = validateRecord(oidRecord);

    if (!validation.valid) {
      // validation.errors is an array of error messages
      const errorMsg =
        validation.errors && validation.errors.length > 0
          ? validation.errors[0]
          : "OID record validation failed";

      return {
        ok: false,
        errorCode: "INVALID_OID_RECORD",
        errorMessage: errorMsg,
      };
    }

    // Additional validation: timestamps must be valid dates
    const createdAt = new Date(oidRecord.createdAt);
    const updatedAt = new Date(oidRecord.updatedAt);

    if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
      return {
        ok: false,
        errorCode: "INVALID_TIMESTAMPS",
        errorMessage: "createdAt and updatedAt must be valid ISO 8601 timestamps",
      };
    }

    // 7. Chain consistency: same OID throughout
    if (input.prevRecord) {
      const prevBody = input.prevRecord.body as OidBody;
      if (!prevBody.oidRecord) {
        return {
          ok: false,
          errorCode: "INVALID_PREV_RECORD",
          errorMessage: "Previous record does not have oidRecord",
        };
      }

      if (prevBody.oidRecord.oid !== oidRecord.oid) {
        return {
          ok: false,
          errorCode: "OID_MISMATCH",
          errorMessage: "OID cannot change within a chain",
        };
      }

      // 8. updatedAt must increase
      const prevUpdatedAt = new Date(prevBody.oidRecord.updatedAt);
      if (updatedAt <= prevUpdatedAt) {
        return {
          ok: false,
          errorCode: "UPDATED_AT_NOT_INCREASING",
          errorMessage: "updatedAt must be later than previous record",
        };
      }
    }

    // 9. Caller policy
    if (input.context.callerOid) {
      // In v0.1.0-beta: caller must be the OID itself
      // Later: extend with delegation/authorization
      if (input.context.callerOid !== oidRecord.oid) {
        return {
          ok: false,
          errorCode: "UNAUTHORIZED_CALLER",
          errorMessage: "callerOid must match oidRecord.oid",
        };
      }
    }

    return { ok: true };
  }
}

/**
 * Singleton instance of oid module
 */
export const oidModule = new OidModuleRuntime();
