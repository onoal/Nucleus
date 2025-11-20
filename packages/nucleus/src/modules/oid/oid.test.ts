/**
 * Tests for oid module
 */

import { describe, it, expect } from "vitest";
import { OidModuleRuntime } from "./validator.js";
import { generateOidChainId, parseOid } from "./types.js";
import type { OidRecord, OidKey } from "./types.js";
import { NUCLEUS_SCHEMA_VERSION } from "../../types/index.js";
import type { NucleusRecord } from "../../types/index.js";

describe("OID Module", () => {
  const validator = new OidModuleRuntime();

  // Helper to create a valid OID record (using @onoal/oid-core structure)
  function createOidRecord(overrides?: Partial<OidRecord>): OidRecord {
    return {
      oid: "oid:onoal:user:abc123",
      schema: "oid-core/v0.1.1",
      kind: "human",
      keys: [
        {
          id: "#main",
          usage: ["auth", "sign"],
          alg: "ed25519",
          publicKey: "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
          createdAt: "2025-11-20T12:00:00.000Z",
        },
      ],
      metadata: { displayName: "Test User" },
      createdAt: "2025-11-20T12:00:00.000Z",
      updatedAt: "2025-11-20T12:00:00.000Z",
      proof: {
        type: "ed25519-jcs-2025",
        createdAt: "2025-11-20T12:00:00.000Z",
        keyRef: "#main",
        signature: "mock-signature-base64url",
      },
      ...overrides,
    };
  }

  // Helper to create a nucleus record with OID body
  function createNucleusRecord(oidRecord: OidRecord, index = 0): NucleusRecord {
    return {
      schema: NUCLEUS_SCHEMA_VERSION,
      module: "oid",
      chainId: generateOidChainId(oidRecord.oid),
      index,
      prevHash: index === 0 ? null : "prev-hash",
      createdAt: oidRecord.updatedAt,
      body: { oidRecord },
      hash: `hash-${index}`,
    };
  }

  describe("validateRecord()", () => {
    describe("schema validation", () => {
      it("should accept valid schema", async () => {
        const oidRecord = createOidRecord();
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject invalid schema", async () => {
        const oidRecord = createOidRecord({ schema: "invalid" as never });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });
    });

    describe("OID string validation", () => {
      it("should accept valid OID", async () => {
        const oidRecord = createOidRecord({ oid: "oid:onoal:user:test123" });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject invalid OID format", async () => {
        const oidRecord = createOidRecord({ oid: "not-an-oid" });

        // Create record manually to bypass generateOidChainId validation
        const record: NucleusRecord = {
          schema: "nucleus-core/v0.1.0-beta",
          module: "oid",
          chainId: "manual-chain-id",
          index: 0,
          prevHash: null,
          createdAt: "2025-11-20T12:00:00.000Z",
          body: { oidRecord },
          meta: {},
          hash: "manual-hash",
        };

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });

      it("should reject empty OID", async () => {
        const oidRecord = createOidRecord({ oid: "" });

        // Create record manually to bypass generateOidChainId validation
        const record: NucleusRecord = {
          schema: "nucleus-core/v0.1.0-beta",
          module: "oid",
          chainId: "manual-chain-id",
          index: 0,
          prevHash: null,
          createdAt: "2025-11-20T12:00:00.000Z",
          body: { oidRecord },
          meta: {},
          hash: "manual-hash",
        };

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });
    });

    describe("kind validation", () => {
      it("should accept 'human'", async () => {
        const oidRecord = createOidRecord({ kind: "human" });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept 'org'", async () => {
        const oidRecord = createOidRecord({ kind: "org" });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept 'service'", async () => {
        const oidRecord = createOidRecord({ kind: "service" });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept unrecognized kind (permissive validation)", async () => {
        // @onoal/oid-core logs a warning for unknown kinds but doesn't fail validation
        // This allows for future extensibility
        const oidRecord = createOidRecord({ kind: "robot" as never });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        // Note: @onoal/oid-core is permissive and accepts unknown kinds with a warning
        expect(result.ok).toBe(true);
      });
    });

    describe("keys validation", () => {
      it("should accept valid keys array", async () => {
        const oidRecord = createOidRecord({
          keys: [
            {
              id: "#main",
              usage: ["auth", "sign"],
              alg: "ed25519",
              publicKey: "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
              createdAt: "2025-11-20T12:00:00.000Z",
            },
            {
              id: "#backup",
              usage: ["sign"],
              alg: "ed25519",
              publicKey: "z6MknGc3ocHs3zdPiJbnaaqDi58NGb4pk1Sp9WxWufuXSdxf",
              createdAt: "2025-11-20T12:00:00.000Z",
            },
          ],
        });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject empty keys array", async () => {
        const oidRecord = createOidRecord({ keys: [] });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });

      it("should reject key without id", async () => {
        const oidRecord = createOidRecord({
          keys: [
            {
              id: "", // Invalid: empty id
              usage: ["auth"] as OidKey["usage"],
              alg: "ed25519",
              publicKey: "z6Mk...",
              createdAt: "2025-11-20T12:00:00.000Z",
            },
          ],
        });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });

      it("should reject key without usage", async () => {
        const oidRecord = createOidRecord({
          keys: [
            {
              id: "#main",
              usage: [] as OidKey["usage"], // Invalid: empty usage array
              alg: "ed25519",
              publicKey: "z6Mk...",
              createdAt: "2025-11-20T12:00:00.000Z",
            },
          ],
        });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });

      it("should reject key without publicKey", async () => {
        const oidRecord = createOidRecord({
          keys: [
            {
              id: "#main",
              usage: ["auth"] as OidKey["usage"],
              alg: "ed25519",
              publicKey: "", // Invalid: empty publicKey
              createdAt: "2025-11-20T12:00:00.000Z",
            },
          ],
        });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });
    });

    describe("timestamp validation", () => {
      it("should accept valid timestamps", async () => {
        const oidRecord = createOidRecord({
          createdAt: "2025-11-20T10:00:00.000Z",
          updatedAt: "2025-11-20T12:00:00.000Z",
        });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject invalid createdAt", async () => {
        const oidRecord = createOidRecord({ createdAt: "invalid-date" });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });

      it("should reject invalid updatedAt", async () => {
        const oidRecord = createOidRecord({ updatedAt: "not-a-date" });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });
    });

    describe("proof validation", () => {
      it("should accept valid proof structure", async () => {
        const oidRecord = createOidRecord();
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept structurally valid proof (signature not verified in beta)", async () => {
        const oidRecord = createOidRecord({
          proof: {
            type: "ed25519-jcs-2025",
            createdAt: "2025-11-20T12:00:00.000Z",
            keyRef: "#main",
            signature: "mock-signature-base64url-encoded-string",
          },
        });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        // In v0.1.0-beta, we only validate structure, not cryptographic validity
        expect(result.ok).toBe(true);
      });

      it("should reject proof with non-existent keyRef", async () => {
        const oidRecord = createOidRecord({
          proof: {
            type: "ed25519-jcs-2025",
            createdAt: "2025-11-20T12:00:00.000Z",
            keyRef: "#nonexistent",
            signature: "mock-signature-base64url",
          },
        });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        // @onoal/oid-core validates that keyRef exists in keys array
        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("INVALID_OID_RECORD");
      });
    });

    describe("chain consistency", () => {
      it("should accept same OID in chain", async () => {
        const oid = "oid:onoal:user:abc123";
        const oidRecord0 = createOidRecord({
          oid,
          updatedAt: "2025-11-20T10:00:00.000Z",
        });
        const oidRecord1 = createOidRecord({
          oid,
          updatedAt: "2025-11-20T12:00:00.000Z",
        });

        const record0 = createNucleusRecord(oidRecord0, 0);
        const record1 = createNucleusRecord(oidRecord1, 1);

        const result = await validator.validateRecord({
          record: record1,
          prevRecord: record0,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject OID change in chain", async () => {
        const oidRecord0 = createOidRecord({ oid: "oid:onoal:user:alice" });
        const oidRecord1 = createOidRecord({ oid: "oid:onoal:user:bob" });

        const record0 = createNucleusRecord(oidRecord0, 0);
        const record1 = createNucleusRecord(oidRecord1, 1);

        const result = await validator.validateRecord({
          record: record1,
          prevRecord: record0,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("OID_MISMATCH");
      });

      it("should require updatedAt to increase", async () => {
        const oid = "oid:onoal:user:abc123";
        const oidRecord0 = createOidRecord({
          oid,
          updatedAt: "2025-11-20T12:00:00.000Z",
        });
        const oidRecord1 = createOidRecord({
          oid,
          updatedAt: "2025-11-20T11:00:00.000Z",
        });

        const record0 = createNucleusRecord(oidRecord0, 0);
        const record1 = createNucleusRecord(oidRecord1, 1);

        const result = await validator.validateRecord({
          record: record1,
          prevRecord: record0,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("UPDATED_AT_NOT_INCREASING");
      });
    });

    describe("caller authorization", () => {
      it("should accept when callerOid matches OID", async () => {
        const oid = "oid:onoal:user:abc123";
        const oidRecord = createOidRecord({ oid });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { callerOid: oid, now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should accept when callerOid is not provided", async () => {
        const oidRecord = createOidRecord();
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: { now: "2025-11-20T12:00:00.000Z" },
        });

        expect(result.ok).toBe(true);
      });

      it("should reject when callerOid does not match", async () => {
        const oidRecord = createOidRecord({ oid: "oid:onoal:user:alice" });
        const record = createNucleusRecord(oidRecord);

        const result = await validator.validateRecord({
          record,
          prevRecord: null,
          context: {
            callerOid: "oid:onoal:user:bob",
            now: "2025-11-20T12:00:00.000Z",
          },
        });

        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe("UNAUTHORIZED_CALLER");
      });
    });
  });

  describe("generateOidChainId()", () => {
    it("should generate base64url-encoded chainId", () => {
      const chainId = generateOidChainId("oid:onoal:user:abc123");

      expect(chainId).toMatch(/^oid:onoal:[A-Za-z0-9_-]+$/);
      expect(chainId).not.toContain("+");
      expect(chainId).not.toContain("/");
      expect(chainId).not.toContain("=");
    });

    it("should include namespace in chainId", () => {
      const chainId = generateOidChainId("oid:onoal:user:test");
      expect(chainId.startsWith("oid:onoal:")).toBe(true);
    });

    it("should be deterministic", () => {
      const oid = "oid:onoal:user:abc123";
      const chainId1 = generateOidChainId(oid);
      const chainId2 = generateOidChainId(oid);

      expect(chainId1).toBe(chainId2);
    });

    it("should throw for invalid OID", () => {
      expect(() => generateOidChainId("invalid")).toThrow("Invalid OID format");
    });
  });

  describe("parseOid()", () => {
    it("should parse valid OID", () => {
      const parsed = parseOid("oid:onoal:user:abc123");

      expect(parsed).toEqual({
        namespace: "onoal",
        type: "user",
        identifier: "abc123",
      });
    });

    it("should throw for invalid format", () => {
      expect(() => parseOid("not-an-oid")).toThrow("Invalid OID format");
      expect(() => parseOid("oid:")).toThrow("Invalid OID format");
      expect(() => parseOid("")).toThrow("Invalid OID format");
    });
  });
});
