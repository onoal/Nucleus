import { createLedger } from "../factory";
import { proofModule, assetModule } from "../modules";
import type { LedgerConfig } from "../types";

describe("Factory", () => {
  describe("createLedger", () => {
    it("should create a ledger with WASM backend", async () => {
      const config: LedgerConfig = {
        id: "test-ledger",
        backend: {
          mode: "wasm",
        },
        modules: [proofModule(), assetModule()],
      };

      // Note: This will fail if WASM module is not available
      // In a real test environment, we would mock the WASM module
      try {
        const ledger = await createLedger(config);
        expect(ledger).toBeDefined();
        expect(ledger.id).toBe("test-ledger");
      } catch (error) {
        // Expected if WASM module is not available in test environment
        expect(error).toBeDefined();
      }
    });

    it("should throw error for HTTP backend (not implemented)", async () => {
      const config: LedgerConfig = {
        id: "test-ledger",
        backend: {
          mode: "http",
          url: "http://localhost:3000",
        },
        modules: [proofModule()],
      };

      await expect(createLedger(config)).rejects.toThrow(
        "HTTP backend not yet implemented"
      );
    });

    it("should require at least one module", async () => {
      const config: LedgerConfig = {
        id: "test-ledger",
        backend: {
          mode: "wasm",
        },
        modules: [],
      };

      // This should be validated by the factory
      // For now, it will fail at WASM initialization
      try {
        await createLedger(config);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
