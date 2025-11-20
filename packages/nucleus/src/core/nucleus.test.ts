/**
 * Integration tests for Nucleus engine
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Nucleus } from "./nucleus.js";
import { registerModule, clearModules } from "./module-registry.js";
import { SQLiteRecordStore } from "../storage-sqlite/index.js";
import { NUCLEUS_SCHEMA_VERSION } from "../types/index.js";
import type { ModuleRuntime, NucleusRecord } from "../types/index.js";

describe("Nucleus Engine", () => {
  let storage: SQLiteRecordStore;
  let nucleus: Nucleus;

  // Mock hash function (deterministic for testing)
  const mockComputeHash = (record: Record<string, unknown>): string => {
    const str = JSON.stringify(record);
    // Simple hash for testing
    return `mock-hash-${str.length}-${Math.random().toString(36).substring(7)}`;
  };

  // Mock module that always validates
  const mockModule: ModuleRuntime = {
    async validateRecord() {
      return { ok: true };
    },
  };

  // Mock module that always fails
  const failingModule: ModuleRuntime = {
    async validateRecord() {
      return {
        ok: false,
        errorCode: "TEST_ERROR",
        errorMessage: "Validation failed for testing",
      };
    },
  };

  beforeEach(() => {
    clearModules();
    storage = new SQLiteRecordStore(":memory:");
    nucleus = new Nucleus(storage, mockComputeHash);
    registerModule("test", mockModule);
  });

  describe("append()", () => {
    it("should create genesis record (index 0, prevHash null)", async () => {
      const record = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { data: "genesis" },
      });

      expect(record.schema).toBe(NUCLEUS_SCHEMA_VERSION);
      expect(record.module).toBe("test");
      expect(record.chainId).toBe("test-chain");
      expect(record.index).toBe(0);
      expect(record.prevHash).toBeNull();
      expect(record.body).toEqual({ data: "genesis" });
      expect(record.hash).toBeTruthy();
      expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    });

    it("should create second record (index 1, prevHash set)", async () => {
      const record0 = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { data: "first" },
      });

      const record1 = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { data: "second" },
      });

      expect(record1.index).toBe(1);
      expect(record1.prevHash).toBe(record0.hash);
    });

    it("should build sequential chain", async () => {
      const records: NucleusRecord[] = [];

      for (let i = 0; i < 5; i++) {
        const record = await nucleus.append({
          module: "test",
          chainId: "test-chain",
          body: { index: i },
        });
        records.push(record);
      }

      // Check chain links
      for (let i = 0; i < 5; i++) {
        expect(records[i]?.index).toBe(i);

        if (i === 0) {
          expect(records[i]?.prevHash).toBeNull();
        } else {
          expect(records[i]?.prevHash).toBe(records[i - 1]?.hash);
        }
      }
    });

    it("should accept custom timestamp via context", async () => {
      const customTime = "2025-01-01T00:00:00.000Z";

      const record = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { data: "test" },
        context: { now: customTime },
      });

      expect(record.createdAt).toBe(customTime);
    });

    it("should include meta if provided", async () => {
      const record = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { data: "test" },
        meta: { tag: "important", version: 1 },
      });

      expect(record.meta).toEqual({ tag: "important", version: 1 });
    });

    it("should isolate different chains", async () => {
      const chain1Record = await nucleus.append({
        module: "test",
        chainId: "chain-1",
        body: { data: "chain1" },
      });

      const chain2Record = await nucleus.append({
        module: "test",
        chainId: "chain-2",
        body: { data: "chain2" },
      });

      expect(chain1Record.index).toBe(0);
      expect(chain2Record.index).toBe(0);
      expect(chain1Record.chainId).toBe("chain-1");
      expect(chain2Record.chainId).toBe("chain-2");
    });

    it("should throw if module not registered", async () => {
      await expect(
        nucleus.append({
          module: "nonexistent",
          chainId: "test-chain",
          body: {},
        })
      ).rejects.toThrow("not registered: nonexistent");
    });

    it("should throw if module validation fails", async () => {
      registerModule("failing", failingModule);

      await expect(
        nucleus.append({
          module: "failing",
          chainId: "test-chain",
          body: {},
        })
      ).rejects.toThrow("Validation failed for testing");
    });

    it("should pass context to module validator", async () => {
      let capturedContext: unknown = null;

      const contextCapturingModule: ModuleRuntime = {
        async validateRecord(input) {
          capturedContext = input.context;
          return { ok: true };
        },
      };

      registerModule("context-test", contextCapturingModule);

      await nucleus.append({
        module: "context-test",
        chainId: "test-chain",
        body: {},
        context: { callerOid: "oid:test:user:123" },
      });

      expect(capturedContext).toMatchObject({
        callerOid: "oid:test:user:123",
      });
    });
  });

  describe("getHead()", () => {
    it("should return null for empty chain", async () => {
      const head = await nucleus.getHead("nonexistent");
      expect(head).toBeNull();
    });

    it("should return genesis for single-record chain", async () => {
      const record = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: {},
      });

      const head = await nucleus.getHead("test-chain");
      expect(head).toEqual(record);
    });

    it("should return latest record", async () => {
      await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { index: 0 },
      });

      await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { index: 1 },
      });

      const record2 = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { index: 2 },
      });

      const head = await nucleus.getHead("test-chain");
      expect(head).toEqual(record2);
      expect(head?.index).toBe(2);
    });
  });

  describe("getByHash()", () => {
    it("should return null for non-existent hash", async () => {
      const result = await nucleus.getByHash("nonexistent-hash");
      expect(result).toBeNull();
    });

    it("should retrieve record by hash", async () => {
      const record = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: { data: "test" },
      });

      const retrieved = await nucleus.getByHash(record.hash);
      expect(retrieved).toEqual(record);
    });
  });

  describe("getChain()", () => {
    it("should return empty array for non-existent chain", async () => {
      const chain = await nucleus.getChain("nonexistent");
      expect(chain).toEqual([]);
    });

    it("should return all records in order", async () => {
      const records: NucleusRecord[] = [];

      for (let i = 0; i < 3; i++) {
        const record = await nucleus.append({
          module: "test",
          chainId: "test-chain",
          body: { index: i },
        });
        records.push(record);
      }

      const chain = await nucleus.getChain("test-chain");
      expect(chain).toEqual(records);
    });

    it("should support pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await nucleus.append({
          module: "test",
          chainId: "test-chain",
          body: { index: i },
        });
      }

      const page1 = await nucleus.getChain("test-chain", { limit: 2 });
      expect(page1).toHaveLength(2);
      expect(page1[0]?.index).toBe(0);
      expect(page1[1]?.index).toBe(1);

      const page2 = await nucleus.getChain("test-chain", { limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
      expect(page2[0]?.index).toBe(2);
      expect(page2[1]?.index).toBe(3);
    });

    it("should support reverse order", async () => {
      const records: NucleusRecord[] = [];

      for (let i = 0; i < 3; i++) {
        const record = await nucleus.append({
          module: "test",
          chainId: "test-chain",
          body: { index: i },
        });
        records.push(record);
      }

      const chain = await nucleus.getChain("test-chain", { reverse: true });
      expect(chain).toEqual([records[2], records[1], records[0]]);
    });
  });

  describe("Chain consistency", () => {
    it("should enforce sequential indexes", async () => {
      const record0 = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: {},
      });

      const record1 = await nucleus.append({
        module: "test",
        chainId: "test-chain",
        body: {},
      });

      expect(record0.index).toBe(0);
      expect(record1.index).toBe(1);
      expect(record1.prevHash).toBe(record0.hash);
    });

    it("should maintain chain integrity across appends", async () => {
      const chain: NucleusRecord[] = [];

      for (let i = 0; i < 10; i++) {
        const record = await nucleus.append({
          module: "test",
          chainId: "test-chain",
          body: { step: i },
        });
        chain.push(record);

        // Verify chain integrity
        if (i > 0 && chain[i - 1]) {
          expect(record.prevHash).toBe(chain[i - 1].hash);
          expect(record.index).toBe(i);
        }
      }
    });
  });
});

