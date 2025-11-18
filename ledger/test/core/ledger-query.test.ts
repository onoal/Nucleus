/**
 * Tests for ledger.query() - Entries queryen
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createLedger, type OnoalLedger } from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import { ed25519 } from "@noble/curves/ed25519.js";

describe("Core Ledger - query()", () => {
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

  describe("Query by stream", () => {
    it("should query entries by stream", async () => {
      await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: "proof1" },
        stream: "proof",
      });

      await ledger.append({
        type: "asset",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: "asset1" },
        stream: "asset",
      });

      const result = await ledger.query({ stream: "proof" });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]?.stream).toBe("proof");
      expect(result.entries[0]?.payload).toEqual({ test: "proof1" });
    });

    it("should return empty array for non-existent stream", async () => {
      const result = await ledger.query({ stream: "non-existent" });
      expect(result.entries).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("Query by subject_oid", () => {
    it("should query entries by subject_oid", async () => {
      const subject1 = "oid:onoal:user:user1";
      const subject2 = "oid:onoal:user:user2";

      await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        subject_oid: subject1,
        payload: { test: 1 },
      });

      await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        subject_oid: subject2,
        payload: { test: 2 },
      });

      const result = await ledger.query({ subject_oid: subject1 });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]?.subject_oid).toBe(subject1);
    });
  });

  describe("Query by issuer_oid", () => {
    it("should query entries by issuer_oid", async () => {
      const issuer1 = "oid:onoal:org:org1";
      const issuer2 = "oid:onoal:org:org2";

      await ledger.append({
        type: "proof",
        issuer_oid: issuer1,
        payload: { test: 1 },
      });

      await ledger.append({
        type: "proof",
        issuer_oid: issuer2,
        payload: { test: 2 },
      });

      const result = await ledger.query({ issuer_oid: issuer1 });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]?.issuer_oid).toBe(issuer1);
    });
  });

  describe("Query by status", () => {
    it("should query entries by status", async () => {
      // Note: Status is set to 'active' by default in append
      await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      const result = await ledger.query({ status: "active" });

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.every((e) => e.status === "active")).toBe(true);
    });
  });

  describe("Query with pagination", () => {
    it("should respect limit parameter", async () => {
      // Create multiple entries
      for (let i = 0; i < 5; i++) {
        await ledger.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          payload: { index: i },
        });
      }

      const result = await ledger.query({ limit: 2 });

      expect(result.entries.length).toBe(2);
    });

    it("should return hasMore when more entries exist", async () => {
      for (let i = 0; i < 5; i++) {
        await ledger.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          payload: { index: i },
        });
      }

      const result = await ledger.query({ limit: 2 });

      expect(result.hasMore).toBe(true);
    });

    it("should return nextCursor when hasMore is true", async () => {
      for (let i = 0; i < 5; i++) {
        await ledger.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          payload: { index: i },
        });
      }

      const result = await ledger.query({ limit: 2 });

      if (result.hasMore) {
        expect(result.nextCursor).not.toBeNull();
        expect(typeof result.nextCursor).toBe("number");
      }
    });

    it("should use cursor for pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await ledger.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          payload: { index: i },
        });
      }

      const firstPage = await ledger.query({ limit: 2 });
      expect(firstPage.entries.length).toBe(2);

      if (firstPage.nextCursor) {
        const secondPage = await ledger.query({
          limit: 2,
          cursor: firstPage.nextCursor,
        });

        expect(secondPage.entries.length).toBeGreaterThan(0);
        // Ensure no overlap
        const firstIds = new Set(firstPage.entries.map((e) => e.id));
        const secondIds = new Set(secondPage.entries.map((e) => e.id));
        const intersection = [...firstIds].filter((id) => secondIds.has(id));
        expect(intersection.length).toBe(0);
      }
    });
  });

  describe("Query with multiple filters", () => {
    it("should combine stream and subject_oid filters", async () => {
      const subject = "oid:onoal:user:user1";

      await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        subject_oid: subject,
        payload: { test: 1 },
        stream: "proof",
      });

      await ledger.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        subject_oid: subject,
        payload: { test: 2 },
        stream: "asset", // Different stream
      });

      const result = await ledger.query({
        stream: "proof",
        subject_oid: subject,
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]?.stream).toBe("proof");
      expect(result.entries[0]?.subject_oid).toBe(subject);
    });

    it("should combine issuer_oid and status filters", async () => {
      const issuer = "oid:onoal:org:test-org";

      await ledger.append({
        type: "proof",
        issuer_oid: issuer,
        payload: { test: true },
      });

      const result = await ledger.query({
        issuer_oid: issuer,
        status: "active",
      });

      expect(result.entries.length).toBeGreaterThan(0);
      expect(
        result.entries.every(
          (e) => e.issuer_oid === issuer && e.status === "active"
        )
      ).toBe(true);
    });
  });

  describe("Empty results", () => {
    it("should return empty array when no entries match", async () => {
      const result = await ledger.query({ stream: "non-existent" });
      expect(result.entries).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("should return empty array for empty ledger", async () => {
      const result = await ledger.query({});
      expect(result.entries).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });
});
