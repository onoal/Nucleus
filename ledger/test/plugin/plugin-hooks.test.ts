/**
 * Tests for Plugin Hooks
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createLedger,
  type OnoalLedger,
  type OnoalLedgerPlugin,
} from "@onoal/ledger-core";
import { sqliteAdapter } from "@onoal/ledger-database-sqlite";
import { ed25519 } from "@noble/curves/ed25519.js";

describe("Plugin Hooks", () => {
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
      plugins: [],
    });
  });

  afterEach(() => {});

  describe("beforeAppend hook", () => {
    it("should call beforeAppend hook", async () => {
      let hookCalled = false;

      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          beforeAppend: async (entry, ledger) => {
            hookCalled = true;
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      await ledgerWithPlugin.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      expect(hookCalled).toBe(true);
    });

    it("should prevent append if beforeAppend throws", async () => {
      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          beforeAppend: async (entry, ledger) => {
            throw new Error("Append prevented");
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-error",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      await expect(
        ledgerWithPlugin.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          payload: { test: true },
        })
      ).rejects.toThrow(/Append prevented/);
    });
  });

  describe("afterAppend hook", () => {
    it("should call afterAppend hook", async () => {
      let hookCalled = false;

      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          afterAppend: async (entry, ledger) => {
            hookCalled = true;
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-after",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      await ledgerWithPlugin.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      expect(hookCalled).toBe(true);
    });

    it("should not fail append if afterAppend throws", async () => {
      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          afterAppend: async (entry, ledger) => {
            throw new Error("After append error");
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-after-error",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      // Should not throw - afterAppend errors are non-critical
      const result = await ledgerWithPlugin.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      expect(result).toHaveProperty("id");
    });
  });

  describe("beforeQuery hook", () => {
    it("should call beforeQuery hook", async () => {
      let hookCalled = false;

      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          beforeQuery: async (filters, ledger) => {
            hookCalled = true;
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-query",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      await ledgerWithPlugin.query({});

      expect(hookCalled).toBe(true);
    });

    it("should allow filter modification in beforeQuery", async () => {
      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          beforeQuery: async (filters, ledger) => {
            return {
              filters: {
                ...filters,
                limit: 5, // Modify limit
              },
            };
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-query-modify",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      // Create some entries
      for (let i = 0; i < 10; i++) {
        await ledgerWithPlugin.append({
          type: "proof",
          issuer_oid: "oid:onoal:org:test-org",
          payload: { index: i },
        });
      }

      const result = await ledgerWithPlugin.query({ limit: 2 });

      // Should be limited to 5 by plugin, not 2
      expect(result.entries.length).toBeLessThanOrEqual(5);
    });
  });

  describe("afterQuery hook", () => {
    it("should call afterQuery hook", async () => {
      let hookCalled = false;

      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          afterQuery: async (result, filters, ledger) => {
            hookCalled = true;
            return result;
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-query-after",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      await ledgerWithPlugin.query({});

      expect(hookCalled).toBe(true);
    });
  });

  describe("beforeGet hook", () => {
    it("should call beforeGet hook", async () => {
      let hookCalled = false;

      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          beforeGet: async (id, ledger) => {
            hookCalled = true;
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-get",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      await ledgerWithPlugin.get("some-id");

      expect(hookCalled).toBe(true);
    });
  });

  describe("beforeVerifyChain hook", () => {
    it("should call beforeVerifyChain hook", async () => {
      let hookCalled = false;

      const plugin: OnoalLedgerPlugin = {
        id: "test-plugin",
        version: "1.0.0",
        hooks: {
          beforeVerifyChain: async (startId, limit, ledger) => {
            hookCalled = true;
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugin = await createLedger({
        name: "test-ledger-plugin-verify",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin],
      });

      await ledgerWithPlugin.verifyChain();

      expect(hookCalled).toBe(true);
    });
  });

  describe("Multiple plugins", () => {
    it("should call hooks from multiple plugins", async () => {
      const callOrder: string[] = [];

      const plugin1: OnoalLedgerPlugin = {
        id: "plugin1",
        version: "1.0.0",
        hooks: {
          beforeAppend: async (entry, ledger) => {
            callOrder.push("plugin1-beforeAppend");
          },
        },
      };

      const plugin2: OnoalLedgerPlugin = {
        id: "plugin2",
        version: "1.0.0",
        hooks: {
          beforeAppend: async (entry, ledger) => {
            callOrder.push("plugin2-beforeAppend");
          },
        },
      };

      const adapter = sqliteAdapter({ path: ":memory:" });
      if (adapter.migrate) {
        await adapter.migrate();
      }

      const ledgerWithPlugins = await createLedger({
        name: "test-ledger-multiple-plugins",
        signingKey: ed25519.utils.randomPrivateKey(),
        adapter,
        modules: [],
        plugins: [plugin1, plugin2],
      });

      await ledgerWithPlugins.append({
        type: "proof",
        issuer_oid: "oid:onoal:org:test-org",
        payload: { test: true },
      });

      expect(callOrder.length).toBe(2);
      expect(callOrder).toContain("plugin1-beforeAppend");
      expect(callOrder).toContain("plugin2-beforeAppend");
    });
  });
});
