/**
 * Tests for ledger.get() - Entry ophalen
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createLedger, type OnoalLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import { ed25519 } from "@noble/curves/ed25519.js";

describe("Core Ledger - get()", () => {
  let ledger: OnoalLedger;

  beforeEach(async () => {
    // Database created by sqliteAdapter
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

  describe("Get existing entry", () => {
    it("should get entry by ID", async () => {
      const appended = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      const retrieved = await ledger.get(appended.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(appended.id);
      expect(retrieved?.hash).toBe(appended.hash);
      expect(retrieved?.payload).toEqual(appended.payload);
    });

    it("should return null for non-existent entry", async () => {
      const result = await ledger.get("non-existent-id");
      expect(result).toBeNull();
    });

    it("should get entry with all fields", async () => {
      const appended = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        subject_oid: "oid:onoal:user:test-user",
        payload: { test: true },
        meta: { source: "test" },
      });

      const retrieved = await ledger.get(appended.id);

      expect(retrieved).toHaveProperty("id");
      expect(retrieved).toHaveProperty("stream");
      expect(retrieved).toHaveProperty("timestamp");
      expect(retrieved).toHaveProperty("payload");
      expect(retrieved).toHaveProperty("hash");
      expect(retrieved).toHaveProperty("prev_hash");
      expect(retrieved).toHaveProperty("signature");
      expect(retrieved).toHaveProperty("status");
      expect(retrieved).toHaveProperty("created_at");
      expect(retrieved?.issuer_oid).toBe("oid:onoal:org:test-org");
      expect(retrieved?.subject_oid).toBe("oid:onoal:user:test-user");
      expect(retrieved?.meta).toEqual({ source: "test" });
    });

    it("should get multiple entries correctly", async () => {
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

      const retrieved1 = await ledger.get(entry1.id);
      const retrieved2 = await ledger.get(entry2.id);

      expect(retrieved1?.id).toBe(entry1.id);
      expect(retrieved2?.id).toBe(entry2.id);
      expect(retrieved1?.payload).toEqual({ test: 1 });
      expect(retrieved2?.payload).toEqual({ test: 2 });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string ID", async () => {
      const result = await ledger.get("");
      expect(result).toBeNull();
    });

    it("should handle UUID format but non-existent", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await ledger.get(fakeId);
      expect(result).toBeNull();
    });
  });
});
