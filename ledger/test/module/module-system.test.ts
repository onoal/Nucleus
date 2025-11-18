/**
 * Tests for Module System
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createLedger,
  type OnoalLedger,
  type OnoalLedgerModule,
} from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import { ed25519 } from "@noble/curves/ed25519.js";

describe("Module System", () => {
  beforeEach(() => {
    // Database created by sqliteAdapter
  });

  afterEach(() => {});

  describe("Module registration", () => {
    it("should register module", async () => {
      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const module: OnoalLedgerModule = {
        id: "test-module",
        label: "Test Module",
        version: "1.0.0",
      };

      const ledger = await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module],
      });

      const modules = ledger.getModules();
      expect(modules.length).toBe(1);
      expect(modules[0]?.id).toBe("test-module");
    });

    it("should register multiple modules", async () => {
      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const module1: OnoalLedgerModule = {
        id: "module1",
      };
      const module2: OnoalLedgerModule = {
        id: "module2",
      };

      const ledger = await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module1, module2],
      });

      const modules = ledger.getModules();
      expect(modules.length).toBe(2);
    });
  });

  describe("Service registration from modules", () => {
    it("should register services from module", async () => {
      class TestService {
        constructor(private ledger: OnoalLedger) {}
        test() {
          return "test";
        }
      }

      const module: OnoalLedgerModule = {
        id: "test-module",
        services: {
          testService: TestService,
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledger = await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module],
      });

      const service = ledger.getService<TestService>("testService");
      expect(service).toBeDefined();
      expect(service.test()).toBe("test");
    });

    it("should register multiple services from module", async () => {
      class Service1 {
        constructor(private ledger: OnoalLedger) {}
      }
      class Service2 {
        constructor(private ledger: OnoalLedger) {}
      }

      const module: OnoalLedgerModule = {
        id: "test-module",
        services: {
          service1: Service1,
          service2: Service2,
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledger = await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module],
      });

      const service1 = ledger.getService<Service1>("service1");
      const service2 = ledger.getService<Service2>("service2");

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
    });
  });

  describe("Module lifecycle", () => {
    it("should call load() lifecycle hook", async () => {
      let loadCalled = false;

      const module: OnoalLedgerModule = {
        id: "test-module",
        load: async (ledger) => {
          loadCalled = true;
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module],
      });

      expect(loadCalled).toBe(true);
    });

    it("should call start() lifecycle hook", async () => {
      let startCalled = false;

      const module: OnoalLedgerModule = {
        id: "test-module",
        start: async (ledger) => {
          startCalled = true;
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module],
      });

      expect(startCalled).toBe(true);
    });

    it("should call load() before start()", async () => {
      const callOrder: string[] = [];

      const module: OnoalLedgerModule = {
        id: "test-module",
        load: async (ledger) => {
          callOrder.push("load");
        },
        start: async (ledger) => {
          callOrder.push("start");
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module],
      });

      expect(callOrder).toEqual(["load", "start"]);
    });
  });

  describe("Module dependencies", () => {
    it("should handle module dependencies", async () => {
      const module1: OnoalLedgerModule = {
        id: "module1",
      };

      const module2: OnoalLedgerModule = {
        id: "module2",
        dependencies: ["module1"],
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledger = await createLedger({
        name: "test-ledger",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [module1, module2],
      });

      const modules = ledger.getModules();
      expect(modules.length).toBe(2);
    });
  });
});
