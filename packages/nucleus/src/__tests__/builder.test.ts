import { LedgerBuilder, ledgerBuilder } from "../builder";
import { proofModule, assetModule } from "../modules";

describe("LedgerBuilder", () => {
  describe("construction", () => {
    it("should create a builder with ID", () => {
      const builder = new LedgerBuilder("test-ledger");
      expect(builder).toBeDefined();
    });

    it("should create a builder using helper function", () => {
      const builder = ledgerBuilder("test-ledger");
      expect(builder).toBeDefined();
    });
  });

  describe("backend configuration", () => {
    it("should configure WASM backend", () => {
      const builder = ledgerBuilder("test-ledger").withWasmBackend();
      const config = builder.buildConfig();
      expect(config.backend.mode).toBe("wasm");
    });

    it("should configure WASM backend with custom path", () => {
      const builder =
        ledgerBuilder("test-ledger").withWasmBackend("/path/to/wasm");
      const config = builder.buildConfig();
      expect(config.backend.mode).toBe("wasm");
      if (config.backend.mode === "wasm") {
        expect(config.backend.wasmPath).toBe("/path/to/wasm");
      }
    });

    it("should configure HTTP backend", () => {
      const builder = ledgerBuilder("test-ledger").withHttpBackend(
        "http://localhost:3000"
      );
      const config = builder.buildConfig();
      expect(config.backend.mode).toBe("http");
      if (config.backend.mode === "http") {
        expect(config.backend.url).toBe("http://localhost:3000");
      }
    });

    it("should configure HTTP backend with token", () => {
      const builder = ledgerBuilder("test-ledger").withHttpBackend(
        "http://localhost:3000",
        "token123"
      );
      const config = builder.buildConfig();
      if (config.backend.mode === "http") {
        expect(config.backend.token).toBe("token123");
      }
    });
  });

  describe("module configuration", () => {
    it("should add a module", () => {
      const builder = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withModule(proofModule());
      const config = builder.buildConfig();
      expect(config.modules).toHaveLength(1);
      expect(config.modules[0].id).toBe("proof");
    });

    it("should add multiple modules", () => {
      const builder = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withModules([proofModule(), assetModule()]);
      const config = builder.buildConfig();
      expect(config.modules).toHaveLength(2);
    });
  });

  describe("options configuration", () => {
    it("should set options", () => {
      const builder = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withOptions({
          strictValidation: true,
          maxEntries: 1000,
        });
      const config = builder.buildConfig();
      expect(config.options?.strictValidation).toBe(true);
      expect(config.options?.maxEntries).toBe(1000);
    });

    it("should enable strict validation", () => {
      const builder = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withStrictValidation();
      const config = builder.buildConfig();
      expect(config.options?.strictValidation).toBe(true);
    });

    it("should set max entries", () => {
      const builder = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withMaxEntries(500);
      const config = builder.buildConfig();
      expect(config.options?.maxEntries).toBe(500);
    });

    it("should enable metrics", () => {
      const builder = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withMetrics();
      const config = builder.buildConfig();
      expect(config.options?.enableMetrics).toBe(true);
    });
  });

  describe("buildConfig", () => {
    it("should build complete config", () => {
      const config = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withModule(proofModule())
        .withStrictValidation()
        .buildConfig();

      expect(config.id).toBe("test-ledger");
      expect(config.backend.mode).toBe("wasm");
      expect(config.modules).toHaveLength(1);
      expect(config.options?.strictValidation).toBe(true);
    });

    it("should throw error if backend not configured", () => {
      const builder = ledgerBuilder("test-ledger");
      expect(() => builder.buildConfig()).toThrow("Backend must be configured");
    });
  });

  describe("fluent API", () => {
    it("should support chaining", () => {
      const builder = ledgerBuilder("test-ledger")
        .withWasmBackend()
        .withModule(proofModule())
        .withModule(assetModule())
        .withStrictValidation()
        .withMaxEntries(1000)
        .withMetrics();

      const config = builder.buildConfig();
      expect(config.modules).toHaveLength(2);
      expect(config.options?.strictValidation).toBe(true);
      expect(config.options?.maxEntries).toBe(1000);
      expect(config.options?.enableMetrics).toBe(true);
    });
  });
});
