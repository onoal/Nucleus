/**
 * Proof module validator
 *
 * Validates attestations/proofs about OID subjects
 */

import type { ModuleRuntime, ValidationResult } from "../../types/index.js";
import type { ProofBody } from "./types.js";
import { Oid } from "@onoal/oid-core";

/**
 * Proof module runtime
 *
 * Validates proof records according to the following rules:
 * 1. subject and issuer must be valid OID strings
 * 2. kind must be a non-empty string
 * 3. data must be an object
 * 4. issuedAt must be valid ISO 8601 and <= record.createdAt
 * 5. expiresAt (if present) must be > issuedAt
 * 6. callerOid (if present) must match issuer
 * 7. issuerProof signature verification (optional in beta)
 */
export class ProofModuleRuntime implements ModuleRuntime {
  validateRecord(input: {
    record: { body: unknown; createdAt: string };
    prevRecord: unknown;
    context: { callerOid?: string; now: string };
  }): Promise<ValidationResult> {
    return Promise.resolve(this.validate(input));
  }

  private validate(input: {
    record: { body: unknown; createdAt: string };
    prevRecord: unknown;
    context: { callerOid?: string; now: string };
  }): ValidationResult {
    const body = input.record.body as ProofBody;

    // 1. Validate subject OID using @onoal/oid-core
    if (!body.subject || typeof body.subject !== "string") {
      return {
        ok: false,
        errorCode: "INVALID_SUBJECT",
        errorMessage: "subject must be a non-empty string (OID)",
      };
    }

    try {
      Oid.parse(body.subject);
    } catch (error) {
      return {
        ok: false,
        errorCode: "INVALID_SUBJECT_OID",
        errorMessage: `Invalid subject OID: ${body.subject}`,
      };
    }

    // 2. Validate issuer OID using @onoal/oid-core
    if (!body.issuer || typeof body.issuer !== "string") {
      return {
        ok: false,
        errorCode: "INVALID_ISSUER",
        errorMessage: "issuer must be a non-empty string (OID)",
      };
    }

    try {
      Oid.parse(body.issuer);
    } catch (error) {
      return {
        ok: false,
        errorCode: "INVALID_ISSUER_OID",
        errorMessage: `Invalid issuer OID: ${body.issuer}`,
      };
    }

    // 3. Validate kind
    if (!body.kind || typeof body.kind !== "string") {
      return {
        ok: false,
        errorCode: "INVALID_KIND",
        errorMessage: "kind must be a non-empty string",
      };
    }

    // 4. Validate data
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return {
        ok: false,
        errorCode: "INVALID_DATA",
        errorMessage: "data must be an object",
      };
    }

    // 5. Validate issuedAt
    if (!body.issuedAt || typeof body.issuedAt !== "string") {
      return {
        ok: false,
        errorCode: "INVALID_ISSUED_AT",
        errorMessage: "issuedAt must be a valid ISO 8601 string",
      };
    }

    const issuedAt = new Date(body.issuedAt);
    if (isNaN(issuedAt.getTime())) {
      return {
        ok: false,
        errorCode: "INVALID_ISSUED_AT",
        errorMessage: "issuedAt must be a valid ISO 8601 timestamp",
      };
    }

    const createdAt = new Date(input.record.createdAt);
    if (issuedAt > createdAt) {
      return {
        ok: false,
        errorCode: "ISSUED_AT_FUTURE",
        errorMessage: "issuedAt cannot be after record createdAt",
      };
    }

    // 6. Validate expiresAt if present
    if (body.expiresAt) {
      if (typeof body.expiresAt !== "string") {
        return {
          ok: false,
          errorCode: "INVALID_EXPIRES_AT",
          errorMessage: "expiresAt must be a valid ISO 8601 string",
        };
      }

      const expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        return {
          ok: false,
          errorCode: "INVALID_EXPIRES_AT",
          errorMessage: "expiresAt must be a valid ISO 8601 timestamp",
        };
      }

      if (expiresAt <= issuedAt) {
        return {
          ok: false,
          errorCode: "EXPIRES_AT_BEFORE_ISSUED",
          errorMessage: "expiresAt must be after issuedAt",
        };
      }
    }

    // 7. Validate caller is issuer
    if (input.context.callerOid && input.context.callerOid !== body.issuer) {
      return {
        ok: false,
        errorCode: "UNAUTHORIZED_ISSUER",
        errorMessage: "callerOid must match proof issuer",
      };
    }

    // 8. TODO: Validate issuerProof signature (optional in v0.1.0-beta)
    // This would require:
    // - Fetching issuer's OID record
    // - Extracting public key via keyRef
    // - Verifying signature over canonical proof body
    // For now, we accept issuerProof if present but don't verify
    if (body.issuerProof) {
      if (!body.issuerProof.type || typeof body.issuerProof.type !== "string") {
        return {
          ok: false,
          errorCode: "INVALID_ISSUER_PROOF",
          errorMessage: "issuerProof.type must be a non-empty string",
        };
      }

      if (!body.issuerProof.keyRef || typeof body.issuerProof.keyRef !== "string") {
        return {
          ok: false,
          errorCode: "INVALID_ISSUER_PROOF",
          errorMessage: "issuerProof.keyRef must be a non-empty string",
        };
      }

      if (!body.issuerProof.signature || typeof body.issuerProof.signature !== "string") {
        return {
          ok: false,
          errorCode: "INVALID_ISSUER_PROOF",
          errorMessage: "issuerProof.signature must be a non-empty string",
        };
      }

      // Note: Actual signature verification would happen here
      // For v0.1.0-beta, we just validate structure
    }

    return { ok: true };
  }
}

/**
 * Singleton instance of proof module
 */
export const proofModule = new ProofModuleRuntime();
