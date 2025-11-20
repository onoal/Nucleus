/**
 * Tests for SQLite storage adapter
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteRecordStore } from "./index.js";
import { StorageConstraintError, NUCLEUS_SCHEMA_VERSION } from "../types/index.js";
import type { NucleusRecord } from "../types/index.js";

describe("SQLiteRecordStore", () => {
  let store: SQLiteRecordStore;

  beforeEach(() => {
    // Use in-memory database for tests
    store = new SQLiteRecordStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  // Helper to create a test record
  function createRecord(overrides?: Partial<NucleusRecord>): NucleusRecord {
    return {
      schema: NUCLEUS_SCHEMA_VERSION,
      module: "test",
      chainId: "test-chain",
      index: 0,
      prevHash: null,
      createdAt: new Date().toISOString(),
      body: { test: "data" },
      hash: `hash-${Math.random()}`,
      ...overrides,
    };
  }

  describe("put()", () => {
    it("should store a record", async () => {
      const record = createRecord();
      await store.put(record);

      const retrieved = await store.getByHash(record.hash);
      expect(retrieved).toEqual(record);
    });

    it("should reject duplicate hash", async () => {
      const record = createRecord({ hash: "duplicate-hash" });
      await store.put(record);

      const duplicate = createRecord({
        hash: "duplicate-hash",
        chainId: "different-chain",
      });

      await expect(store.put(duplicate)).rejects.toThrow(StorageConstraintError);
      await expect(store.put(duplicate)).rejects.toThrow(/hash.*already exists/);
    });

    it("should reject duplicate (chainId, index)", async () => {
      const record = createRecord({
        chainId: "chain-1",
        index: 0,
      });
      await store.put(record);

      const duplicate = createRecord({
        chainId: "chain-1",
        index: 0,
        hash: "different-hash",
      });

      await expect(store.put(duplicate)).rejects.toThrow(StorageConstraintError);
      await expect(store.put(duplicate)).rejects.toThrow(/chainId.*index.*already exists/);
    });

    it("should allow same index in different chains", async () => {
      const record1 = createRecord({ chainId: "chain-1", index: 0 });
      const record2 = createRecord({ chainId: "chain-2", index: 0 });

      await store.put(record1);
      await store.put(record2);

      const retrieved1 = await store.getByHash(record1.hash);
      const retrieved2 = await store.getByHash(record2.hash);

      expect(retrieved1).toEqual(record1);
      expect(retrieved2).toEqual(record2);
    });
  });

  describe("getByHash()", () => {
    it("should return null for non-existent hash", async () => {
      const result = await store.getByHash("non-existent");
      expect(result).toBeNull();
    });

    it("should retrieve stored record", async () => {
      const record = createRecord();
      await store.put(record);

      const retrieved = await store.getByHash(record.hash);
      expect(retrieved).toEqual(record);
    });
  });

  describe("getHead()", () => {
    it("should return null for non-existent chain", async () => {
      const result = await store.getHead("non-existent-chain");
      expect(result).toBeNull();
    });

    it("should return the only record in a chain", async () => {
      const record = createRecord({ chainId: "chain-1", index: 0 });
      await store.put(record);

      const head = await store.getHead("chain-1");
      expect(head).toEqual(record);
    });

    it("should return the latest record in a chain", async () => {
      const record0 = createRecord({ chainId: "chain-1", index: 0 });
      const record1 = createRecord({ chainId: "chain-1", index: 1, prevHash: record0.hash });
      const record2 = createRecord({ chainId: "chain-1", index: 2, prevHash: record1.hash });

      await store.put(record0);
      await store.put(record1);
      await store.put(record2);

      const head = await store.getHead("chain-1");
      expect(head).toEqual(record2);
    });
  });

  describe("getChain()", () => {
    it("should return empty array for non-existent chain", async () => {
      const result = await store.getChain("non-existent-chain");
      expect(result).toEqual([]);
    });

    it("should return all records in order", async () => {
      const record0 = createRecord({ chainId: "chain-1", index: 0 });
      const record1 = createRecord({ chainId: "chain-1", index: 1 });
      const record2 = createRecord({ chainId: "chain-1", index: 2 });

      // Insert in random order
      await store.put(record1);
      await store.put(record0);
      await store.put(record2);

      const chain = await store.getChain("chain-1");
      expect(chain).toEqual([record0, record1, record2]);
    });

    it("should respect limit option", async () => {
      const record0 = createRecord({ chainId: "chain-1", index: 0 });
      const record1 = createRecord({ chainId: "chain-1", index: 1 });
      const record2 = createRecord({ chainId: "chain-1", index: 2 });

      await store.put(record0);
      await store.put(record1);
      await store.put(record2);

      const chain = await store.getChain("chain-1", { limit: 2 });
      expect(chain).toEqual([record0, record1]);
    });

    it("should respect offset option", async () => {
      const record0 = createRecord({ chainId: "chain-1", index: 0 });
      const record1 = createRecord({ chainId: "chain-1", index: 1 });
      const record2 = createRecord({ chainId: "chain-1", index: 2 });

      await store.put(record0);
      await store.put(record1);
      await store.put(record2);

      const chain = await store.getChain("chain-1", { offset: 1 });
      expect(chain).toEqual([record1, record2]);
    });

    it("should respect reverse option", async () => {
      const record0 = createRecord({ chainId: "chain-1", index: 0 });
      const record1 = createRecord({ chainId: "chain-1", index: 1 });
      const record2 = createRecord({ chainId: "chain-1", index: 2 });

      await store.put(record0);
      await store.put(record1);
      await store.put(record2);

      const chain = await store.getChain("chain-1", { reverse: true });
      expect(chain).toEqual([record2, record1, record0]);
    });

    it("should combine limit, offset, and reverse", async () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        createRecord({ chainId: "chain-1", index: i })
      );

      for (const record of records) {
        await store.put(record);
      }

      const chain = await store.getChain("chain-1", {
        reverse: true,
        limit: 2,
        offset: 1,
      });

      // Reverse order, skip first (index 4), take 2 (index 3, 2)
      expect(chain).toEqual([records[3], records[2]]);
    });

    it("should isolate chains", async () => {
      const chain1Record = createRecord({ chainId: "chain-1", index: 0 });
      const chain2Record = createRecord({ chainId: "chain-2", index: 0 });

      await store.put(chain1Record);
      await store.put(chain2Record);

      const chain1 = await store.getChain("chain-1");
      const chain2 = await store.getChain("chain-2");

      expect(chain1).toEqual([chain1Record]);
      expect(chain2).toEqual([chain2Record]);
    });
  });
});

