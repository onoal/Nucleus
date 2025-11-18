import type {
  LedgerRecord,
  QueryFilters,
  QueryResult,
  ModuleConfig,
  LedgerConfig,
  BackendConfig,
} from "../types";

describe("Types", () => {
  describe("LedgerRecord", () => {
    it("should have required fields", () => {
      const record: LedgerRecord = {
        id: "test-1",
        stream: "proofs",
        timestamp: 1234567890,
        payload: {
          type: "proof",
        },
      };

      expect(record.id).toBe("test-1");
      expect(record.stream).toBe("proofs");
      expect(record.timestamp).toBe(1234567890);
      expect(record.payload).toBeDefined();
    });

    it("should support optional metadata", () => {
      const record: LedgerRecord = {
        id: "test-1",
        stream: "proofs",
        timestamp: 1234567890,
        payload: {},
        meta: {
          source: "api",
        },
      };

      expect(record.meta).toBeDefined();
      expect(record.meta?.source).toBe("api");
    });
  });

  describe("QueryFilters", () => {
    it("should support all filter options", () => {
      const filters: QueryFilters = {
        stream: "proofs",
        id: "test-1",
        limit: 10,
        offset: 0,
        timestampFrom: 1000,
        timestampTo: 2000,
        moduleFilters: {
          subject_oid: "oid:onoal:human:alice",
        },
      };

      expect(filters.stream).toBe("proofs");
      expect(filters.limit).toBe(10);
      expect(filters.moduleFilters).toBeDefined();
    });
  });

  describe("QueryResult", () => {
    it("should have required fields", () => {
      const result: QueryResult = {
        records: [],
        total: 0,
        hasMore: false,
      };

      expect(result.records).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("ModuleConfig", () => {
    it("should have required fields", () => {
      const module: ModuleConfig = {
        id: "proof",
        version: "1.0.0",
        config: {},
      };

      expect(module.id).toBe("proof");
      expect(module.version).toBe("1.0.0");
      expect(module.config).toBeDefined();
    });
  });

  describe("LedgerConfig", () => {
    it("should support WASM backend", () => {
      const config: LedgerConfig = {
        id: "test-ledger",
        backend: {
          mode: "wasm",
        },
        modules: [],
      };

      expect(config.backend.mode).toBe("wasm");
    });

    it("should support HTTP backend", () => {
      const config: LedgerConfig = {
        id: "test-ledger",
        backend: {
          mode: "http",
          url: "http://localhost:3000",
        },
        modules: [],
      };

      expect(config.backend.mode).toBe("http");
      if (config.backend.mode === "http") {
        expect(config.backend.url).toBe("http://localhost:3000");
      }
    });
  });
});
