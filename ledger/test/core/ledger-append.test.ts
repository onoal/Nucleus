/**
 * Tests for ledger.append() - Entry toevoegen
 *
 * Tests basic append, custom schema validation, plugin hooks, UAL checks, etc.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createLedger, type OnoalLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import { ed25519 } from "@noble/curves/ed25519.js";

describe("Core Ledger - append()", () => {
  let ledger: OnoalLedger;

  beforeEach(async () => {
    const privateKey = ed25519.utils.randomPrivateKey();
    const adapter = sqliteAdapter({ path: ":memory:" });

    // Run migrations to create tables
    if (adapter.migrate) {
      await adapter.migrate();
    }

    ledger = await createLedger({
      name: "test-ledger",
      signingKey: privateKey,
      adapter,
      modules: [],
    });
  });

  afterEach(() => {});

  describe("Basic append", () => {
    it("should append entry with payload", async () => {
      const result = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        subject_oid: "oid:onoal:user:test-user",
        payload: {
          proof_type: "verification",
          status: "verified",
        },
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("proof_jwt");
      expect(result.stream).toBe("proofs");
      expect(result.payload).toEqual({
        proof_type: "verification",
        status: "verified",
      });
      expect(result.issuer_oid).toBe("oid:onoal:org:test-org");
      expect(result.subject_oid).toBe("oid:onoal:user:test-user");
    });

    it("should append entry without subject_oid", async () => {
      const result = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: {
          proof_type: "verification",
        },
      });

      expect(result).toHaveProperty("id");
      expect(result.subject_oid).toBeUndefined();
    });

    it("should append entry with custom stream", async () => {
      const result = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
        stream: "custom",
      });

      expect(result.stream).toBe("custom");
    });

    it("should append entry with meta data", async () => {
      const meta = { source: "test", version: "1.0" };
      const result = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
        meta,
      });

      expect(result.meta).toEqual(meta);
    });

    it("should generate proof_jwt", async () => {
      const result = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      expect(result.proof_jwt).toBeDefined();
      expect(typeof result.proof_jwt).toBe("string");
      expect(result.proof_jwt.split(".").length).toBe(3); // JWT has 3 parts
    });

    it("should link entries via prev_hash", async () => {
      const entry1 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: 1 },
      });

      const entry2 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: 2 },
      });

      expect(entry1.prev_hash).toBeNull(); // First entry
      expect(entry2.prev_hash).toBe(entry1.hash); // Second entry links to first
    });

    it("should generate unique IDs for each entry", async () => {
      const entry1 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: 1 },
      });

      const entry2 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: 2 },
      });

      expect(entry1.id).not.toBe(entry2.id);
    });

    it("should generate unique hashes for each entry", async () => {
      const entry1 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: 1 },
      });

      const entry2 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: 2 },
      });

      expect(entry1.hash).not.toBe(entry2.hash);
    });

    it("should set timestamp for each entry", async () => {
      const before = Date.now();
      const entry = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });
      const after = Date.now();

      expect(entry.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry.timestamp).toBeLessThanOrEqual(after);
    });

    it("should set status to 'active' by default", async () => {
      const entry = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      expect(entry.status).toBe("active");
    });
  });

  describe("Custom schema validation", () => {
    it("should validate entry against custom schema", async () => {
      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithSchema = await createLedger({
        name: "test-ledger-schema",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        customSchemas: {
          custom_type: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name", "age"],
          },
        },
      });

      const result = await ledgerWithSchema.append({
        type: "custom_type",
        issuer_oid: "oid:onoal:org:test-org",
        payload: {
          name: "Test",
          age: 25,
        },
      });

      expect(result).toHaveProperty("id");
      expect(result.payload).toEqual({ name: "Test", age: 25 });
    });

    it("should reject entry with invalid schema", async () => {
      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithSchema = await createLedger({
        name: "test-ledger-schema-invalid",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        customSchemas: {
          custom_type: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name", "age"],
          },
        },
      });

      await expect(
        ledgerWithSchema.append({
          type: "custom_type",
          issuer_oid: "oid:onoal:org:test-org",
          payload: {
            name: "Test",
            // Missing required field: age
          },
        })
      ).rejects.toThrow(/Schema validation failed/);
    });
  });

  describe("Error handling", () => {
    it("should throw error for invalid issuer_oid", async () => {
      await expect(
        ledger.append({
          type: "proof",
          issuer_oid: "invalid-oid",
          payload: { test: true },
        })
      ).rejects.toThrow();
    });

    it("should throw error for invalid subject_oid", async () => {
      await expect(
        ledger.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          subject_oid: "invalid-oid",
          payload: { test: true },
        })
      ).rejects.toThrow();
    });

    it("should throw error for missing payload", async () => {
      await expect(
        // @ts-expect-error - Testing invalid input
        ledger.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
        })
      ).rejects.toThrow();
    });
  });
});
