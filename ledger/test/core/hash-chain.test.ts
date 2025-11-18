/**
 * Tests for Hash Chain functionality
 *
 * Note: HashChain is internal, so we test it indirectly through ledger operations
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createLedger, type OnoalLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import { ed25519 } from "@noble/curves/ed25519.js";

describe("Hash Chain", () => {
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

  afterEach(() => {
    // Cleanup handled by in-memory database
  });

  describe("Hash computation", () => {
    it("should compute SHA-256 hash for entries", async () => {
      const entry = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: "data" },
      });

      expect(entry.hash).toBeDefined();
      expect(typeof entry.hash).toBe("string");
      expect(entry.hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it("should produce different hashes for different entries", async () => {
      const entry1 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: "data1" },
      });

      const entry2 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: "data2" },
      });

      expect(entry1.hash).not.toBe(entry2.hash);
    });

    it("should include stream, id, and payload in hash", async () => {
      const entry1 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: "data" },
        stream: "proofs",
      });

      const entry2 = await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: "data" },
        stream: "assets", // Different stream
      });

      // Different streams should produce different hashes
      expect(entry1.hash).not.toBe(entry2.hash);
    });
  });

  describe("Chain integrity", () => {
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

    it("should maintain chain integrity across multiple entries", async () => {
      const entries = [];
      for (let i = 0; i < 5; i++) {
        const entry = await ledger.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          payload: { index: i },
        });
        entries.push(entry);
      }

      // Verify chain linking
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i]?.prev_hash).toBe(entries[i - 1]?.hash);
      }
    });
  });
});
