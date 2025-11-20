/**
 * Tests for proof module
 */

import { describe, it, expect } from "vitest";
import { ProofModuleRuntime } from "./validator.js";
import { generateProofChainId } from "./types.js";
import type { ProofBody } from "./types.js";

describe("Proof Module", () => {
  const validator = new ProofModuleRuntime();

  // Helper to create a valid proof body
  function createProofBody(overrides?: Partial<ProofBody>): ProofBody {
    return {
      subject: "oid:onoal:user:alice",
      issuer: "oid:onoal:org:verifier",
      kind: "kyc",
      data: { country: "NL", level: "basic" },
      issuedAt: "2025-11-20T12:00:00.000Z",
      ...overrides,
    };
  }

  describe("validateRecord()", () => {
    describe("subject validation", () => {
      it("should accept valid OID subject", async () => {
        const body = createProofBody();
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject missing subject", async () => {
        const body = createProofBody({ subject: "" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_SUBJECT");
      });

      it("should reject non-OID subject", async () => {
        const body = createProofBody({ subject: "not-an-oid" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_SUBJECT_OID");
      });
    });

    describe("issuer validation", () => {
      it("should accept valid OID issuer", async () => {
        const body = createProofBody();
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject missing issuer", async () => {
        const body = createProofBody({ issuer: "" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_ISSUER");
      });

      it("should reject non-OID issuer", async () => {
        const body = createProofBody({ issuer: "invalid-issuer" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_ISSUER_OID");
      });
    });

    describe("kind validation", () => {
      it("should accept valid kind", async () => {
        const body = createProofBody({ kind: "membership" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject empty kind", async () => {
        const body = createProofBody({ kind: "" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_KIND");
      });
    });

    describe("data validation", () => {
      it("should accept object data", async () => {
        const body = createProofBody({ data: { custom: "value", nested: { key: 123 } } });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject array data", async () => {
        const body = createProofBody({ data: [1, 2, 3] as never });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_DATA");
      });

      it("should reject non-object data", async () => {
        const body = createProofBody({ data: "string" as never });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_DATA");
      });
    });

    describe("issuedAt validation", () => {
      it("should accept valid issuedAt before createdAt", async () => {
        const body = createProofBody({ issuedAt: "2025-11-20T11:00:00.000Z" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept issuedAt equal to createdAt", async () => {
        const timestamp = "2025-11-20T12:00:00.000Z";
        const body = createProofBody({ issuedAt: timestamp });
        const result = await validator.validateRecord({
          record: { body, createdAt: timestamp },
          prevRecord: null,
          context: { now: timestamp },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject issuedAt after createdAt", async () => {
        const body = createProofBody({ issuedAt: "2025-11-20T13:00:00.000Z" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("ISSUED_AT_FUTURE");
      });

      it("should reject invalid issuedAt format", async () => {
        const body = createProofBody({ issuedAt: "invalid-date" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_ISSUED_AT");
      });
    });

    describe("expiresAt validation", () => {
      it("should accept valid expiresAt after issuedAt", async () => {
        const body = createProofBody({
          issuedAt: "2025-11-20T12:00:00.000Z",
          expiresAt: "2026-11-20T12:00:00.000Z",
        });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept missing expiresAt", async () => {
        const body = createProofBody();
        delete body.expiresAt;
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject expiresAt before issuedAt", async () => {
        const body = createProofBody({
          issuedAt: "2025-11-20T12:00:00.000Z",
          expiresAt: "2024-11-20T12:00:00.000Z",
        });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("EXPIRES_AT_BEFORE_ISSUED");
      });

      it("should reject expiresAt equal to issuedAt", async () => {
        const timestamp = "2025-11-20T12:00:00.000Z";
        const body = createProofBody({
          issuedAt: timestamp,
          expiresAt: timestamp,
        });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("EXPIRES_AT_BEFORE_ISSUED");
      });

      it("should reject invalid expiresAt format", async () => {
        const body = createProofBody({ expiresAt: "not-a-date" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_EXPIRES_AT");
      });
    });

    describe("caller authorization", () => {
      it("should accept when callerOid matches issuer", async () => {
        const body = createProofBody({ issuer: "oid:onoal:org:verifier" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: {
            callerOid: "oid:onoal:org:verifier",
            now: "2025-11-20T12:00:00.000Z",
          },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept when callerOid is not provided", async () => {
        const body = createProofBody();
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject when callerOid does not match issuer", async () => {
        const body = createProofBody({ issuer: "oid:onoal:org:verifier" });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: {
            callerOid: "oid:onoal:org:different",
            now: "2025-11-20T12:00:00.000Z",
          },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("UNAUTHORIZED_ISSUER");
      });
    });

    describe("issuerProof validation", () => {
      it("should accept valid issuerProof structure", async () => {
        const body = createProofBody({
          issuerProof: {
            type: "ed25519-jcs-2025",
            keyRef: "#main",
            signature: "base64url-encoded-signature",
          },
        });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept missing issuerProof", async () => {
        const body = createProofBody();
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject issuerProof without type", async () => {
        const body = createProofBody({
          issuerProof: {
            type: "",
            keyRef: "#main",
            signature: "sig",
          },
        });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_ISSUER_PROOF");
      });

      it("should reject issuerProof without keyRef", async () => {
        const body = createProofBody({
          issuerProof: {
            type: "ed25519-jcs-2025",
            keyRef: "",
            signature: "sig",
          },
        });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_ISSUER_PROOF");
      });

      it("should reject issuerProof without signature", async () => {
        const body = createProofBody({
          issuerProof: {
            type: "ed25519-jcs-2025",
            keyRef: "#main",
            signature: "",
          },
        });
        const result = await validator.validateRecord({
          record: { body, createdAt: "2025-11-20T12:00:00.000Z" },
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_ISSUER_PROOF");
      });
    });
  });

  describe("generateProofChainId()", () => {
    it("should generate chainId with issuer, subject, kind", () => {
      const chainId = generateProofChainId(
        "oid:onoal:org:verifier",
        "oid:onoal:user:alice",
        "kyc"
      );

      expect(chainId).toBe("nucleus:proof:oid:onoal:org:verifier:oid:onoal:user:alice:kyc");
    });

    it("should handle different kinds", () => {
      const chainId1 = generateProofChainId("oid:a:b:c", "oid:x:y:z", "kyc");
      const chainId2 = generateProofChainId("oid:a:b:c", "oid:x:y:z", "membership");

      expect(chainId1).not.toBe(chainId2);
      expect(chainId1).toContain(":kyc");
      expect(chainId2).toContain(":membership");
    });
  });
});

